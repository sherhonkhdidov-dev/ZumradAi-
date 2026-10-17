// Suhbat boshqaruvchisi: xabarlarni chizish, yuborish, oqimni qabul qilish, rasm/video oqimlarini ishga tushirish.

import { S, current } from "./state.js";
import * as store from "./store.js";
import { streamChat } from "./api.js";
import { renderMarkdown, decorate, collectFiles, isPreviewable } from "./markdown.js";
import { openPreview, zipFiles, downloadFile } from "./preview.js";
import { detectIntent } from "./intent.js";
import { runImage, runVideo, runGenerativeVideo } from "./media.js";
import { primeAudio, videoExtension, canRecordVideo } from "./videoRender.js";
import {
  $, $$, uid, escapeHtml, icon, toast, copyText, downloadBlob, downloadText, formatBytes, blobToDataUrl, downscaleImage,
  isImageFile, isTextFile, dateGroup, safeFileName,
} from "./util.js";

const chatEl = $("#chat");
const scrollEl = $("#scroll");
const promptEl = $("#prompt");
let openSettings = () => {};
export const hooks = {
  set openSettings(fn) {
    openSettings = fn;
  },
};

/* ====================== Suhbatlar ====================== */

export function newChat({ focus = true } = {}) {
  const existing = S.chats.find((c) => !c.messages.length);
  if (existing) {
    S.cur = existing.id;
  } else {
    const c = { id: uid(), title: "Yangi suhbat", created: Date.now(), updated: Date.now(), messages: [] };
    S.chats.unshift(c);
    S.cur = c.id;
  }
  renderAll();
  closeSide();
  if (focus && !matchMedia("(pointer:coarse)").matches) promptEl.focus();
}

export function selectChat(id) {
  S.cur = id;
  renderAll();
  closeSide();
}

async function removeChat(id) {
  const chat = S.chats.find((c) => c.id === id);
  if (!chat) return;
  if (chat.messages.length > 1 && !confirm(`“${chat.title}” suhbatini o‘chirasizmi?`)) return;
  await store.deleteChat(chat);
  S.chats = S.chats.filter((c) => c.id !== id);
  if (S.cur === id) S.cur = S.chats[0]?.id || null;
  if (!S.cur) newChat({ focus: false });
  else renderAll();
}

function renameChat(id) {
  const chat = S.chats.find((c) => c.id === id);
  if (!chat) return;
  const name = prompt("Suhbat nomi:", chat.title);
  if (name && name.trim()) {
    chat.title = name.trim().slice(0, 80);
    store.saveChat(chat);
    renderAll();
  }
}

export function closeSide() {
  $("#app").dataset.side = "closed";
}

/* ====================== Chizish: yon panel va yuqori qator ====================== */

export function renderAll() {
  renderHistory();
  renderChat();
  renderTop();
}

function renderTop() {
  const c = current();
  $("#topTitle").textContent = c && c.messages.length ? c.title : "Yangi suhbat";
  const last = c && [...c.messages].reverse().find((m) => m.role === "assistant" && m.meta?.model);
  const badge = $("#modelBadge");
  badge.hidden = !last;
  if (last) badge.textContent = last.meta.model;
  $("#exportBtn").hidden = !c || !c.messages.length;
}

export function renderHistory() {
  const host = $("#history");
  const list = S.chats.filter((c) => c.messages.length);
  if (!list.length) {
    host.innerHTML = `<p class="history-empty">Suhbatlar shu yerda ko‘rinadi.</p>`;
    return;
  }
  let html = "";
  let group = "";
  for (const c of list) {
    const g = dateGroup(c.updated);
    if (g !== group) {
      group = g;
      html += `<h3 class="history-group">${g}</h3>`;
    }
    html += `<div class="history-item" data-id="${c.id}" aria-current="${c.id === S.cur}">
      <button class="history-open" data-act="open-chat" title="${escapeHtml(c.title)}"><span>${escapeHtml(c.title)}</span></button>
      <span class="history-tools"><button class="icon-btn xs" data-act="rename-chat" aria-label="Nomini o‘zgartirish">${icon("pencil", "sm")}</button><button class="icon-btn xs" data-act="delete-chat" aria-label="O‘chirish">${icon("trash", "sm")}</button></span>
    </div>`;
  }
  host.innerHTML = html;
}

/* ====================== Chizish: xabarlar ====================== */

