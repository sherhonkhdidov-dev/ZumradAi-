// Zumrad AI — Cloudflare Worker (API + statik sayt).
// Endpointlar: /api/health, /api/chat (SSE), /api/image, /api/video/plan,
//              /api/video/generate, /api/video/status, /api/search

import { HttpError, json, clampStr, clampInt, safeEqual } from "./lib/util.js";
import { generate, friendlyError } from "./lib/ai.js";
import { resolveModels, pickModelKey, fallbackChain, IMAGE_MODELS, VIDEO_MODEL } from "./lib/models.js";
import { buildSystemPrompt } from "./lib/prompts.js";
import { searchWeb, wantsSearch, formatSourcesForPrompt } from "./lib/search.js";
import { generateImage } from "./lib/image.js";
import { planVideo, startReplicateVideo, replicateStatus, replicateConfigured } from "./lib/video.js";

const VERSION = "2.0.0";
const MAX_HISTORY_MESSAGES = 24;
const MAX_HISTORY_CHARS = 70_000;
const IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
    }
    try {
      return await route(request, env, ctx, url);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
      console.error("API xatosi:", e?.stack || e);
      return json({ error: friendlyError(e), code: "ai_error" }, 500);
    }
  },
};

async function route(request, env, ctx, url) {
  const { pathname } = url;
  const method = request.method;

  if (pathname === "/api/health" && method === "GET") return health(env);

  guard(request, env, url);

  if (pathname === "/api/chat" && method === "POST") {
    rateLimit(request, "chat", 30);
    return handleChat(request, env);
  }
  if (pathname === "/api/image" && method === "POST") {
    rateLimit(request, "image", 14);
    const b = await readJson(request);
    const data = await generateImage(env, {
      prompt: b.prompt,
      quality: b.quality === "hq" ? "hq" : "fast",
      aspect: String(b.aspect || "1:1"),
      enhance: b.enhance !== false,
    });
    return json(data);
  }
  if (pathname === "/api/video/plan" && method === "POST") {
    rateLimit(request, "plan", 8);
    const b = await readJson(request);
    return json(await planVideo(env, { idea: b.idea, seconds: b.seconds, aspect: String(b.aspect || "16:9") }));
  }
  if (pathname === "/api/video/generate" && method === "POST") {
    rateLimit(request, "vgen", 4);
    const b = await readJson(request);
    return json(await startReplicateVideo(env, { prompt: b.prompt }));
  }
  if (pathname === "/api/video/status" && method === "GET") {
    return json(await replicateStatus(env, url.searchParams.get("id") || ""));
  }
  if (pathname === "/api/search" && method === "GET") {
    rateLimit(request, "search", 20);
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) throw new HttpError(400, "q parametrini kiriting.");
    return json({ query: q, ...(await searchWeb(env, q)) });
  }
  throw new HttpError(404, "API endpoint topilmadi.", "not_found");
}

/* ---------------- xavfsizlik ---------------- */

function guard(request, env, url) {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin) {
      let host = "";
      try {
        host = new URL(origin).host;
      } catch {
        /* noto'g'ri origin */
      }
      if (host !== url.host) throw new HttpError(403, "So‘rov boshqa saytdan keldi (origin).", "bad_origin");
    }
  }
  if (env.ACCESS_CODE && !safeEqual(request.headers.get("x-access-code"), env.ACCESS_CODE)) {
    throw new HttpError(401, "Kirish kodi noto‘g‘ri yoki kiritilmagan.", "access_code");
  }
}

// Oddiy (har bir isolate uchun) tezlik cheklovi. To'liq himoya uchun Cloudflare Rate Limiting qoidalaridan foydalaning.
const buckets = new Map();
function rateLimit(request, name, perMinute) {
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const key = `${name}:${ip}`;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > 60_000) b = { start: now, n: 0 };
  b.n++;
  buckets.set(key, b);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now - v.start > 60_000) buckets.delete(k);
  }
  if (b.n > perMinute) throw new HttpError(429, "Juda ko‘p so‘rov. Bir daqiqadan keyin urinib ko‘ring.", "rate_limited");
}

async function readJson(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > 12_000_000) throw new HttpError(413, "So‘rov hajmi juda katta.");
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "So‘rov JSON formatida bo‘lishi kerak.");
  }
}

/* ---------------- health ---------------- */

