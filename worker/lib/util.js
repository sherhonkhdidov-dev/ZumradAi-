// Umumiy yordamchi funksiyalar (Worker uchun).

export class HttpError extends Error {
  constructor(status, message, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function clampStr(value, max) {
  return String(value ?? "").slice(0, max);
}

export function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
}

/** Uint8Array -> base64 (katta massivlar uchun bo'laklab). */
export function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64) {
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Fayl boshidagi baytlar bo'yicha rasm turini aniqlaydi. */
export function sniffImageMime(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "image/webp";
  return "image/jpeg";
}

/** Har xil ko'rinishdagi AI rasm javobini baytlarga aylantiradi. */
export async function imageResultToBytes(result) {
  if (!result) throw new HttpError(502, "Rasm modeli bo‘sh javob qaytardi.", "empty_image");
  if (typeof result === "string") return base64ToBytes(result.replace(/^data:[^,]+,/, ""));
  if (typeof result.image === "string") return base64ToBytes(result.image.replace(/^data:[^,]+,/, ""));
  if (typeof ReadableStream !== "undefined" && result instanceof ReadableStream) {
    return new Uint8Array(await new Response(result).arrayBuffer());
  }
  if (result instanceof ArrayBuffer) return new Uint8Array(result);
  if (ArrayBuffer.isView(result)) return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
  throw new HttpError(502, "Rasm modeli kutilmagan formatda javob berdi.", "bad_image");
}

/** Model "o‘ylash" bloklarini (<think>…</think>) olib tashlaydi. */
export function stripThink(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, (m) => (m.includes("<think>") ? "" : m))
    .trim();
}

/** Oqimdan kelayotgan matn bo'laklaridan <think> blokini filtrlaydi. */
export class ThinkFilter {
  constructor() {
    this.inThink = false;
    this.buffer = "";
  }
  push(chunk) {
    this.buffer += chunk;
    let out = "";
    for (;;) {
      if (this.inThink) {
        const end = this.buffer.indexOf("</think>");
        if (end === -1) {
          // oxiri hali kelmagan; ehtiyot uchun oxirgi 8 belgini saqlab qolamiz
          this.buffer = this.buffer.slice(-8);
          return out;
        }
        this.buffer = this.buffer.slice(end + 8);
        this.inThink = false;
      } else {
        const start = this.buffer.indexOf("<think>");
        if (start === -1) {
          // "<think>" boshlanishi bo'lishi mumkin bo'lgan oxirgi qismni ushlab turamiz
          const keep = partialSuffix(this.buffer, "<think>");
          out += this.buffer.slice(0, this.buffer.length - keep);
          this.buffer = this.buffer.slice(this.buffer.length - keep);
          return out;
        }
        out += this.buffer.slice(0, start);
        this.buffer = this.buffer.slice(start + 7);
        this.inThink = true;
      }
    }
  }
  flush() {
    const rest = this.inThink ? "" : this.buffer;
    this.buffer = "";
    return rest;
  }
}

function partialSuffix(text, token) {
  const max = Math.min(text.length, token.length - 1);
  for (let n = max; n > 0; n--) {
    if (token.startsWith(text.slice(text.length - n))) return n;
  }
  return 0;
}

/** Matn ichidan birinchi JSON obyektini topib, o'qiydi (model ba'zan ```json bilan o'raydi). */
export function extractJson(text) {
  const src = String(text || "").replace(/```(?:json)?/gi, "");
  const start = src.indexOf("{");
  if (start === -1) throw new Error("JSON topilmadi");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const raw = src.slice(start, i + 1);
        return parseLoose(raw);
      }
    }
  }
  throw new Error("JSON tugallanmagan");
}

function parseLoose(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    // oxirgi vergullarni olib tashlab qayta urinamiz
    return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1"));
  }
}

/** Vaqt cheklovi bilan fetch. */
export async function fetchTimeout(url, init = {}, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Doimiy vaqtli satr solishtirish (kirish kodi uchun). */
export function safeEqual(a, b) {
  const x = String(a ?? "");
  const y = String(b ?? "");
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}
