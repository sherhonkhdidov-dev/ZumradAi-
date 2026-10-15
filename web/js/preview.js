// O'ng panel: AI yozgan kodning jonli ko'rinishi (xavfsiz sandbox), kod ko'rinishi, ZIP.

import { $, $$, escapeHtml, downloadBlob, downloadText, copyText, toast, icon, safeFileName } from "./util.js";
import { isPreviewable } from "./markdown.js";
import hljs from "../vendor/hljs.js";

const state = { files: [], active: "", title: "", tab: "preview", width: 0, html: "" };
let onFix = null;

const basename = (p) => String(p).split(/[?#]/)[0].split("/").pop();

// Sandbox ichida localStorage ishlamaydi — kod buzilmasligi uchun xotiradagi nusxa beramiz,
// va xatolarni panelga yuboramiz ("AI bilan tuzatish" uchun).
const INJECT = `<script>(function(){
try{localStorage.getItem('_')}catch(e){var mk=function(){var m=new Map();return{getItem:function(k){return m.has(k)?m.get(k):null},setItem:function(k,v){m.set(k,String(v))},removeItem:function(k){m.delete(k)},clear:function(){m.clear()},key:function(i){return Array.from(m.keys())[i]||null},get length(){return m.size}}};
try{Object.defineProperty(window,'localStorage',{value:mk(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:mk(),configurable:true})}catch(_){}}
function send(msg){try{parent.postMessage({zumrad:'error',message:String(msg).slice(0,400)},'*')}catch(_){}}
window.addEventListener('error',function(e){send((e.message||'Xato')+(e.lineno?' (qator '+e.lineno+')':''))});
window.addEventListener('unhandledrejection',function(e){send('Promise xatosi: '+((e.reason&&e.reason.message)||e.reason))});
})();<\/script>`;

export function bundleHtml(files, entryName) {
  const entry = files.find((f) => f.name === entryName) || files.find((f) => /\.html?$/i.test(f.name)) || files.find(isPreviewable);
  if (!entry) return "";
  let html = entry.code;
  if (/\.svg$/i.test(entry.name) || (entry.lang === "svg" && !/<html/i.test(html))) {
    html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%}body{display:grid;place-items:center;background:#fff}svg{max-width:100%;max-height:100vh}</style></head><body>${html}</body></html>`;
  } else if (!/<html[\s>]/i.test(html)) {
    html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
  }
  const find = (href) => files.find((f) => f.name === href || basename(f.name) === basename(href));

  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel=["']?stylesheet/i.test(tag)) return tag;
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    const f = href && !/^(https?:)?\/\//i.test(href) ? find(href) : null;
    return f ? `<style>\n${f.code}\n</style>` : tag;
  });
  html = html.replace(/<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (m, a, src, b) => {
    const f = !/^(https?:)?\/\//i.test(src) ? find(src) : null;
    return f ? `<script${a}${b}>\n${f.code.replace(/<\/script/gi, "<\\/script")}\n<\/script>` : m;
  });

  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + INJECT);
  else html = INJECT + html;
  return html;
}

export function zipFiles(files, name = "zumrad-loyiha") {
  if (!window.JSZip) {
    toast("ZIP kutubxonasi yuklanmadi", "error");
    return;
  }
  const zip = new window.JSZip();
  files.forEach((f) => zip.file(f.name, f.code));
  zip.generateAsync({ type: "blob", compression: "DEFLATE" }).then((blob) => downloadBlob(blob, safeFileName(name, "zumrad-loyiha") + ".zip"));
}

export function downloadFile(file) {
  downloadText(file.code, basename(file.name) || "fayl.txt");
}

export function isOpen() {
  return $("#app").dataset.panel === "open";
}

export function openPreview({ files, active, title = "Loyiha", tab }) {
  state.files = files;
  state.title = title;
  const entry = active && files.find((f) => f.name === active);
  const firstPrev = files.find(isPreviewable);
  state.active = entry ? entry.name : (firstPrev || files[0])?.name || "";
  state.tab = tab || (firstPrev ? "preview" : "code");
  $("#app").dataset.panel = "open";
  render();
}

export function closePreview() {
  $("#app").dataset.panel = "closed";
  const frame = $("#frame");
  frame.srcdoc = "";
  state.html = "";
}

