// Umumiy yordamchi funksiyalar (frontend).

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function icon(name, cls = "") {
  return `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

export function toast(message, kind = "info", ms = 3200) {
  const host = $("#toasts");
  if (!host) return;
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 260);
  }, ms);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const downloadText = (text, filename, type = "text/plain") =>
  downloadBlob(new Blob([text], { type: type + ";charset=utf-8" }), filename);

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function formatBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}

export function b64ToBlob(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Rasmni kichraytirib JPEG/PNG Blob qiladi (AI ga yuborish uchun). */
export async function downscaleImage(file, maxSide = 1280, quality = 0.86) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  return { blob, width: w, height: h };
}

const TEXT_EXT =
  /\.(txt|md|markdown|json|jsonl|js|mjs|cjs|ts|tsx|jsx|vue|svelte|py|html?|css|scss|sass|less|sql|xml|ya?ml|toml|ini|env|sh|bash|zsh|bat|ps1|java|kt|kts|swift|c|h|cpp|hpp|cc|cs|go|rs|php|rb|dart|lua|r|csv|tsv|log|gradle|properties|dockerfile)$/i;

export const isTextFile = (f) => f.type.startsWith("text/") || /json|xml|javascript/.test(f.type) || TEXT_EXT.test(f.name) || /^(dockerfile|makefile)$/i.test(f.name);
export const isImageFile = (f) => /^image\/(png|jpe?g|webp|gif)$/.test(f.type);

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** "Bugun / Kecha / Shu hafta / Oldinroq" guruhlari uchun. */
export function dateGroup(ts) {
  const d = new Date(ts);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays <= 0) return "Bugun";
  if (diffDays === 1) return "Kecha";
  if (diffDays < 7) return "Shu hafta";
  return "Oldinroq";
}

export function safeFileName(s, fallback = "zumrad") {
  const cleaned = String(s || "").replace(/[^\p{L}\p{N}\-_. ]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 48);
  return cleaned || fallback;
}
