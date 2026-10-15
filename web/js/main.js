// Zumrad AI — ishga tushirish.

import { S, current } from "./state.js";
import * as store from "./store.js";
import { getHealth } from "./api.js";
import { bindPanel, closePreview, isOpen } from "./preview.js";
import { initSettings, openSettings, applyTheme } from "./settings.js";
import {
  newChat, renderAll, bindEvents, initScroll, addFiles, submit, autosize, closeSide, sendFix, hooks, renderPending,
} from "./chat.js";
import { $, $$, toast, escapeHtml } from "./util.js";

const promptEl = $("#prompt");
hooks.openSettings = openSettings;

/* ---------- rejimlar ---------- */

const PLACEHOLDERS = {
  auto: "Zumrad AI’ga yozing…",
  chat: "Savol bering yoki kod so‘rang…",
  image: "Qanday rasm chizay? Masalan: kechki Registon, iliq chiroqlar",
  video: "Qanday video yarataylik? G‘oyani yozing",
};

function setMode(mode) {
  S.mode = mode;
  $$("#modes button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === mode)));
  promptEl.placeholder = PLACEHOLDERS[mode];
  renderModeOptions();
}

function miniSeg(key, options, value) {
  return `<span class="mini-seg" role="radiogroup" data-key="${key}">${options
    .map(([v, l]) => `<button type="button" role="radio" data-v="${v}" aria-checked="${String(v) === String(value)}">${l}</button>`)
    .join("")}</span>`;
}

function renderModeOptions() {
  const host = $("#modeOptions");
  const s = S.settings;
  if (S.mode === "image") {
    host.hidden = false;
    host.innerHTML = `<span class="opt-label">Sifat</span>${miniSeg("imageQuality", [["fast", "Tez"], ["hq", "Sifatli"]], s.imageQuality)}
      ${s.imageQuality === "hq" ? `<span class="opt-label">Format</span>${miniSeg("imageAspect", [["1:1", "1:1"], ["16:9", "16:9"], ["9:16", "9:16"], ["4:3", "4:3"]], s.imageAspect)}` : `<span class="opt-note">Kvadrat, ~10 soniya</span>`}`;
  } else if (S.mode === "video") {
    host.hidden = false;
    const gen = S.health?.video?.generative;
    host.innerHTML = `<span class="opt-label">Davomiyligi</span>${miniSeg("videoSeconds", [[10, "10 s"], [20, "20 s"], [30, "30 s"]], s.videoSeconds)}
      <span class="opt-label">Format</span>${miniSeg("videoAspect", [["16:9", "16:9"], ["9:16", "9:16"], ["1:1", "1:1"]], s.videoAspect)}
      ${gen ? `<span class="opt-label">Usul</span>${miniSeg("generative", [["no", "Kino-montaj"], ["yes", "Generativ"]], S.generative ? "yes" : "no")}` : ""}`;
  } else {
    host.hidden = true;
    host.innerHTML = "";
  }
}

function updateWebButton() {
  const on = S.settings.web === "on";
  const off = S.settings.web === "off";
  const b = $("#webBtn");
  b.setAttribute("aria-pressed", String(on));
  b.classList.toggle("off", off);
  b.title = on ? "Internetdan qidirish: doim yoqilgan" : off ? "Internetdan qidirish: o‘chirilgan" : "Internetdan qidirish: avto (kerak bo‘lsa)";
}

/* ---------- ishga tushirish ---------- */

async function boot() {
  initSettings({
    onChange: (opts = {}) => {
      updateWebButton();
      renderModeOptions();
      if (opts.wiped) newChat({ focus: false });
    },
  });
  bindPanel({ fix: (msg) => sendFix(msg) });
  bindEvents();
  initScroll();

  // saqlangan suhbatlar
  S.chats = await store.loadChats();
  const media = S.chats;
  // jarayonda qolib ketgan (sahifa yopilgan) rasm/video xabarlarini "to'xtatilgan" deb belgilaymiz
  for (const c of media) {
    for (const m of c.messages) {
      if (m.image?.status === "loading") m.image = { ...m.image, status: "error", error: "Sahifa yopilgani uchun to‘xtatildi." };
      if (m.video && !["done", "error"].includes(m.video.status)) {
        m.video.status = "error";
        m.video.error = "Sahifa yopilgani uchun to‘xtatildi.";
      }
      if (m.streaming) {
        m.streaming = false;
        m.meta = { ...(m.meta || {}), stopped: true };
      }
    }
  }
  S.cur = S.chats.find((c) => c.messages.length)?.id || null;
  if (!S.cur) newChat({ focus: false });
  else renderAll();
  if (store.isMemoryMode()) toast("Brauzer xotirasi cheklangan: suhbatlar sahifa yopilganda yo‘qoladi", "error", 6000);

  updateWebButton();
  setMode("auto");

  // server holati
  getHealth().then((h) => {
    S.health = h;
    renderModeOptions();
    if (!h) return toast("Serverga ulanib bo‘lmadi. Sayt Cloudflare Worker orqali ochilganini tekshiring.", "error", 6000);
    if (!h.ai) toast("AI ulanmagan: Cloudflare’da Workers AI binding (AI) qo‘shing — DEPLOY.md.", "error", 8000);
    if (h.accessCode && !S.settings.accessCode) setTimeout(() => openSettings({ focusCode: true }), 400);
  });
}

/* ---------- hodisalar ---------- */

$("#composer").addEventListener("submit", (e) => {
  e.preventDefault();
  submit();
});
promptEl.addEventListener("input", autosize);
promptEl.addEventListener("keydown", (e) => {
  const touch = matchMedia("(pointer:coarse)").matches;
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !touch) {
    e.preventDefault();
    submit();
  }
});
promptEl.addEventListener("paste", (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) {
    e.preventDefault();
    addFiles(files);
  }
});