function render() {
  const hasPreview = state.files.some(isPreviewable);
  $("#tabPreview").hidden = !hasPreview;
  $("#devices").hidden = !hasPreview || state.tab !== "preview";
  $("#panelReload").hidden = !hasPreview || state.tab !== "preview";
  if (!hasPreview) state.tab = "code";
  $("#tabPreview").setAttribute("aria-selected", String(state.tab === "preview"));
  $("#tabCode").setAttribute("aria-selected", String(state.tab === "code"));
  $("#stage").hidden = state.tab !== "preview";
  $("#files").hidden = state.tab !== "code";
  clearBanner();

  if (state.tab === "preview") {
    state.html = bundleHtml(state.files, state.active);
    const frame = $("#frame");
    frame.srcdoc = state.html;
    applyWidth();
  } else {
    renderCode();
  }
}

function applyWidth() {
  const frame = $("#frame");
  frame.style.maxWidth = state.width ? state.width + "px" : "none";
  frame.classList.toggle("device", Boolean(state.width));
  $$("#devices button").forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.w) === state.width)));
}

function renderCode() {
  const host = $("#files");
  const tabs = state.files
    .map((f) => `<button type="button" class="file-tab" data-file="${escapeHtml(f.name)}" aria-selected="${f.name === state.active}">${escapeHtml(f.name)}</button>`)
    .join("");
  const file = state.files.find((f) => f.name === state.active) || state.files[0];
  let body = "";
  if (file) {
    let html;
    try {
      html = hljs.getLanguage(file.lang) ? hljs.highlight(file.code, { language: file.lang, ignoreIllegals: true }).value : escapeHtml(file.code);
    } catch {
      html = escapeHtml(file.code);
    }
    body = `<div class="code-view"><div class="code-view-bar"><span>${file.code.split("\n").length} qator</span><span><button type="button" class="cb-btn" data-pact="copy">${icon("copy", "sm")}<span>Nusxa</span></button><button type="button" class="cb-btn" data-pact="download">${icon("download", "sm")}<span>Yuklash</span></button></span></div><pre><code class="hljs">${html}</code></pre></div>`;
  }
  host.innerHTML = `<div class="file-tabs">${tabs}</div>${body}`;
}

function showBanner(message) {
  const stage = $("#stage");
  let b = $("#errBanner");
  if (!b) {
    b = document.createElement("div");
    b.id = "errBanner";
    b.className = "err-banner";
    stage.appendChild(b);
  }
  b.innerHTML = `<span class="err-text"></span><button type="button" class="cb-btn strong" data-pact="fix">AI bilan tuzatish</button><button type="button" class="icon-btn" data-pact="dismiss" aria-label="Yopish">${icon("x", "sm")}</button>`;
  b.querySelector(".err-text").textContent = message;
  b.dataset.message = message;
}

function clearBanner() {
  $("#errBanner")?.remove();
}

export function bindPanel({ fix }) {
  onFix = fix;
  $("#panelClose").onclick = closePreview;
  $("#panelReload").onclick = render;
  $("#panelOpen").onclick = () => {
    if (state.tab === "preview" && state.html) {
      downloadText(state.html.replace(INJECT, ""), safeFileName(state.title, "sahifa") + ".html", "text/html");
    } else {
      const f = state.files.find((x) => x.name === state.active);
      if (f) downloadFile(f);
    }
  };
  $("#tabPreview").onclick = () => {
    state.tab = "preview";
    render();
  };
  $("#tabCode").onclick = () => {
    state.tab = "code";
    render();
  };
  $("#devices").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-w]");
    if (!b) return;
    state.width = Number(b.dataset.w);
    applyWidth();
  });
  $("#files").addEventListener("click", (e) => {
    const tab = e.target.closest(".file-tab");
    if (tab) {
      state.active = tab.dataset.file;
      renderCode();
      return;
    }
    const act = e.target.closest("[data-pact]")?.dataset.pact;
    const file = state.files.find((f) => f.name === state.active);
    if (act === "copy" && file) copyText(file.code).then((ok) => toast(ok ? "Nusxa olindi" : "Nusxa olib bo‘lmadi", ok ? "ok" : "error"));
    if (act === "download" && file) downloadFile(file);
  });
  $("#stage").addEventListener("click", (e) => {
    const act = e.target.closest("[data-pact]")?.dataset.pact;
    if (act === "dismiss") clearBanner();
    if (act === "fix") {
      const msg = $("#errBanner")?.dataset.message;
      clearBanner();
      if (msg && onFix) onFix(msg, state.files);
    }
  });
  window.addEventListener("message", (e) => {
    if (e.source !== $("#frame").contentWindow) return;
    if (e.data && e.data.zumrad === "error" && state.tab === "preview") showBanner(e.data.message);
  });
}
