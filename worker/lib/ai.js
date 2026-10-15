// Workers AI bilan ishlash: oqimli (streaming) va oddiy javob, modellar zanjiri, xatolarni tushunarli qilish.

import { HttpError, ThinkFilter, stripThink } from "./util.js";
import { resolveModels, fallbackChain } from "./models.js";

/** Turli model javob formatlaridan matnni oladi. */
export function extractText(result) {
  if (result == null) return "";
  if (typeof result === "string") return result;
  const v =
    result.response ??
    result.result?.response ??
    result.choices?.[0]?.message?.content ??
    result.choices?.[0]?.text ??
    result.output_text ??
    "";
  return typeof v === "string" ? v : JSON.stringify(v);
}

function parseSseLine(line) {
  if (!line.startsWith("data:")) return "";
  const data = line.slice(5).trim();
  if (!data || data === "[DONE]") return "";
  try {
    const j = JSON.parse(data);
    const c = j.choices?.[0];
    if (c) return c.delta?.content ?? c.text ?? c.message?.content ?? "";
    if (typeof j.response === "string") return j.response;
  } catch {
    /* noto'g'ri bo'lak — o'tkazib yuboramiz */
  }
  return "";
}

/** Workers AI ning SSE oqimini oddiy matn bo'laklariga aylantiradi. */
export async function* streamTokens(result) {
  if (!(typeof ReadableStream !== "undefined" && result instanceof ReadableStream)) {
    const text = extractText(result);
    if (text) yield text;
    return;
  }
  const reader = result.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        const tok = parseSseLine(line);
        if (tok) yield tok;
      }
    }
    const tok = parseSseLine(buffer.trim());
    if (tok) yield tok;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* e'tiborsiz */
    }
  }
}

function buildInput(cfg, messages, { maxTokens, temperature, stream }, tokenParam = cfg.tokenParam) {
  const input = { messages, [tokenParam]: maxTokens, temperature };
  if (stream) input.stream = true;
  return input;
}

const ALT_PARAM = { max_tokens: "max_completion_tokens", max_completion_tokens: "max_tokens" };

/** Parametr nomi qabul qilinmasa, shu modelning o'zida muqobil nom bilan qayta urinadi. */
async function runModel(env, cfg, messages, opts) {
  try {
    return await env.AI.run(cfg.id, buildInput(cfg, messages, opts));
  } catch (e) {
    if (isQuotaError(e) || !/max_tokens|max_completion_tokens|unrecognized|additional ?propert|schema|validation|invalid/i.test(String(e?.message))) throw e;
    return env.AI.run(cfg.id, buildInput(cfg, messages, opts, ALT_PARAM[cfg.tokenParam] || "max_tokens"));
  }
}

export function isQuotaError(e) {
  return /daily free allocation|4006|neurons/i.test(String(e?.message || e));
}

/** Foydalanuvchiga ko'rsatiladigan tushunarli xabar. */
export function friendlyError(e) {
  if (e instanceof HttpError) return e.message;
  const msg = String(e?.message || e || "");
  if (isQuotaError(msg)) {
    return "Cloudflare’ning bugungi bepul AI limiti (kuniga 10 000 neyron) tugadi. Limit har kuni 05:00 da (O‘zbekiston vaqti) yangilanadi. Tezroq davom etish uchun Cloudflare’da Workers Paid rejasini yoqing.";
  }
  if (/safety|nsfw|flagged|inappropriate/i.test(msg)) {
    return "So‘rov xavfsizlik filtri tomonidan rad etildi. Tavsifni boshqacha yozib ko‘ring.";
  }
  if (/capacity|overloaded|3040|timeout|timed out/i.test(msg)) {
    return "AI serveri hozir band. Bir necha soniyadan keyin qayta urinib ko‘ring.";
  }
  if (/no such model|model not found|5007|unknown model/i.test(msg)) {
    return "Tanlangan AI modeli Cloudflare hisobingizda topilmadi. MODEL_* sozlamalarini tekshiring.";
  }
  return "AI javob bera olmadi: " + msg.slice(0, 200);
}

/**
 * Oqimli generatsiya. Hodisalar: {type:'model'}, {type:'token', t}.
 * Birinchi model ishlamasa (hali bironta belgi chiqmagan bo'lsa), zanjirdagi keyingisiga o'tadi.
 */
export async function* generate(env, { messages, keys, maxTokens = 2500, temperature = 0.5, signal }) {
  const models = resolveModels(env);
  let lastError;
  for (const key of keys) {
    const cfg = models[key];
    if (!cfg) continue;
    let started = false;
    try {
      const result = await runModel(env, cfg, messages, { maxTokens, temperature, stream: true });
      const filter = new ThinkFilter();
      for await (const raw of streamTokens(result)) {
        if (signal?.aborted) return;
        const out = filter.push(raw);
        if (!out) continue;
        if (!started) {
          started = true;
          yield { type: "model", key, id: cfg.id, label: cfg.label };
        }
        yield { type: "token", t: out };
      }
      const tail = filter.flush();
      if (tail) {
        if (!started) {
          started = true;
          yield { type: "model", key, id: cfg.id, label: cfg.label };
        }
        yield { type: "token", t: tail };
      }
      if (!started) throw new Error("Model bo‘sh javob qaytardi");
      return;
    } catch (e) {
      lastError = e;
      if (started) throw e; // matn allaqachon yuborilgan — modelni almashtirib bo'lmaydi
      if (isQuotaError(e)) throw e; // kvota butun hisob uchun — boshqa model yordam bermaydi
    }
  }
  throw lastError || new Error("Model topilmadi");
}

/** Oqimsiz, qisqa vazifalar uchun (prompt boyitish, video ssenariy). Matn qaytaradi. */
export async function complete(env, { messages, key = "fast", maxTokens = 600, temperature = 0.7 }) {
  const models = resolveModels(env);
  const chain = fallbackChain(key);
  let lastError;
  for (const k of chain) {
    const cfg = models[k];
    try {
      const result = await runModel(env, cfg, messages, { maxTokens, temperature, stream: false });
      const text = stripThink(extractText(result));
      if (text) return { text, model: cfg.id, key: k };
      lastError = new Error("Model bo‘sh javob qaytardi");
    } catch (e) {
      lastError = e;
      if (isQuotaError(e)) throw e;
    }
  }
  throw lastError || new Error("Model topilmadi");
}
