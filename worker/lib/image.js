// Rasm generatsiyasi: o'zbekcha tavsif -> (AI orqali) inglizcha professional prompt -> Flux / Lucid.

import { HttpError, bytesToBase64, clampStr, imageResultToBytes, sniffImageMime } from "./util.js";
import { complete } from "./ai.js";
import { IMAGE_MODELS } from "./models.js";
import { IMAGE_PROMPT_SYSTEM } from "./prompts.js";

export const ASPECTS = {
  "1:1": [1024, 1024],
  "16:9": [1280, 720],
  "9:16": [720, 1280],
  "4:3": [1152, 864],
  "3:4": [864, 1152],
};

export async function enhanceImagePrompt(env, idea, aspect = "1:1") {
  const { text } = await complete(env, {
    key: "fast",
    maxTokens: 400,
    temperature: 0.7,
    messages: [
      { role: "system", content: IMAGE_PROMPT_SYSTEM },
      { role: "user", content: `Aspect ratio: ${aspect}\nIdea: ${idea}` },
    ],
  });
  const cleaned = text.replace(/^["'`\s]+|["'`\s]+$/g, "").replace(/^prompt:\s*/i, "");
  if (cleaned.length < 12) throw new Error("prompt juda qisqa");
  return cleaned;
}

export async function generateImage(env, { prompt, quality = "fast", aspect = "1:1", enhance = true }) {
  if (!env.AI) throw new HttpError(503, "Rasm yaratish uchun Workers AI (AI binding) ulanmagan.", "no_ai");
  const original = clampStr(prompt, 1500).trim();
  if (!original) throw new HttpError(400, "Rasm uchun tavsif yozing.");
  if (!ASPECTS[aspect]) aspect = "1:1";

  let finalPrompt = original;
  let enhanced = false;
  if (enhance) {
    try {
      finalPrompt = await enhanceImagePrompt(env, original, aspect);
      enhanced = true;
    } catch (e) {
      if (/daily free allocation|4006/i.test(String(e?.message))) throw e;
      finalPrompt = original; // boyitish bo'lmasa, asl tavsif bilan davom etamiz
    }
  }
  finalPrompt = finalPrompt.slice(0, 1900);

  let result;
  let modelInfo;
  if (quality === "hq") {
    modelInfo = IMAGE_MODELS.hq;
    const [width, height] = ASPECTS[aspect];
    result = await env.AI.run(modelInfo.id, {
      prompt: finalPrompt,
      width,
      height,
      steps: 20,
      num_steps: 20,
      guidance: 4.5,
      seed: Math.floor(Math.random() * 2_000_000_000),
    });
  } else {
    modelInfo = IMAGE_MODELS.fast;
    result = await env.AI.run(modelInfo.id, { prompt: finalPrompt, steps: 6 });
  }

  const bytes = await imageResultToBytes(result);
  return {
    image: bytesToBase64(bytes),
    mime: sniffImageMime(bytes),
    prompt: finalPrompt,
    original,
    enhanced,
    model: modelInfo.id,
    modelLabel: modelInfo.label,
    quality,
    aspect: quality === "hq" ? aspect : "1:1",
  };
}
