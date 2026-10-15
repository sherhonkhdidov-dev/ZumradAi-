// Video: (1) AI ssenariy (storyboard) tuzish — brauzer shu asosida kadrlarni chizib, haqiqiy video fayl yig'adi.
//        (2) Ixtiyoriy: Replicate orqali generativ (text-to-video) model.

import { HttpError, clampInt, clampStr, extractJson, fetchTimeout } from "./util.js";
import { complete } from "./ai.js";
import { videoPlanSystem } from "./prompts.js";

const MOTIONS = ["zoom_in", "zoom_out", "pan_left", "pan_right", "pan_up"];
const MUSIC = ["calm", "uplifting", "epic", "mysterious"];

export async function planVideo(env, { idea, seconds = 20, aspect = "16:9" }) {
  if (!env.AI) throw new HttpError(503, "Video ssenariysi uchun Workers AI (AI binding) ulanmagan.", "no_ai");
  const text = clampStr(idea, 1200).trim();
  if (!text) throw new HttpError(400, "Video g‘oyasini yozing.");
  seconds = clampInt(seconds, 10, 40, 20);
  const scenes = clampInt(Math.round(seconds / 4), 3, 8, 5);
  const perScene = clampInt(Math.round(seconds / scenes), 3, 7, 4);
  if (!["16:9", "9:16", "1:1"].includes(aspect)) aspect = "16:9";

  const system = videoPlanSystem({ scenes, secondsPerScene: perScene, aspect });
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages = [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `Video idea: ${text}` +
          (attempt ? "\n\nYour previous reply was not valid JSON. Reply with ONLY the JSON object." : ""),
      },
    ];
    try {
      const { text: raw } = await complete(env, { messages, key: "fast", maxTokens: 2200, temperature: attempt ? 0.4 : 0.8 });
      return normalizePlan(extractJson(raw), { scenes, perScene, aspect, idea: text });
    } catch (e) {
      lastError = e;
      if (/daily free allocation|4006/i.test(String(e?.message))) throw e;
    }
  }
  throw new HttpError(502, "Ssenariy tuzib bo‘lmadi. G‘oyani aniqroq yozib, qayta urinib ko‘ring. (" + (lastError?.message || "") + ")", "plan_failed");
}

export function normalizePlan(raw, { scenes, perScene, aspect, idea }) {
  const style = clampStr(raw.style, 300).trim() || "cinematic, rich colors, soft natural light, shallow depth of field";
  const list = Array.isArray(raw.scenes) ? raw.scenes : [];
  const out = list
    .filter((s) => s && (s.image_prompt || s.prompt))
    .slice(0, 8)
    .map((s, i) => ({
      caption: clampStr(s.caption || s.text || "", 80).trim(),
      image_prompt: `${clampStr(s.image_prompt || s.prompt, 700).trim()}. ${style}`.slice(0, 1500),
      motion: MOTIONS.includes(s.motion) ? s.motion : MOTIONS[i % MOTIONS.length],
      seconds: clampInt(s.seconds, 3, 8, perScene),
    }));
  if (out.length < 2) throw new Error("ssenariyda kadrlar yetarli emas");
  return {
    title: clampStr(raw.title, 60).trim() || clampStr(idea, 40),
    style,
    music: MUSIC.includes(raw.music) ? raw.music : "uplifting",
    aspect,
    scenes: out,
    sceneTarget: scenes,
  };
}

/* ---------- Ixtiyoriy: Replicate (haqiqiy generativ video) ---------- */

export function replicateConfigured(env) {
  return Boolean(env.REPLICATE_API_TOKEN && env.REPLICATE_VIDEO_MODEL);
}

export async function startReplicateVideo(env, { prompt }) {
  if (!replicateConfigured(env)) {
    throw new HttpError(
      503,
      "Generativ video ulanmagan. REPLICATE_API_TOKEN va REPLICATE_VIDEO_MODEL sozlamalarini qo‘shing yoki ichki ‘Kino-video’ rejimidan foydalaning.",
      "no_video_provider",
    );
  }
  let extra = {};
  try {
    extra = env.REPLICATE_VIDEO_INPUT ? JSON.parse(env.REPLICATE_VIDEO_INPUT) : {};
  } catch {
    /* noto'g'ri JSON — e'tiborsiz */
  }
  const res = await fetchTimeout(
    `https://api.replicate.com/v1/models/${env.REPLICATE_VIDEO_MODEL}/predictions`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
        "content-type": "application/json",
        prefer: "wait=15",
      },
      body: JSON.stringify({ input: { prompt: clampStr(prompt, 1500), ...extra } }),
    },
    25000,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, "Video xizmati xatosi: " + (data.detail || data.title || res.status), "provider_error");
  return shapeReplicate(data);
}

export async function replicateStatus(env, id) {
  if (!replicateConfigured(env)) throw new HttpError(503, "Generativ video ulanmagan.", "no_video_provider");
  if (!/^[a-z0-9]{8,40}$/i.test(id)) throw new HttpError(400, "Noto‘g‘ri ID.");
  const res = await fetchTimeout(
    `https://api.replicate.com/v1/predictions/${id}`,
    { headers: { authorization: `Bearer ${env.REPLICATE_API_TOKEN}` } },
    15000,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, "Video holatini olib bo‘lmadi: " + (data.detail || res.status), "provider_error");
  return shapeReplicate(data);
}

function shapeReplicate(d) {
  const out = Array.isArray(d.output) ? d.output[0] : d.output;
  return {
    id: d.id,
    status: d.status, // starting | processing | succeeded | failed | canceled
    url: typeof out === "string" ? out : null,
    error: d.error || null,
  };
}