const SUGGESTIONS = [
  { icon: "code", title: "Portfolio saytini yozish", hint: "Jonli ko‘rinish bilan", text: "Frontend dasturchi uchun portfolio sayt yoz: ismi Dilshod, 3 ta loyiha, bog‘lanish formasi. Telefonda chiroyli ko‘rinadigan, yorug‘ va qorong‘i mavzuli, bitta index.html bo‘lsin." },
  { icon: "code", title: "Telegram bot yaratish", hint: "Python, to‘liq loyiha", text: "Python va aiogram 3 bilan Telegram bot yozib ber: foydalanuvchi shahar nomini yuboradi, bot ob-havoni ko‘rsatadi. Fayllar tuzilmasi va ishga tushirish qadamlarini ham yoz." },
  { icon: "image", title: "Registon tongda", hint: "Rasm chizish", text: "Samarqand Registonining tong chog‘idagi rasmini chiz: iliq quyosh nuri, yengil tuman, oldinda kabutarlar." },
  { icon: "chat", title: "Dars rejasini tuzish", hint: "Aniq va tushunarli", text: "Maktab o‘quvchilari uchun Python dasturlashni o‘rgatuvchi 4 haftalik dars rejasi tuzib ber: har hafta mavzu, mashq va uy vazifasi bilan." },
];

function welcomeEl() {
  const el = document.createElement("section");
  el.className = "welcome";
  el.innerHTML = `
    <div class="welcome-pattern" aria-hidden="true"><div></div></div>
    <img class="welcome-star" src="icons/logo.svg" alt="" width="56" height="56">
    <h2>Nima yaratamiz?</h2>
    <p>Savol bering, kod yozdiring, yoki rasm chizdiring. Fayl yoki rasm tashlasangiz, uni ham o‘qiydi.</p>
    <ul class="starters">
      ${SUGGESTIONS.map((s, i) => `<li><button type="button" data-act="starter" data-i="${i}">${icon(s.icon)}<span class="st-title">${s.title}</span><span class="st-hint">${s.hint}</span></button></li>`).join("")}
    </ul>`;
  return el;
}