$("#attachBtn").onclick = () => $("#fileInput").click();
$("#fileInput").onchange = (e) => {
  addFiles(e.target.files);
  e.target.value = "";
};
["dragenter", "dragover"].forEach((t) =>
  window.addEventListener(t, (e) => {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      document.body.classList.add("dragging");
    }
  }),
);
["dragleave", "drop"].forEach((t) =>
  window.addEventListener(t, (e) => {
    if (t === "dragleave" && e.relatedTarget) return;
    document.body.classList.remove("dragging");
    if (t === "drop" && e.dataTransfer?.files?.length) {
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    }
  }),
);

$("#modes").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-mode]");
  if (b) setMode(b.dataset.mode);
});
$("#modeOptions").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-v]");
  if (!b) return;
  const key = b.closest(".mini-seg").dataset.key;
  if (key === "generative") S.generative = b.dataset.v === "yes";
  else S.settings[key] = key === "videoSeconds" ? Number(b.dataset.v) : b.dataset.v;
  store.saveSettings(S.settings);
  renderModeOptions();
});
$("#webBtn").onclick = () => {
  S.settings.web = S.settings.web === "on" ? "auto" : "on";
  store.saveSettings(S.settings);
  updateWebButton();
  toast(S.settings.web === "on" ? "Har savolda internetdan qidiriladi" : "Internet qidiruvi: avto");
};

$("#newChat").onclick = () => newChat();
$("#menuBtn").onclick = () => ($("#app").dataset.side = "open");
$("#sideClose").onclick = closeSide;
$("#scrim").onclick = closeSide;

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    newChat();
  }
  if (e.key === "Escape") {
    if (isOpen()) closePreview();
    closeSide();
  }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

boot().catch((e) => {
  console.error(e);
  toast("Ilovani ishga tushirishda xato: " + e.message, "error", 8000);
});

// PWA (faqat haqiqiy domen/https da)
if ("serviceWorker" in navigator && location.protocol === "https:" && !/^(localhost|127\.)/.test(location.hostname)) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
