// Rasm faqat foydalanuvchining o‘zi joylashtirgan Zumrad rasm modeli orqali yaratiladi.
// Tayyor tashqi rasm modellari yoki LLM orqali prompt boyitish chaqirilmaydi.
import { HttpError, clampStr } from "./util.js";

export const ASPECTS = {
  "1:1": [1024, 1024],
  "16:9": [1280, 720],
  "9:16": [720, 1280],
  "4:3": [1152, 864],
  "3:4": [864, 1152],
};

export async function generateImage(env, { prompt, quality = "fast", aspect = "1:1" }) {
  const base = String(env.OWN_IMAGE_URL || "").trim().replace(/\/+$/, "");
  if (!base) {
    throw new HttpError(503,
      "Zumrad AI’ning o‘z rasm modeli hali tayyor yoki ulanmagan. OWN_IMAGE_URL bilan o‘zingiz o‘qitgan/joylashtirgan rasm modelini ulang. Hozircha tashqi tayyor rasm modeli ishlatilmaydi.",
      "own_image_not_configured");
  }
  const original = clampStr(prompt, 1500).trim();
  if (!original) throw new HttpError(400, "Rasm uchun tavsif yozing.");
  if (!ASPECTS[aspect]) aspect = "1:1";
  const headers = { "content-type": "application/json" };
  if (env.OWN_IMAGE_TOKEN) headers.authorization = `Bearer ${env.OWN_IMAGE_TOKEN}`;
  const response = await fetch(`${base}/api/image`, {
    method: "POST", headers,
    body: JSON.stringify({ prompt: original, quality, aspect, width: ASPECTS[aspect][0], height: ASPECTS[aspect][1] }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(502, data.detail || data.error || "Zumrad o‘z rasm modeli xato qaytardi.", "own_image_error");
  if (!data.image && !data.url) throw new HttpError(502, "O‘z rasm modeli image yoki url qaytarmadi.", "own_image_bad_response");
  return {
    ...data,
    prompt: original,
    original,
    enhanced: false,
    model: data.model || "Zumrad Own Image Model",
    modelLabel: "Zumrad Own Image Model",
    quality,
    aspect,
  };
}
