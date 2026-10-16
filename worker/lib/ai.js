// Zumrad AI miya darvozasi: bir necha BEPUL manba ketma-ket urinib ko'riladi.
// Tartib: o'z serveringiz (OWN_MODEL_URL) → Gemini → Groq → Cloudflare Workers AI.
// Biri limitga yetsa yoki xato bersa, keyingisiga o'tadi — shuning uchun ish to'xtab qolmaydi.
import { HttpError } from "./util.js";

const NOT_CONFIGURED = "Zumrad AI’ga hali miya ulanmagan. Cloudflare’da GEMINI_API_KEY (bepul, aistudio.google.com) yoki GROQ_API_KEY qo‘shing, yoki OWN_MODEL_URL ni sozlang.";

export function providerNames(env) {
  const names = [];
  if (env.OWN_MODEL_URL) names.push("own");
  if (env.GEMINI_API_KEY) names.push("gemini");
  if (env.GROQ_API_KEY) names.push("groq");
  if (env.AI && typeof env.AI.run === "function") names.push("workers-ai");
  return names;
}

export function hasBrain(env) {
  return providerNames(env).length > 0;
}

function ownModelUrl(env) {
  const base = String(env.OWN_MODEL_URL || "").trim().replace(/\/+$/, "");
  if (!base) throw new HttpError(503, NOT_CONFIGURED, "own_model_not_configured");
  return base;
}

function flatten(content) {
  if (!Array.isArray(content)) return String(content ?? "");
  return content.map((p) => (typeof p === "string" ? p : p?.text || "")).join(" ");
}

async function askOwn(env, { messages, maxTokens = 600, temperature = 0.6 }) {
  const base = ownModelUrl(env);
  // OWN_MODEL_API=openai — o'zingiz joylagan llama.cpp/vLLM kabi OpenAI-mos server (Hugging Face Space va h.k.).
  const openai = String(env.OWN_MODEL_API || "").toLowerCase() === "openai";
  const headers = { "content-type": "application/json" };
  if (env.OWN_MODEL_TOKEN) headers.authorization = `Bearer ${env.OWN_MODEL_TOKEN}`;
  const url = openai ? `${base}/v1/chat/completions` : `${base}/api/chat`;
  const body = openai
    ? {
        model: "zumrad",
        messages: messages.map((m) => ({ role: m.role, content: flatten(m.content) })),
        max_tokens: Math.min(maxTokens, 2000),
        temperature,
        stream: false,
      }
    : { messages, max_new_tokens: Math.min(maxTokens, 1000), temperature };
  let response;
  try {
    response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    throw new HttpError(503, "O‘z Zumrad model serveriga ulanib bo‘lmadi. Server manzili va internet aloqasini tekshiring.", "own_model_unreachable");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(response.status === 404 ? 503 : 502,
    data.detail || data.error?.message || data.error || "O‘z model serveri javob bermadi.", "own_model_error");
  const reply = openai
    ? String(data.choices?.[0]?.message?.content || "")
    : (typeof data.reply === "string" ? data.reply : "");
  if (!reply.trim()) throw new HttpError(502, "O‘z modelimiz bo‘sh javob qaytardi.", "own_model_empty");
  return { text: reply, model: data.model || "Zumrad Own Model", key: "own" };
}

async function askOpenAICompat(url, key, model, label, messages, maxTokens, temperature) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: flatten(m.content) })),
        max_tokens: Math.min(maxTokens, 4000),
        temperature,
        stream: false,
      }),
    });
  } catch {
    throw new HttpError(503, `${label} bilan aloqa yo‘q.`, "provider_unreachable");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 502,
    data.error?.message || `${label} javob bermadi (HTTP ${response.status}).`, "provider_error");
  const reply = String(data.choices?.[0]?.message?.content || "");
  if (!reply.trim()) throw new HttpError(502, `${label} bo‘sh javob qaytardi.`, "provider_empty");
  return { text: reply, model: label, key: "ai" };
}

async function askWorkersAI(env, messages, maxTokens, temperature) {
  const id = env.WORKERS_AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  const out = await env.AI.run(id, {
    messages: messages.map((m) => ({ role: m.role, content: flatten(m.content) })),
    max_tokens: Math.min(maxTokens, 2000),
    temperature,
  });
  const reply = String(out?.response ?? out?.result?.response ?? "");
  if (!reply.trim()) throw new HttpError(502, "Workers AI bo‘sh javob qaytardi.", "provider_empty");
  return { text: reply, model: "Zumrad (Workers AI)", key: "ai" };
}

/** Manbalarni ketma-ket sinaydi; birinchi muvaffaqiyatli javobni qaytaradi. */
async function askModel(env, { messages, maxTokens, temperature }) {
  const names = providerNames(env);
  if (!names.length) throw new HttpError(503, NOT_CONFIGURED, "own_model_not_configured");
  let lastError;
  for (const name of names) {
    try {
      if (name === "own") return await askOwn(env, { messages, maxTokens, temperature });
      if (name === "gemini") {
        return await askOpenAICompat(
          "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          env.GEMINI_API_KEY, env.GEMINI_MODEL || "gemini-2.5-flash", "Zumrad (Gemini)",
          messages, maxTokens, temperature);
      }
      if (name === "groq") {
        return await askOpenAICompat(
          "https://api.groq.com/openai/v1/chat/completions",
          env.GROQ_API_KEY, env.GROQ_MODEL || "llama-3.3-70b-versatile", "Zumrad (Groq)",
          messages, maxTokens, temperature);
      }
      if (name === "workers-ai") return await askWorkersAI(env, messages, maxTokens, temperature);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof HttpError ? lastError
    : new HttpError(502, "Barcha manbalar javob bermadi. Birozdan so‘ng qayta urinib ko‘ring.", "all_providers_failed");
}

export function friendlyError(e) {
  if (e instanceof HttpError) return e.message;
  return "Zumrad AI xatosi: " + String(e?.message || e || "noma’lum xato").slice(0, 180);
}

/** UI oqimini saqlaydi, matnning o‘zi faqat o‘z model serveridan keladi. */
export async function* generate(env, { messages, maxTokens = 2500, temperature = 0.5, signal }) {
  if (signal?.aborted) return;
  const result = await askModel(env, { messages, maxTokens, temperature });
  yield { type: "model", key: "own", id: result.model, label: "Zumrad" };
  for (let i = 0; i < result.text.length; i += 24) {
    if (signal?.aborted) return;
    yield { type: "token", t: result.text.slice(i, i + 24) };
  }
}

export async function complete(env, { messages, maxTokens = 600, temperature = 0.7 }) {
  return askModel(env, { messages, maxTokens, temperature });
}
