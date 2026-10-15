// Sozlamalar oynasi va mavzu (yorug' / qorong'i).

import { S } from "./state.js";
import * as store from "./store.js";
import { $, escapeHtml, icon, toast, downloadText } from "./util.js";

const dialog = $("#settings");
let afterChange = () => {};

export function initSettings({ onChange }) {
  afterChange = onChange;
  applyTheme();
  $("#openSettings").onclick = () => openSettings();
  $("#themeBtn").onclick = toggleTheme;
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  $("#settingsBody").addEventListener("click", onClick);
  $("#settingsBody").addEventListener("input", (e) => {
    if (e.target.id === "setCode") {
      S.settings.accessCode = e.target.value.trim();
      store.saveSettings(S.settings);
    }
  });
  $("#settingsBody").addEventListener("change", (e) => {
    if (e.target.id === "setAspect") {
      S.settings.imageAspect = e.target.value;
      store.saveSettings(S.settings);
      afterChange();
    }
  });
}

export function applyTheme() {
  const t = S.settings.theme;
  document.documentElement.dataset.theme = t === "light" || t === "dark" ? t : "system";
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  $("#themeBtn").innerHTML = icon(dark ? "sun" : "moon");
  $("#themeBtn").setAttribute("aria-label", dark ? "Yorug‘ mavzu" : "Qorong‘i mavzu");
}

function toggleTheme() {
  const dark = document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  S.settings.theme = dark ? "light" : "dark";
  store.saveSettings(S.settings);
  applyTheme();
}

function seg(key, options, value) {
  return `<div class="seg" role="radiogroup" data-key="${key}">${options
    .map(([v, label]) => `<button type="button" role="radio" data-v="${v}" aria-checked="${String(v) === String(value)}">${label}</button>`)
    .join("")}</div>`;
}

export function openSettings({ focusCode = false } = {}) {
  render();
  if (!dialog.open) dialog.showModal();
  if (focusCode) $("#setCode")?.focus();
}

function render() {
  const s = S.settings;
  const h = S.health;
  const models = h?.models;
  const modelNote = models
    ? `Tez: ${escapeHtml(models.fast.label)} · Aqlli: ${escapeHtml(models.smart.label)} · Kod: ${escapeHtml(models.code.label)}. “Avto” kod so‘ralganda kod modelini, qolganida tez modelni tanlaydi.`
    : "Server holati noma’lum.";
  const status = h
    ? `<ul class="status-list">
        <li data-ok="${h.ai}"><b>AI (Workers AI)</b><span>${h.ai ? "ulangan" : "ulanmagan — DEPLOY.md ni ko‘ring"}</span></li>
        <li data-ok="true"><b>Rasm</b><span>${escapeHtml(h.image.fast)} · ${escapeHtml(h.image.hq)}</span></li>
        <li data-ok="${h.video.montage}"><b>Video (kino-montaj)</b><span>${h.video.montage ? "tayyor" : "AI kerak"}</span></li>
        <li data-ok="${h.video.generative}"><b>Generativ video</b><span>${h.video.generative ? "ulangan" : "ixtiyoriy, ulanmagan"}</span></li>
        <li data-ok="true"><b>Internet qidiruvi</b><span>${escapeHtml(h.search)}</span></li>
        <li data-ok="${!h.accessCode || Boolean(s.accessCode)}"><b>Kirish kodi</b><span>${h.accessCode ? "talab qilinadi" : "o‘rnatilmagan (ochiq)"}</span></li>
      </ul>`
    : `<p class="note err">Serverga ulanib bo‘lmadi. Sayt Cloudflare Worker orqali ochilganini tekshiring.</p>`;

  $("#settingsBody").innerHTML = `
    <section><h3>Ko‘rinish</h3>
      <div class="row"><label>Mavzu</label>${seg("theme", [["system", "Tizim"], ["light", "Yorug‘"], ["dark", "Qorong‘i"]], s.theme)}</div>
    </section>
    <section><h3>Suhbat</h3>
      <div class="row"><label>Model</label>${seg("model", [["auto", "Avto"], ["fast", "Tez"], ["smart", "Aqlli"], ["code", "Kod"]], s.model)}</div>
      <p class="hint">${modelNote}</p>
      <div class="row"><label>Internet qidiruvi</label>${seg("web", [["auto", "Avto"], ["on", "Doim"], ["off", "O‘chiq"]], s.web)}</div>
      <p class="hint">“Avto” — yangilik, narx, bugungi voqealar kabi savollarda qidiradi.</p>
    </section>
    <section><h3>Rasm</h3>
      <div class="row"><label>Sifat</label>${seg("imageQuality", [["fast", "Tez"], ["hq", "Sifatli"]], s.imageQuality)}</div>
      <div class="row"><label for="setAspect">Format (Sifatli)</label>
        <select id="setAspect">${["1:1", "16:9", "9:16", "4:3", "3:4"].map((a) => `<option ${a === s.imageAspect ? "selected" : ""}>${a}</option>`).join("")}</select></div>
      <p class="hint">“Tez” — FLUX.1 schnell, kuniga yuzlab rasm. “Sifatli” — Lucid Origin, har rasm bepul kvotaning katta qismini (~1500 neyron) sarflaydi.</p>
    </section>
    <section><h3>Video</h3>
      <div class="row"><label>Davomiyligi</label>${seg("videoSeconds", [[10, "10 s"], [20, "20 s"], [30, "30 s"]], s.videoSeconds)}</div>
      <div class="row"><label>Format</label>${seg("videoAspect", [["16:9", "16:9"], ["9:16", "9:16"], ["1:1", "1:1"]], s.videoAspect)}</div>
    </section>
    <section><h3>Kirish kodi</h3>
      <div class="row"><input id="setCode" type="password" autocomplete="off" placeholder="Agar sayt himoyalangan bo‘lsa" value="${escapeHtml(s.accessCode)}"></div>
      <p class="hint">Kod faqat shu brauzerda saqlanadi va har so‘rov bilan yuboriladi.</p>
    </section>
    <section><h3>Server holati</h3>${status}</section>
    <section><h3>Ma’lumotlar</h3>
      <p class="hint">Suhbatlar, rasmlar va videolar faqat shu qurilmaning brauzerida saqlanadi.</p>
      <div class="row wrap"><button type="button" class="chip" data-act="export-all">${icon("download", "sm")}Suhbatlarni yuklab olish (JSON)</button><button type="button" class="chip danger" data-act="wipe">${icon("trash", "sm")}Hammasini o‘chirish</button></div>
    </section>`;
}

async function onClick(e) {
  const b = e.target.closest("button");
  if (!b) return;
  const group = b.closest(".seg");
  if (group && b.dataset.v !== undefined) {
    const key = group.dataset.key;
    const raw = b.dataset.v;
    S.settings[key] = key === "videoSeconds" ? Number(raw) : raw;
    store.saveSettings(S.settings);
    if (key === "theme") applyTheme();
    render();
    afterChange();
    return;
  }
  if (b.dataset.act === "export-all") {
    const chats = S.chats.filter((c) => c.messages.length).map((c) => ({ ...c, messages: c.messages.map(({ streaming, ...m }) => m) }));
    downloadText(JSON.stringify(chats, null, 2), "zumrad-suhbatlar.json", "application/json");
  }
  if (b.dataset.act === "wipe") {
    if (!confirm("Barcha suhbatlar, rasmlar va videolar o‘chiriladi. Davom etasizmi?")) return;
    await store.clearAll();
    S.chats = [];
    S.cur = null;
    dialog.close();
    toast("Hammasi o‘chirildi");
    afterChange({ wiped: true });
  }
}