export function renderChat() {
  const c = current();
  chatEl.innerHTML = "";
  document.body.classList.toggle("is-empty", !c || !c.messages.length);
  if (!c || !c.messages.length) {
    chatEl.append(welcomeEl());
    return;
  }
  c.messages.forEach((m) => chatEl.append(messageEl(m)));
  scrollToBottom(true);
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function messageEl(m) {
  const el = document.createElement("article");
  el.dataset.id = m.id;
  if (m.role === "user") {
    el.className = "msg user";
    const atts = (m.attachments || [])
      .map((a) =>
        a.kind === "image"
          ? `<span class="att img" data-media="${a.mediaId}"><i></i><span>${escapeHtml(a.name)}</span></span>`
          : `<span class="att">${icon("file", "sm")}<span>${escapeHtml(a.name)}</span></span>`,
      )
      .join("");
    el.innerHTML = `<div class="bubble">${atts ? `<div class="atts">${atts}</div>` : ""}${m.content ? `<p>${escapeHtml(m.content)}</p>` : ""}</div>`;
    hydrateThumbs(el);
    return el;
  }
  el.className = `msg assistant ${m.kind !== "text" ? "media" : ""}`;
  el.innerHTML = `<img class="avatar" src="icons/logo.svg" alt="" width="26" height="26"><div class="msg-main"></div>`;
  fillAssistant(el, m);
  return el;
}

function fillAssistant(el, m) {
  const main = el.querySelector(".msg-main");
  if (m.kind === "image") main.innerHTML = imageCardHtml(m);
  else if (m.kind === "video") main.innerHTML = videoCardHtml(m);
  else main.innerHTML = `<div class="md"></div><div class="msg-extra"></div>`;
  if (m.kind === "text") {
    fillText(el, m);
    if (!m.streaming) fillExtras(el, m);
  } else hydrateMedia(el, m);
}

function fillText(el, m) {
  const md = el.querySelector(".md");
  if (!md) return;
  if (m.streaming && !m.content) {
    md.innerHTML = `<span class="typing" aria-label="Javob tayyorlanmoqda"><img src="icons/logo.svg" alt="" width="18" height="18"><span>Javob tayyorlanmoqda</span></span>`;
    return;
  }
  md.innerHTML = renderMarkdown(m.content);
  decorate(md, { sources: m.meta?.sources || [] });
  if (m.streaming) md.classList.add("streaming");
  else md.classList.remove("streaming");
}

function fillExtras(el, m) {
  const host = el.querySelector(".msg-extra");
  if (!host) return;
  const parts = [];
  if (m.meta?.error) {
    parts.push(`<div class="note err" role="alert"><p>${escapeHtml(m.meta.error)}</p><button type="button" class="chip" data-act="retry">${icon("refresh", "sm")}Qayta urinish</button></div>`);
  }
  if (m.meta?.stopped) parts.push(`<p class="note">Javob to‘xtatildi.</p>`);
  const src = m.meta?.sources || [];
  if (src.length) {
    parts.push(`<div class="srcs"><span class="srcs-label">Manbalar</span>${src
      .map((s, i) => `<a class="src" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer nofollow" title="${escapeHtml(s.title)}"><i>${i + 1}</i><span>${escapeHtml(domainOf(s.url))}</span></a>`)
      .join("")}</div>`);
  }
  const files = collectFiles(m.content);
  if (files.length) {
    const prev = files.some(isPreviewable);
    parts.push(`<div class="files-bar">
      ${prev ? `<button type="button" class="chip strong" data-act="project-preview">${icon("eye", "sm")}Jonli ko‘rinish</button>` : `<button type="button" class="chip" data-act="project-preview">${icon("code", "sm")}Fayllarni ochish</button>`}
      ${files.length > 1 ? `<button type="button" class="chip" data-act="zip">${icon("zip", "sm")}ZIP (${files.length} fayl)</button>` : ""}
    </div>`);
  }
  const isLast = current().messages.at(-1)?.id === m.id;
  parts.push(`<div class="msg-actions">
    <button type="button" class="icon-btn xs" data-act="copy-msg" aria-label="Javobni nusxalash" title="Nusxa olish">${icon("copy", "sm")}</button>
    ${isLast ? `<button type="button" class="icon-btn xs" data-act="regen" aria-label="Qayta yaratish" title="Qayta yaratish">${icon("refresh", "sm")}</button>` : ""}
    ${m.meta?.model ? `<span class="by">${escapeHtml(m.meta.model)}</span>` : ""}
  </div>`);
  host.innerHTML = parts.join("");
}

/* ---------- rasm va video kartalari ---------- */

function loadingBlock(text, since, ratio) {
  return `<div class="skeleton" style="aspect-ratio:${ratio}"><img src="icons/logo.svg" alt="" width="34" height="34"><p>${text} <span class="elapsed" data-since="${since}"></span></p></div>`;
}

function ratioOf(aspect) {
  return (aspect || "1:1").replace(":", " / ");
}

function imageCardHtml(m) {
  const im = m.image || {};
  const ratio = ratioOf(im.aspect);
  if (im.status === "loading") {
    return `<figure class="media-card">${loadingBlock("Rasm chizilmoqda…", im.startedAt || Date.now(), ratio)}<figcaption class="cap">Tavsif inglizchaga o‘girilib, Flux modeliga yuboriladi. Odatda 5–15 soniya.</figcaption></figure>`;
  }
  if (im.status === "error") {
    return `<figure class="media-card"><div class="note err" role="alert"><p>${escapeHtml(im.error || "Rasm yaratilmadi.")}</p><button type="button" class="chip" data-act="regen">${icon("refresh", "sm")}Qayta urinish</button></div></figure>`;
  }
  return `<figure class="media-card">
    <button type="button" class="media-frame" data-act="open-image" aria-label="Rasmni katta ochish"><img data-media="${im.mediaId}" alt="${escapeHtml(im.original || "AI rasmi")}" style="aspect-ratio:${ratio}"></button>
    <figcaption class="cap">
      <span class="chips">
        <button type="button" class="chip" data-act="img-download">${icon("download", "sm")}Yuklab olish</button>
        <button type="button" class="chip" data-act="regen">${icon("refresh", "sm")}Qayta yaratish</button>
        <button type="button" class="chip" data-act="copy-prompt">${icon("copy", "sm")}Prompt</button>
      </span>
      <span class="by">${escapeHtml(im.model || "")}${im.w ? ` · ${im.w}×${im.h}` : ""}</span>
    </figcaption>
    <details class="prompt-details"><summary>AI yozgan prompt</summary><p>${escapeHtml(im.prompt || "")}</p></details>
  </figure>`;
}

const STAGES = [
  ["planning", "Ssenariy"],
  ["images", "Kadrlar"],
  ["rendering", "Montaj"],
];

function videoCardHtml(m) {
  const v = m.video || {};
  const ratio = ratioOf(v.aspect);
  if (v.status === "done") {
    const src = v.url ? `src="${escapeHtml(v.url)}"` : `data-media="${v.mediaId}"`;
    return `<figure class="media-card video-card">
      <div class="video-wrap" style="aspect-ratio:${ratio}"><video controls playsinline preload="metadata" ${src}></video></div>
      <figcaption class="cap">
        <span class="chips">
          ${v.url ? `<a class="chip" href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer">${icon("external", "sm")}Ochish</a>` : `<button type="button" class="chip" data-act="video-download">${icon("download", "sm")}Yuklab olish (${v.mime?.includes("mp4") ? "MP4" : "WebM"})</button>`}
          ${v.generative ? "" : `<button type="button" class="chip" data-act="video-rerender">${icon("refresh", "sm")}Qayta yig‘ish</button>`}
          <button type="button" class="chip" data-act="regen">${icon("film", "sm")}Yangi variant</button>
        </span>
        <span class="by">${escapeHtml(v.title || "")}${v.duration ? ` · ${v.duration} s` : ""}</span>
      </figcaption>
      ${scenesHtml(v)}
    </figure>`;
  }
  if (v.status === "error") {
    return `<figure class="media-card video-card"><div class="note err" role="alert"><p>${escapeHtml(v.error || "Video yaratilmadi.")}</p>
      <span class="chips">${v.scenes?.length ? `<button type="button" class="chip" data-act="video-resume">${icon("refresh", "sm")}Davom ettirish</button>` : ""}<button type="button" class="chip" data-act="regen">${icon("film", "sm")}Boshidan</button></span></div>${scenesHtml(v)}</figure>`;
  }
  // jarayon
  const idx = STAGES.findIndex(([k]) => k === v.status);
  const done = v.scenes?.filter((s) => s.status === "done").length || 0;
  const label = v.generative
    ? "Generativ model video yaratmoqda… (1–5 daqiqa)"
    : v.status === "planning"
      ? "Ssenariy yozilmoqda…"
      : v.status === "images"
        ? `Kadrlar chizilmoqda… ${done}/${v.scenes?.length || 0}`
        : "Video yig‘ilmoqda…";
  const steps = v.generative
    ? ""
    : `<ol class="stages">${STAGES.map(([k, name], i) => `<li data-s="${i < idx ? "done" : i === idx ? "now" : "wait"}">${name}</li>`).join("")}</ol>`;
  return `<figure class="media-card video-card" data-progress>
    <div class="video-wrap busy" style="aspect-ratio:${ratio}"><div class="skeleton"><img src="icons/logo.svg" alt="" width="34" height="34"><p class="vlabel">${label} <span class="elapsed" data-since="${v.startedAt || Date.now()}"></span></p></div></div>
    ${steps}
    <div class="bar" ${v.status === "rendering" ? "" : "hidden"}><i style="width:${Math.round((v.progress || 0) * 100)}%"></i></div>
    ${v.status === "rendering" ? `<p class="cap warn">Montaj video real vaqtda yoziladi (~${(v.scenes || []).reduce((a, s) => a + s.seconds, 0)} s). Shu vaqt ichida ekranni o‘chirmang va boshqa ilovaga o‘tmang.</p>` : ""}
    ${scenesHtml(v)}
  </figure>`;
}

function scenesHtml(v) {
  if (!v.scenes?.length) return "";
  return `<details class="scenes" ${v.status === "done" ? "" : "open"}><summary>${v.title ? escapeHtml(v.title) + " — " : ""}ssenariy (${v.scenes.length} kadr)</summary>
    <ol>${v.scenes
      .map((s) => `<li data-s="${s.status}"><span class="thumb">${s.mediaId ? `<img data-media="${s.mediaId}" alt="">` : ""}</span><span class="cap-text">${escapeHtml(s.caption || "")}<small>${escapeHtml(s.motion?.replace("_", " ") || "")} · ${s.seconds} s</small></span></li>`)
      .join("")}</ol></details>`;
}

async function hydrateMedia(el, m) {
  const nodes = el.querySelectorAll("[data-media]");
  for (const node of nodes) {
    const url = await store.mediaUrl(node.dataset.media);
    if (!url) continue;
    if (node.tagName === "IMG" || node.tagName === "VIDEO") node.src = url;
  }
}

async function hydrateThumbs(el) {
  for (const node of el.querySelectorAll(".att.img[data-media]")) {
    const url = await store.mediaUrl(node.dataset.media);
    if (url) node.querySelector("i").style.backgroundImage = `url(${url})`;
  }
}

/** Xabarni DOM'da yangidan chizadi (rasm/video jarayoni yangilanganda). */
function replaceMessage(m, { light = false } = {}) {
  const el = chatEl.querySelector(`[data-id="${m.id}"]`);
  if (!el) return;
  if (light && m.kind === "video" && m.video?.status === "rendering") {
    const bar = el.querySelector(".bar i");
    if (bar) bar.style.width = Math.round((m.video.progress || 0) * 100) + "%";
    return;
  }
  const fresh = messageEl(m);
  el.replaceWith(fresh);
  if (nearBottom()) scrollToBottom();
}

/* ====================== Skroll ====================== */

let stick = true;
const nearBottom = () => scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 140;

export function scrollToBottom(force = false) {
  if (!force && !stick) return;
  scrollEl.scrollTop = scrollEl.scrollHeight;
}

export function initScroll() {
  scrollEl.addEventListener(
    "scroll",
    () => {
      stick = nearBottom();
      $("#toBottom").hidden = stick || document.body.classList.contains("is-empty");
    },
    { passive: true },
  );
  $("#toBottom").onclick = () => {
    stick = true;
    scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" });
  };
  setInterval(() => {
    document.querySelectorAll(".elapsed[data-since]").forEach((e) => {
      const s = Math.max(0, Math.round((Date.now() - Number(e.dataset.since)) / 1000));
      e.textContent = s ? `${s} s` : "";
    });
  }, 1000);
}

/* ====================== Biriktirmalar ====================== */

export async function addFiles(fileList) {
  const files = [...fileList];
  for (const f of files) {
    if (S.pending.length >= 5) {
      toast("Bir vaqtning o‘zida 5 tagacha fayl biriktirish mumkin", "error");
      break;
    }
    try {
      if (isImageFile(f)) {
        const { blob } = await downscaleImage(f);
        const mediaId = uid();
        await store.putMedia(mediaId, blob);
        S.pending.push({ kind: "image", name: f.name || "rasm.jpg", mediaId, size: blob.size });
      } else if (isTextFile(f)) {
        if (f.size > 600_000) {
          toast(`“${f.name}” juda katta (600 KB dan oshmasin)`, "error");
          continue;
        }
        let text = await f.text();
        const truncated = text.length > 30000;
        if (truncated) text = text.slice(0, 30000);
        S.pending.push({ kind: "text", name: f.name, text, size: f.size, truncated });
        if (truncated) toast(`“${f.name}” ning dastlabki 30 000 belgisi olindi`);
      } else {
        toast(`“${f.name}” formati hozircha qo‘llanmaydi. Matn, kod va rasm fayllarini biriktiring.`, "error", 4500);
      }
    } catch {
      toast(`“${f.name}” ni o‘qib bo‘lmadi`, "error");
    }
  }
  renderPending();
}

export function renderPending() {
  const host = $("#attached");
  host.hidden = !S.pending.length;
  host.innerHTML = S.pending
    .map(
      (a, i) => `<span class="att ${a.kind === "image" ? "img" : ""}" data-media="${a.mediaId || ""}">${a.kind === "image" ? "<i></i>" : icon("file", "sm")}<span>${escapeHtml(a.name)}</span><small>${formatBytes(a.size)}</small><button type="button" data-act="rm-att" data-i="${i}" aria-label="Olib tashlash">${icon("x", "sm")}</button></span>`,
    )
    .join("");
  hydrateThumbs(host);
}

/* ====================== Yuborish ====================== */

function setRunning(on) {
  S.running = on;
  const btn = $("#sendBtn");
  btn.classList.toggle("stop", on);
  btn.setAttribute("aria-label", on ? "To‘xtatish" : "Yuborish");
  btn.innerHTML = icon(on ? "stop" : "send");
}

export function stop() {
  S.ctrl?.abort();
}

export async function submit() {
  if (S.running) return stop();
  const text = promptEl.value.trim();
  if (!text && !S.pending.length) return;
  await sendMessage(text, { attachments: S.pending.splice(0) });
  renderPending();
}

export async function sendMessage(text, { attachments = [], forceMode } = {}) {
  primeAudio(); // audio faqat foydalanuvchi harakatidan keyin ruxsat etiladi
  let mode = forceMode || S.mode;
  let prompt = text;
  const intent = detectIntent(text);
  if (/^\//.test(text) && intent.type !== "chat") {
    mode = intent.type;
    prompt = intent.prompt;
  } else if (mode === "auto") {
    mode = attachments.length ? "chat" : intent.type;
    if (mode !== "chat") prompt = intent.prompt;
  }
  if ((mode === "image" || mode === "video") && !prompt.trim()) {
    toast(mode === "image" ? "Rasm tavsifini yozing" : "Video g‘oyasini yozing", "error");
    return;
  }
  if (mode === "video" && !S.generative && !canRecordVideo()) {
    toast("Bu brauzer video yozib olishni qo‘llamaydi. Chrome yoki Safari’ning yangi versiyasini sinab ko‘ring.", "error", 5000);
    return;
  }

  // darhol "band" holatiga o'tamiz — ikki marta yuborishning oldini olish
  S.ctrl = new AbortController();
  setRunning(true);

  if (!current()) newChat({ focus: false });
  const chat = current();
  const userMsg = { id: uid(), role: "user", kind: "text", content: text, attachments: attachments.map(({ text: t, ...a }) => ({ ...a, text: t })) };
  chat.messages.push(userMsg);
  if (chat.messages.length === 1) chat.title = (text || attachments[0]?.name || "Yangi suhbat").replace(/\s+/g, " ").slice(0, 48);
  promptEl.value = "";
  autosize();
  stick = true;
  if (chat.messages.length === 1) {
    renderAll();
  } else {
    chatEl.append(messageEl(userMsg));
    renderHistory();
  }
  await store.saveChat(chat);
  await respond(chat, mode, prompt);
}

/** Yordamchi javobini yaratadi (chat / rasm / video). */
async function respond(chat, mode, prompt) {
  const ctrl = S.ctrl || new AbortController();
  S.ctrl = ctrl;
  setRunning(true);
  const msg = { id: uid(), role: "assistant", kind: "text", content: "", meta: {} };
  chat.messages.push(msg);
  try {
    if (mode === "image") {
      const el = messageEl({ ...msg, kind: "image", image: { status: "loading", startedAt: Date.now(), aspect: S.settings.imageQuality === "hq" ? S.settings.imageAspect : "1:1" } });
      chatEl.append(el);
      scrollToBottom(true);
      msg.promptText = prompt;
      await runImage({
        msg,
        prompt,
        quality: S.settings.imageQuality,
        aspect: S.settings.imageAspect,
        signal: ctrl.signal,
        onUpdate: () => {
          replaceMessage(msg);
          store.saveChat(chat);
        },
      });
    } else if (mode === "video") {
      msg.promptText = prompt;
      const start = { ...msg, kind: "video", video: { status: S.generative ? "generating" : "planning", aspect: S.settings.videoAspect, scenes: [], startedAt: Date.now() } };
      chatEl.append(messageEl(start));
      scrollToBottom(true);
      const onUpdate = (opts) => {
        replaceMessage(msg, opts);
        if (!opts?.light) store.saveChat(chat);
      };
      if (S.generative) await runGenerativeVideo({ msg, idea: prompt, signal: ctrl.signal, onUpdate });
      else await runVideo({ msg, idea: prompt, seconds: S.settings.videoSeconds, aspect: S.settings.videoAspect, signal: ctrl.signal, onUpdate });
    } else {
      await runChat(chat, msg, ctrl);
    }
  } finally {
    setRunning(false);
    S.ctrl = null;
    await store.saveChat(chat);
    renderHistory();
    renderTop();
    // oxirgi xabar tugmalarini (qayta yaratish va h.k.) yangilaymiz
    const last = chat.messages.at(-1);
    if (last && last.role === "assistant") replaceMessage(last);
  }
}

async function buildPayload(chat, exclude) {
  const out = [];
  const lastUserIdx = chat.messages.map((m) => m.role).lastIndexOf("user");
  for (let i = 0; i < chat.messages.length; i++) {
    const m = chat.messages[i];
    if (m === exclude) continue;
    if (m.role === "user") {
      let content = m.content || "";
      const images = [];
      for (const a of m.attachments || []) {
        if (a.kind === "text") content += `\n\n---\nFayl: ${a.name}${a.truncated ? " (qisqartirilgan)" : ""}\n\`\`\`\n${a.text}\n\`\`\``;
        else if (a.kind === "image" && i === lastUserIdx) {
          const blob = await store.getMedia(a.mediaId);
          if (blob) images.push(await blobToDataUrl(blob));
        } else if (a.kind === "image") content += `\n[Rasm biriktirilgan edi: ${a.name}]`;
      }
      out.push({ role: "user", content: content || "(rasm)", images });
    } else if (m.kind === "image") {
      out.push({ role: "assistant", content: `[Rasm yaratildi: ${m.image?.original || m.promptText || ""}]` });
    } else if (m.kind === "video") {
      out.push({ role: "assistant", content: `[Video yaratildi: ${m.video?.title || m.promptText || ""}]` });
    } else if (m.content) {
      out.push({ role: "assistant", content: m.content });
    }
  }
  return out;
}

