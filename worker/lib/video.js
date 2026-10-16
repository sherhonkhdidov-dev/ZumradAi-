// Video ssenariysi faqat Zumrad’ning o‘z matn modeli orqali tuziladi.
// Haqiqiy generativ video modeli hozircha mavjud emas.
import { HttpError, clampInt, clampStr, extractJson } from "./util.js";
import { complete } from "./ai.js";
import { videoPlanSystem } from "./prompts.js";

const MOTIONS = ["zoom_in", "zoom_out", "pan_left", "pan_right", "pan_up"];
const MUSIC = ["calm", "uplifting", "epic", "mysterious"];

export async function planVideo(env, { idea, seconds = 20, aspect = "16:9" }) {
  const text = clampStr(idea, 1200).trim();
  if (!text) throw new HttpError(400, "Video g‘oyasini yozing.");
  seconds = clampInt(seconds, 10, 40, 20);
  const scenes = clampInt(Math.round(seconds / 4), 3, 8, 5);
  const perScene = clampInt(Math.round(seconds / scenes), 3, 7, 4);
  if (!["16:9", "9:16", "1:1"].includes(aspect)) aspect = "16:9";
  const system = videoPlanSystem({ scenes, secondsPerScene: perScene, aspect });
  const { text: raw } = await complete(env, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Video idea: ${text}\nReply with JSON only.` },
    ],
    maxTokens: 1200,
    temperature: 0.5,
  });
  try {
    return normalizePlan(extractJson(raw), { scenes, perScene, aspect, idea: text });
  } catch {
    throw new HttpError(502, "O‘z matn modelimiz video ssenariysi uchun yaroqli JSON tuza olmadi. Modelni sifatli ma’lumotlar bilan o‘qitish kerak.", "own_video_plan_failed");
  }
}

export function normalizePlan(raw, { scenes, perScene, aspect, idea }) {
  const style = clampStr(raw.style, 300).trim() || "cinematic, rich colors, soft natural light";
  const list = Array.isArray(raw.scenes) ? raw.scenes : [];
  const out = list.filter((s) => s && (s.image_prompt || s.prompt)).slice(0, 8).map((s, i) => ({
    caption: clampStr(s.caption || s.text || "", 80).trim(),
    image_prompt: `${clampStr(s.image_prompt || s.prompt, 700).trim()}. ${style}`.slice(0, 1500),
    motion: MOTIONS.includes(s.motion) ? s.motion : MOTIONS[i % MOTIONS.length],
    seconds: clampInt(s.seconds, 3, 8, perScene),
  }));
  if (out.length < 2) throw new Error("ssenariyda kadrlar yetarli emas");
  return { title: clampStr(raw.title, 60).trim() || clampStr(idea, 40), style, music: MUSIC.includes(raw.music) ? raw.music : "uplifting", aspect, scenes: out, sceneTarget: scenes };
}
