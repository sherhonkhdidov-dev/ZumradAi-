// Rasm yaratish: (1) o'zingizning rasm serveringiz (OWN_IMAGE_URL) bo'lsa — shu;
// (2) aks holda Cloudflare Workers AI dagi FLUX.1 schnell (bepul kunlik kvota).
import { HttpError, bytesToBase64, clampStr, imageResultToBytes, sniffImageMime } from "./util.js";
import { complete } from "./ai.js";
import { IMAGE_PROMPT_SYSTEM } from "./prompts.js";

export const ASPECTS = {
  "1:1": [1024, 1024],
  "16:9": [1280, 720],
  "9:16": [720, 1280],
  "4:3": [1152, 864],
  "3:4": [864, 1152],
};

const FLUX = "@cf/black-forest-labs/flux-1-schnell";

/** O'zbekcha tavsifni FLUX tushunadigan batafsil inglizcha promptga aylantiradi (xato bo'lsa asl matn qoladi). */
async function enhance(env, idea) {
  const { text } = await complete(env, {
    maxTokens: 300,
    temperature: 0.7,
    messages: [
      { role: "system", content: IMAGE_PROMPT_SYSTEM },
      { role: "user", content: `Idea: ${idea}` },
    ],
  });
  const cleaned = String(text || "").replace(/^["'`\s]+|["'`\s]+$/g, "").replace(/^prompt:\s*/i, "");
  if (cleaned.length < 12) throw new Error("prompt juda qisqa");
  return cleaned.slice(0, 1500);
}

export async function generateImage(env, { prompt, quality = "fast", aspect = "1:1" }) {
  const original = clampStr(prompt, 1500).trim();
  if (!original) throw new HttpError(400, "Rasm uchun tavsif yozing.");
  if (!ASPECTS[aspect]) aspect = "1:1";

  const own = String(env.OWN_IMAGE_URL || "").trim().replace(/\/+$/, "");
  if (own) return generateWithOwnServer(env, own, { original, quality, aspect });

  if (!env.AI || typeof env.AI.run !== "function") {
    throw new HttpError(503, "Rasm yaratish uchun Cloudflare Workers AI (AI binding) ulanmagan.", "no_image_provider");
  }
  let finalPrompt = original;
  let enhanced = false;
  if (/[^\x00-\x7F]/.test(original) || original.length < 60) {
    try { finalPrompt = await enhance(env, original); enhanced = true; } catch { finalPrompt = original; }
  }
  let result;
  try {
    result = await env.AI.run(FLUX, { prompt: finalPrompt, steps: 6 });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/daily free allocation|4006|quota|limit/i.test(msg)) {
      throw new HttpError(429, "Bugungi bepul rasm limiti tugadi. Ertaga qayta urinib ko‘ring.", "image_quota");
    }
    throw new HttpError(502, "Rasm yaratilmadi: " + msg.slice(0, 160), "image_error");
  }
  const bytes = await imageResultToBytes(result);
  return {
    image: bytesToBase64(bytes),
    mime: sniffImageMime(bytes),
    prompt: finalPrompt,
    original,
    enhanced,
    model: FLUX,
    modelLabel: "Zumrad Rasm (FLUX)",
    quality: "fast",
    aspect: "1:1",
  };
}

async function generateWithOwnServer(env, base, { original, quality, aspect }) {
  const headers = { "content-type": "application/json" };
  if (env.OWN_IMAGE_TOKEN) headers.authorization = `Bearer ${env.OWN_IMAGE_TOKEN}`;
  const response = await fetch(`${base}/api/image`, {
    method: "POST", headers,
    body: JSON.stringify({ prompt: original, quality, aspect, width: ASPECTS[aspect][0], height: ASPECTS[aspect][1] }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(502, data.detail || data.error || "Rasm serveri xato qaytardi.", "own_image_error");
  if (!data.image && !data.url) throw new HttpError(502, "Rasm serveri image yoki url qaytarmadi.", "own_image_bad_response");
  return { ...data, prompt: original, original, enhanced: false, model: data.model || "Zumrad Rasm", modelLabel: "Zumrad Rasm", quality, aspect };
}
