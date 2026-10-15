// Backend bilan aloqa: chat (SSE oqim), rasm, video ssenariy, holat.

import { loadSettings } from "./store.js";

export class ApiError extends Error {
  constructor(message, { status = 0, code = "error" } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function headers(extra = {}) {
  const h = { "content-type": "application/json", ...extra };
  const code = loadSettings().accessCode;
  if (code) h["x-access-code"] = code;
  return h;
}

async function toError(res) {
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* JSON emas */
  }
  const fallback = res.status === 404 ? "API topilmadi. Loyiha Cloudflare Worker orqali ishga tushirilganini tekshiring." : `Server xatosi (HTTP ${res.status}).`;
  return new ApiError(data.error || fallback, { status: res.status, code: data.code || "http_" + res.status });
}

async function request(path, body, { signal } = {}) {
  let res;
  try {
    res = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body), signal });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ApiError("Serverga ulanib bo‘lmadi. Internetni tekshiring.", { code: "network" });
  }
  if (!res.ok) throw await toError(res);
  return res;
}

export async function getHealth() {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Chat javobini oqim sifatida qaytaradi: {type:'meta'|'model'|'token'|'done'|'error'} */
export async function* streamChat({ messages, model, web, signal }) {
  const res = await request("/api/chat", { messages, model, web }, { signal });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = block.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        yield JSON.parse(line.slice(5));
      } catch {
        /* buzilgan bo'lak */
      }
    }
  }
}

export async function generateImage({ prompt, quality, aspect, enhance = true, signal }) {
  const res = await request("/api/image", { prompt, quality, aspect, enhance }, { signal });
  return res.json();
}

export async function planVideo({ idea, seconds, aspect, signal }) {
  const res = await request("/api/video/plan", { idea, seconds, aspect }, { signal });
  return res.json();
}

export async function startGenerativeVideo({ prompt, signal }) {
  const res = await request("/api/video/generate", { prompt }, { signal });
  return res.json();
}

export async function generativeVideoStatus(id, { signal } = {}) {
  const res = await fetch("/api/video/status?id=" + encodeURIComponent(id), { headers: headers(), signal });
  if (!res.ok) throw await toError(res);
  return res.json();
}