async function runChat(chat, msg, ctrl) {
  msg.streaming = true;
  msg.meta = {};
  const el = messageEl(msg);
  chatEl.append(el);
  scrollToBottom(true);
  let raf = 0;
  const paint = () => {
    raf = 0;
    fillText(el, msg);
    scrollToBottom();
  };
  try {
    const payload = await buildPayload(chat, msg);
    for await (const ev of streamChat({ messages: payload, model: S.settings.model, web: S.settings.web, signal: ctrl.signal })) {
      if (ev.type === "meta") {
        msg.meta.sources = ev.sources || [];
        msg.meta.searchProvider = ev.searchProvider;
      } else if (ev.type === "model") {
        msg.meta.model = ev.label;
        msg.meta.modelId = ev.id;
      } else if (ev.type === "token") {
        msg.content += ev.t;
        if (!raf) raf = requestAnimationFrame(paint);
      } else if (ev.type === "error") {
        msg.meta.error = ev.message;
      }
    }
  } catch (e) {
    if (e.name === "AbortError") msg.meta.stopped = true;
    else {
      msg.meta.error = e.message;
      if (e.code === "access_code") setTimeout(() => openSettings({ focusCode: true }), 300);
    }
  } finally {
    cancelAnimationFrame(raf);
    msg.streaming = false;
    if (!msg.content && !msg.meta.error && !msg.meta.stopped) msg.meta.error = "Javob bo‘sh keldi. Qayta urinib ko‘ring.";
    if (!msg.content) msg.content = "";
  }
  // yakuniy chizish
  const fresh = messageEl(msg);
  el.replaceWith(fresh);
  scrollToBottom();
}