function health(env) {
  const models = resolveModels(env);
  return json({
    ok: true,
    version: VERSION,
    ai: Boolean(env.AI),
    accessCode: Boolean(env.ACCESS_CODE),
    models: Object.fromEntries(["fast", "smart", "code"].map((k) => [k, { id: models[k].id, label: models[k].label }])),
    image: { fast: IMAGE_MODELS.fast.label, hq: IMAGE_MODELS.hq.label },
    videoLabel: VIDEO_MODEL.label,
    search: env.TAVILY_API_KEY ? "tavily" : env.BRAVE_API_KEY ? "brave" : "duckduckgo",
    video: { montage: Boolean(env.AI), generative: replicateConfigured(env) },
  });
}

/* ---------------- chat ---------------- */

function normalizeMessages(raw) {
  const out = [];
  for (const m of raw) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    const content = clampStr(m.content, 60_000);
    if (!content.trim() && !(m.images && m.images.length)) continue;
    const images = Array.isArray(m.images) ? m.images.filter((u) => typeof u === "string" && u.length < 4_500_000 && IMAGE_DATA_URL.test(u)).slice(0, 3) : [];
    out.push({ role: m.role, content, images });
  }
  // Oxiridan boshlab hajm chegarasiga sig'diramiz
  const kept = [];
  let total = 0;
  for (let i = out.length - 1; i >= 0 && kept.length < MAX_HISTORY_MESSAGES; i--) {
    total += out[i].content.length;
    if (total > MAX_HISTORY_CHARS && kept.length) break;
    kept.unshift(out[i]);
  }
  while (kept.length && kept[0].role !== "user") kept.shift();
  return kept;
}

async function handleChat(request, env) {
  if (!env.AI) {
    throw new HttpError(503, "AI ulanmagan. Cloudflare’da Workers AI binding (nomi: AI) qo‘shing — DEPLOY.md ga qarang.", "no_ai");
  }
  const body = await readJson(request);
  const messages = normalizeMessages(Array.isArray(body.messages) ? body.messages : []);
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") throw new HttpError(400, "Oxirgi xabar foydalanuvchidan bo‘lishi kerak.");

  const hasImages = last.images.length > 0;
  const modelKey = pickModelKey(body.model, { text: last.content, hasImages });
  const keys = fallbackChain(modelKey, { hasImages });
  const models = resolveModels(env);

  // Internet qidiruvi
  const webMode = body.web === "on" || body.web === "off" ? body.web : "auto";
  let sources = [];
  let searchProvider = null;
  if (webMode === "on" || (webMode === "auto" && wantsSearch(last.content))) {
    const found = await searchWeb(env, last.content.slice(0, 300));
    sources = found.results;
    searchProvider = found.provider;
  }

  const system = buildSystemPrompt({ codeMode: modelKey === "code", hasSources: sources.length > 0 });
  const modelMessages = [{ role: "system", content: system }];
  messages.forEach((m, i) => {
    const isLast = i === messages.length - 1;
    let text = m.content;
    if (isLast && sources.length) {
      text += `\n\n---\nInternet qidiruv natijalari (ularga [1], [2] deb havola bering):\n${formatSourcesForPrompt(sources)}`;
    }
    if (isLast && hasImages && models[keys[0]].vision) {
      modelMessages.push({
        role: "user",
        content: [{ type: "text", text: text || "Rasmni tasvirlab ber." }, ...m.images.map((url) => ({ type: "image_url", image_url: { url } }))],
      });
    } else {
      modelMessages.push({ role: m.role, content: text });
    }
  });

  const maxTokens = clampInt(body.max_tokens, 200, 6000, modelKey === "code" ? 4500 : 2500);
  const temperature = modelKey === "code" ? 0.25 : 0.55;

  // Oqimsiz rejim (testlar va oddiy mijozlar uchun)
  if (body.stream === false) {
    let text = "";
    let model = null;
    for await (const ev of generate(env, { messages: modelMessages, keys, maxTokens, temperature })) {
      if (ev.type === "model") model = ev;
      if (ev.type === "token") text += ev.t;
    }
    return json({ reply: text, model, sources, searchProvider });
  }

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        send({ type: "meta", modelKey, sources, searchProvider });
        for await (const ev of generate(env, { messages: modelMessages, keys, maxTokens, temperature, signal: { get aborted() { return cancelled; } } })) {
          send(ev);
          if (cancelled) break;
        }
        send({ type: "done" });
      } catch (e) {
        try {
          send({ type: "error", message: friendlyError(e) });
        } catch {
          /* mijoz uzilgan */
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* allaqachon yopilgan */
        }
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
