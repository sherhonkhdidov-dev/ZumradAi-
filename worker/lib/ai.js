// Zumrad AI own-model-only gateway. No third-party LLM or fallback is called.
import { HttpError } from "./util.js";

function ownModelUrl(env) {
  const base = String(env.OWN_MODEL_URL || "").trim().replace(/\/+$/, "");
  if (!base) throw new HttpError(503,
    "Zumrad AI o‘z modeli hali ulanmagan. OWN_MODEL_URL orqali o‘zingiz joylashtirgan model serverini ulang. Tashqi AI modeli chaqirilmaydi.",
    "own_model_not_configured");
  return base;
}

async function askOwnModel(env, { messages, maxTokens = 600, temperature = 0.6 }) {
  const base = ownModelUrl(env);
  const headers = { "content-type": "application/json" };
  if (env.OWN_MODEL_TOKEN) headers.authorization = `Bearer ${env.OWN_MODEL_TOKEN}`;
  let response;
  try {
    response = await fetch(`${base}/api/chat`, {
      method: "POST", headers,
      body: JSON.stringify({ messages, max_new_tokens: Math.min(maxTokens, 1000), temperature }),
    });
  } catch {
    throw new HttpError(503, "O‘z Zumrad model serveriga ulanib bo‘lmadi. Server manzili va internet aloqasini tekshiring.", "own_model_unreachable");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(response.status === 404 ? 503 : 502,
    data.detail || data.error || "O‘z model serveri javob bermadi.", "own_model_error");
  const reply = typeof data.reply === "string" ? data.reply : "";
  if (!reply.trim()) throw new HttpError(502, "O‘z modelimiz bo‘sh javob qaytardi.", "own_model_empty");
  return { text: reply, model: data.model || "Zumrad Own Model", key: "own" };
}

export function friendlyError(e) {
  if (e instanceof HttpError) return e.message;
  return "Zumrad AI xatosi: " + String(e?.message || e || "noma’lum xato").slice(0, 180);
}

/** UI oqimini saqlaydi, matnning o‘zi faqat o‘z model serveridan keladi. */
export async function* generate(env, { messages, maxTokens = 2500, temperature = 0.5, signal }) {
  if (signal?.aborted) return;
  const result = await askOwnModel(env, { messages, maxTokens, temperature });
  yield { type: "model", key: "own", id: result.model, label: "Zumrad Own Model" };
  for (let i = 0; i < result.text.length; i += 24) {
    if (signal?.aborted) return;
    yield { type: "token", t: result.text.slice(i, i + 24) };
  }
}

export async function complete(env, { messages, maxTokens = 600, temperature = 0.7 }) {
  return askOwnModel(env, { messages, maxTokens, temperature });
}
