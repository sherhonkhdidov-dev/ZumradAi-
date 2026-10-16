// Rasm va video yaratish oqimlari. Natijalar IndexedDB'da saqlanadi, xabarda faqat havolalar (mediaId) turadi.

import * as api from "./api.js";
import { putMedia, getMedia } from "./store.js";
import { b64ToBlob, uid, sleep } from "./util.js";
import { renderVideo } from "./videoRender.js";

const isAbort = (e) => e?.name === "AbortError";
const isQuota = (e) => /limit|neyron/i.test(e?.message || "") && e?.status === 500;

async function imageSize(blob) {
  try {
    const bmp = await createImageBitmap(blob);
    const out = { w: bmp.width, h: bmp.height };
    bmp.close?.();
    return out;
  } catch {
    return { w: 0, h: 0 };
  }
}

/** Bitta rasm yaratadi va msg.image ga yozadi. */
export async function runImage({ msg, prompt, quality, aspect, signal, onUpdate }) {
  msg.kind = "image";
  msg.image = { status: "loading", original: prompt, quality, aspect, startedAt: Date.now() };
  onUpdate();
  try {
    const data = await api.generateImage({ prompt, quality, aspect, signal });
    const blob = b64ToBlob(data.image, data.mime);
    const mediaId = uid();
    await putMedia(mediaId, blob);
    const size = await imageSize(blob);
    msg.image = {
      status: "done",
      mediaId,
      mime: data.mime,
      prompt: data.prompt,
      original: data.original,
      enhanced: data.enhanced,
      quality: data.quality,
      aspect: data.aspect,
      model: data.modelLabel,
      ...size,
    };
  } catch (e) {
    if (isAbort(e)) msg.image = { ...msg.image, status: "error", error: "To‘xtatildi." };
    else msg.image = { ...msg.image, status: "error", error: e.message || "Rasm yaratilmadi." };
  }
  onUpdate();
}

async function pool(items, size, worker) {
  let i = 0;
  let failure = null;
  const run = async () => {
    while (i < items.length && !failure) {
      const item = items[i++];
      try {
        await worker(item);
      } catch (e) {
        failure = failure || e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  if (failure) throw failure;
}

/**
 * Video: ssenariy -> kadrlar (Zumrad 1.3) -> brauzerda montaj. Qaytadan chaqirilsa, tayyor qismlarni qayta ishlatadi.
 */
export async function runVideo({ msg, idea, seconds, aspect, signal, onUpdate }) {
  msg.kind = "video";
  const v = (msg.video = msg.video && msg.video.scenes?.length ? { ...msg.video, error: null } : { idea, seconds, aspect, scenes: [] });
  v.idea = idea || v.idea;
  v.startedAt = Date.now();
  v.progress = 0;
  try {
    if (!v.scenes.length) {
      v.status = "planning";
      onUpdate();
      const plan = await api.planVideo({ idea: v.idea, seconds: v.seconds, aspect: v.aspect, signal });
      v.title = plan.title;
      v.music = plan.music;
      v.style = plan.style;
      v.scenes = plan.scenes.map((s) => ({ ...s, status: "wait" }));
    }

    v.status = "images";
    onUpdate();
    const todo = v.scenes.filter((s) => s.status !== "done" || !s.mediaId);
    await pool(todo, 2, async (scene) => {
      scene.status = "loading";
      onUpdate();
      let lastErr;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const data = await api.generateImage({ prompt: scene.image_prompt, quality: "fast", aspect: "1:1", enhance: false, signal });
          const id = uid();
          await putMedia(id, b64ToBlob(data.image, data.mime));
          scene.mediaId = id;
          scene.status = "done";
          onUpdate();
          return;
        } catch (e) {
          lastErr = e;
          if (isAbort(e) || isQuota(e) || e.status === 401 || e.status === 429) break;
          await sleep(900);
        }
      }
      scene.status = "error";
      onUpdate();
      throw lastErr;
    });

    v.status = "rendering";
    onUpdate();
    const bitmaps = [];
    for (const s of v.scenes) {
      const blob = await getMedia(s.mediaId);
      if (!blob) throw new Error("Kadr rasmi topilmadi. Videoni qaytadan yarating.");
      bitmaps.push(await createImageBitmap(blob));
    }
    const out = await renderVideo({
      scenes: v.scenes.map((s, i) => ({ image: bitmaps[i], caption: s.caption, motion: s.motion, seconds: s.seconds })),
      title: v.title,
      aspect: v.aspect,
      music: v.music,
      signal,
      onProgress: (p) => {
        v.progress = p;
        onUpdate({ light: true });
      },
    });
    bitmaps.forEach((b) => b.close?.());
    const mediaId = uid();
    await putMedia(mediaId, out.blob);
    Object.assign(v, { status: "done", mediaId, mime: out.mime, duration: out.duration, width: out.width, height: out.height, progress: 1 });
  } catch (e) {
    v.status = "error";
    v.error = isAbort(e) ? "To‘xtatildi. “Davom ettirish” tugmasi tayyor kadrlarni qayta ishlatadi." : e.message || "Video yaratilmadi.";
  }
  onUpdate();
}

/** Ixtiyoriy: tashqi generativ video (Replicate). */
export async function runGenerativeVideo({ msg, idea, signal, onUpdate }) {
  msg.kind = "video";
  const v = (msg.video = { idea, generative: true, status: "generating", scenes: [], startedAt: Date.now(), title: idea.slice(0, 40) });
  onUpdate();
  try {
    let job = await api.startGenerativeVideo({ prompt: idea, signal });
    const deadline = Date.now() + 6 * 60_000;
    while (job.status !== "succeeded") {
      if (job.status === "failed" || job.status === "canceled") throw new Error(job.error || "Video xizmati ishni bajarolmadi.");
      if (Date.now() > deadline) throw new Error("Video juda uzoq kutildi. Keyinroq urinib ko‘ring.");
      await sleep(4000);
      if (signal?.aborted) throw new DOMException("Bekor qilindi", "AbortError");
      job = await api.generativeVideoStatus(job.id, { signal });
    }
    if (!job.url) throw new Error("Video havolasi kelmadi.");
    Object.assign(v, { status: "done", url: job.url, progress: 1 });
  } catch (e) {
    v.status = "error";
    v.error = isAbort(e) ? "To‘xtatildi." : e.message;
  }
  onUpdate();
}