/* ====================== Qayta yaratish ====================== */

async function regenerate(msgId) {
  if (S.running) return;
  const chat = current();
  const idx = chat.messages.findIndex((m) => m.id === msgId);
  if (idx < 1) return;
  const old = chat.messages[idx];
  const removed = chat.messages.splice(idx);
  removed.forEach((m) => {
    if (m.image?.mediaId) store.deleteMedia(m.image.mediaId);
    if (m.video?.mediaId) store.deleteMedia(m.video.mediaId);
    (m.video?.scenes || []).forEach((s) => s.mediaId && store.deleteMedia(s.mediaId));
  });
  renderChat();
  const userMsg = chat.messages[idx - 1];
  const kind = old.kind;
  const prompt = old.image?.original || old.video?.idea || old.promptText || userMsg.content;
  await respond(chat, kind === "text" ? "chat" : kind, prompt);
}

/* ====================== Hodisalar (delegatsiya) ====================== */

function messageOf(target) {
  const id = target.closest("[data-id]")?.dataset.id;
  return id ? current()?.messages.find((m) => m.id === id) : null;
}

export function bindEvents() {
  // yon panel
  $("#history").addEventListener("click", (e) => {
    const item = e.target.closest(".history-item");
    if (!item) return;
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "open-chat") selectChat(item.dataset.id);
    if (act === "rename-chat") renameChat(item.dataset.id);
    if (act === "delete-chat") removeChat(item.dataset.id);
  });

  // chat ichidagi tugmalar
  chatEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    const m = messageOf(btn);

    if (act === "starter") {
      const s = SUGGESTIONS[Number(btn.dataset.i)];
      return sendMessage(s.text);
    }
    if (!m) return;
    const chat = current();

    if (act === "copy-msg") return copyText(m.content).then((ok) => toast(ok ? "Javob nusxalandi" : "Nusxa olib bo‘lmadi", ok ? "ok" : "error"));
    if (act === "regen" || act === "retry") return regenerate(m.id);

    if (act === "copy" || act === "download" || act === "preview") {
      const block = btn.closest(".codeblock");
      const files = collectFiles(m.content);
      const file = files.find((f) => f.index === Number(block.dataset.index));
      if (!file) return;
      if (act === "copy") return copyText(file.code).then((ok) => toast(ok ? "Kod nusxalandi" : "Nusxa olib bo‘lmadi", ok ? "ok" : "error"));
      if (act === "download") return downloadFile(file);
      return openPreview({ files, active: file.name, title: chat.title });
    }
    if (act === "project-preview") return openPreview({ files: collectFiles(m.content), title: chat.title });
    if (act === "zip") return zipFiles(collectFiles(m.content), chat.title);

    if (act === "open-image") {
      const url = await store.mediaUrl(m.image?.mediaId);
      if (url) window.open(url, "_blank", "noopener");
    }
    if (act === "img-download") {
      const blob = await store.getMedia(m.image.mediaId);
      if (blob) downloadBlob(blob, `${safeFileName(m.image.original, "zumrad-rasm")}.${m.image.mime?.includes("png") ? "png" : "jpg"}`);
    }
    if (act === "copy-prompt") return copyText(m.image?.prompt || "").then((ok) => toast(ok ? "Prompt nusxalandi" : "Nusxa olib bo‘lmadi", ok ? "ok" : "error"));
    if (act === "video-download") {
      const blob = await store.getMedia(m.video.mediaId);
      if (blob) downloadBlob(blob, `${safeFileName(m.video.title, "zumrad-video")}.${videoExtension(m.video.mime)}`);
    }
    if (act === "video-rerender" || act === "video-resume") {
      if (S.running) return;
      const v = m.video;
      if (act === "video-rerender") {
        if (v.mediaId) store.deleteMedia(v.mediaId);
        v.mediaId = null;
      }
      S.ctrl = new AbortController();
      setRunning(true);
      replaceMessage(m);
      try {
        await runVideo({ msg: m, idea: v.idea, seconds: v.seconds, aspect: v.aspect, signal: S.ctrl.signal, onUpdate: (o) => (replaceMessage(m, o), !o?.light && store.saveChat(chat)) });
      } finally {
        setRunning(false);
        S.ctrl = null;
        store.saveChat(chat);
      }
    }
  });

  // biriktirmalarni olib tashlash
  $("#attached").addEventListener("click", (e) => {
    const b = e.target.closest('[data-act="rm-att"]');
    if (!b) return;
    const [a] = S.pending.splice(Number(b.dataset.i), 1);
    if (a?.mediaId) store.deleteMedia(a.mediaId);
    renderPending();
  });

  // eksport
  $("#exportBtn").onclick = () => {
    const c = current();
    if (!c) return;
    const md =
      `# ${c.title}\n\n` +
      c.messages
        .map((m) => {
          if (m.role === "user") return `**Siz:** ${m.content}`;
          if (m.kind === "image") return `**Zumrad AI:** [rasm] ${m.image?.prompt || ""}`;
          if (m.kind === "video") return `**Zumrad AI:** [video] ${m.video?.title || ""}`;
          return `**Zumrad AI:**\n\n${m.content}`;
        })
        .join("\n\n---\n\n");
    downloadText(md, safeFileName(c.title, "zumrad-suhbat") + ".md", "text/markdown");
  };
}

/* ====================== Kiritish maydoni ====================== */

export function autosize() {
  promptEl.style.height = "auto";
  promptEl.style.height = Math.min(promptEl.scrollHeight, 220) + "px";
}

export function sendFix(message) {
  return sendMessage(`Jonli ko‘rinishda quyidagi xato chiqdi:\n${message}\n\nXatoning sababini bir-ikki gapda ayting va to‘liq tuzatilgan kodni qaytaring.`, { forceMode: "chat" });
}
