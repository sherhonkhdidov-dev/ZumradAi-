// Haqiqiy video fayl yaratish (brauzer ichida): AI chizgan kadrlar + kino-harakat (Ken Burns), o'tishlar,
// subtitrlar, sarlavha/yakuniy kadr va sintezlangan musiqa -> MP4/WebM. Hech qanday tashqi xizmat kerak emas.

import { sleep } from "./util.js";

export const VIDEO_SIZES = { "16:9": [1280, 720], "9:16": [720, 1280], "1:1": [1024, 1024] };

const NOTE = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const freq = (name) => {
  const m = /^([A-G][#b]?)(\d)$/.exec(name);
  const semis = NOTE[m[1]] + (Number(m[2]) - 4) * 12 - 9; // A4 = 440
  return 440 * Math.pow(2, semis / 12);
};

const MOODS = {
  calm: { len: 5, wave: "sine", arp: 0, chords: [["C3", "E4", "G4", "B4"], ["A2", "C4", "E4", "G4"], ["F2", "A3", "C4", "E4"], ["G2", "B3", "D4", "E4"]] },
  uplifting: { len: 4, wave: "triangle", arp: 0.5, chords: [["C3", "C4", "E4", "G4"], ["G2", "B3", "D4", "G4"], ["A2", "A3", "C4", "E4"], ["F2", "A3", "C4", "F4"]] },
  epic: { len: 5, wave: "sawtooth", arp: 0, boom: true, chords: [["A2", "A3", "C4", "E4"], ["F2", "A3", "C4", "F4"], ["C3", "G3", "C4", "E4"], ["G2", "G3", "B3", "D4"]] },
  mysterious: { len: 5, wave: "triangle", arp: 1, chords: [["D3", "A3", "D4", "F4"], ["Bb2", "Bb3", "D4", "F4"], ["G2", "Bb3", "D4", "G4"], ["A2", "A3", "C#4", "E4"]] },
};

let sharedCtx = null;

/** Foydalanuvchi bosganida chaqiring — brauzerlar audioni faqat harakatdan keyin ruxsat beradi. */
export function primeAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    sharedCtx = sharedCtx || new AC();
    if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
    return sharedCtx;
  } catch {
    return null;
  }
}

function createMusic(ctx, mood, total) {
  const cfg = MOODS[mood] || MOODS.uplifting;
  const dest = ctx.createMediaStreamDestination();
  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cfg.wave === "sawtooth" ? 1100 : 1700;
  filter.Q.value = 0.6;
  filter.connect(master);
  master.connect(dest);

  const t0 = ctx.currentTime + 0.08;
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.85, t0 + 1.4);
  master.gain.setValueAtTime(0.85, t0 + Math.max(1.5, total - 2));
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + total);

  const voice = (f, start, dur, vol, type = cfg.wave, dst = filter) => {
    for (const detune of [-5, 5]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      osc.detune.value = detune;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(vol, start + 0.9);
      g.gain.setValueAtTime(vol, start + dur - 0.2);
      g.gain.linearRampToValueAtTime(0.0001, start + dur + 0.9);
      osc.connect(g);
      g.connect(dst);
      osc.start(start);
      osc.stop(start + dur + 1);
    }
  };

  const pluck = (f, start) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.07, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
    osc.connect(g);
    g.connect(master);
    osc.start(start);
    osc.stop(start + 0.8);
  };

  const boom = (start) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, start);
    osc.frequency.exponentialRampToValueAtTime(38, start + 0.5);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
    osc.connect(g);
    g.connect(master);
    osc.start(start);
    osc.stop(start + 1);
  };

  for (let k = 0, t = 0; t < total; k++, t += cfg.len) {
    const [bass, ...notes] = cfg.chords[k % cfg.chords.length];
    voice(freq(bass), t0 + t, cfg.len, 0.11, "sine");
    notes.forEach((n) => voice(freq(n), t0 + t, cfg.len, 0.04));
    if (cfg.boom) boom(t0 + t);
    if (cfg.arp) {
      for (let a = 0, i = 0; a < cfg.len; a += cfg.arp, i++) {
        const n = notes[i % notes.length];
        pluck(freq(n) * 2, t0 + t + a);
      }
    }
  }
  return { stream: dest.stream, ctx };
}

function pickMime(withAudio) {
  const list = [
    withAudio && "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    withAudio && "video/webm;codecs=vp9,opus",
    withAudio && "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ].filter(Boolean);
  return list.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";
}

export const videoExtension = (mime) => (String(mime).includes("mp4") ? "mp4" : "webm");
export const canRecordVideo = () => Boolean(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawKenBurns(ctx, img, W, H, motion, p) {
  const iw = img.width;
  const ih = img.height;
  const base = Math.max(W / iw, H / ih);
  let z = 1.04;
  let ox = 0;
  let oy = 0;
  const e = ease(p);
  switch (motion) {
    case "zoom_out": z = 1.18 - 0.14 * e; break;
    case "pan_left": z = 1.16; ox = 1 - 2 * e; break;
    case "pan_right": z = 1.16; ox = -1 + 2 * e; break;
    case "pan_up": z = 1.16; oy = 1 - 2 * e; break;
    default: z = 1.04 + 0.14 * e; // zoom_in
  }
  const dw = iw * base * z;
  const dh = ih * base * z;
  const x = (W - dw) / 2 + ox * ((dw - W) / 2);
  const y = (H - dh) / 2 + oy * ((dh - H) / 2);
  ctx.drawImage(img, x, y, dw, dh);
}

async function loadFonts() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 48px "Bricolage Grotesque"'), document.fonts.load('600 32px "Onest"')]),
      sleep(1800),
    ]);
  } catch {
    /* tizim shriftlari ishlatiladi */
  }
}

/**
 * scenes: [{ image: ImageBitmap|HTMLImageElement, caption, motion, seconds }]
 * Natija: { blob, mime, duration, width, height }
 */
export async function renderVideo({ scenes, title = "", aspect = "16:9", music = "uplifting", onProgress, signal }) {
  if (!canRecordVideo()) throw new Error("Bu brauzer video yozib olishni qo‘llamaydi. Chrome yoki Safari’ning yangi versiyasidan foydalaning.");
  const [W, H] = VIDEO_SIZES[aspect] || VIDEO_SIZES["16:9"];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  await loadFonts();

  const X = 0.9; // kadrlar orasidagi o'tish davomiyligi
  const INTRO = 2.4;
  const OUTRO = 2.2;
  const n = scenes.length;
  const starts = [];
  let cursor = 0;
  scenes.forEach((s, i) => {
    starts.push(cursor);
    cursor += s.seconds - (i < n - 1 ? X : 0);
  });
  const total = cursor + OUTRO;
  const portrait = H > W;
  const capSize = Math.round(portrait ? W * 0.056 : W * 0.034);
  const titleSize = Math.round(portrait ? W * 0.095 : W * 0.062);
  const bodyFont = `600 ${capSize}px Onest, system-ui, "Segoe UI", sans-serif`;
  const titleFont = `700 ${titleSize}px "Bricolage Grotesque", Onest, system-ui, sans-serif`;

  const drawText = (text, y, font, alpha, align = "center") => {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    const size = parseInt(font.match(/(\d+)px/)[1], 10);
    const lines = wrapText(ctx, text, W * (portrait ? 0.84 : 0.76));
    const lh = size * 1.22;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = size * 0.35;
    ctx.shadowOffsetY = 2;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * lh - ((lines.length - 1) * lh) / 2));
    ctx.shadowColor = "transparent";
    ctx.globalAlpha = 1;
    return lines.length;
  };

  const draw = (t) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < n; i++) {
      const a = starts[i];
      const b = i === n - 1 ? total + 1 : a + scenes[i].seconds;
      if (t < a || t >= b) continue;
      ctx.globalAlpha = i === 0 ? 1 : clamp((t - a) / X);
      drawKenBurns(ctx, scenes[i].image, W, H, scenes[i].motion, (t - a) / scenes[i].seconds);
    }
    ctx.globalAlpha = 1;

    // kiyim: pastki soya (subtitr o'qilishi uchun)
    const g = ctx.createLinearGradient(0, H * 0.58, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,.62)");
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.58, W, H * 0.42);

    // subtitrlar
    for (let i = 0; i < n; i++) {
      const cap = scenes[i].caption;
      if (!cap) continue;
      const cs = i === 0 ? INTRO - 0.2 : starts[i] + 0.4;
      const ce = i < n - 1 ? starts[i + 1] + 0.25 : total - OUTRO + 0.2;
      if (t < cs || t > ce) continue;
      const alpha = clamp((t - cs) / 0.45) * clamp((ce - t) / 0.35);
      const slide = (1 - clamp((t - cs) / 0.45)) * 14;
      drawText(cap, H - H * (portrait ? 0.13 : 0.11) + slide, bodyFont, alpha);
    }

    // sarlavha kadri
    if (t < INTRO && title) {
      const k = clamp(t / 0.6) * clamp((INTRO - t) / 0.6);
      ctx.fillStyle = `rgba(4,18,13,${0.5 * k})`;
      ctx.fillRect(0, 0, W, H);
      const y = H / 2 + (1 - clamp(t / 0.8)) * 18;
      drawText(title, y, titleFont, k);
      ctx.globalAlpha = k;
      ctx.fillStyle = "#E8B64C";
      ctx.fillRect(W / 2 - W * 0.04, y + titleSize * 0.95, W * 0.08, Math.max(3, H * 0.005));
      ctx.globalAlpha = 1;
    }

    // yakuniy kadr
    const oStart = total - OUTRO;
    if (t > oStart) {
      const k = clamp((t - oStart) / 0.8);
      ctx.fillStyle = `rgba(3,14,10,${0.72 * k})`;
      ctx.fillRect(0, 0, W, H);
      if (title) drawText(title, H / 2 - capSize * 0.4, titleFont, k);
      drawText("Zumrad AI bilan yaratildi", H / 2 + titleSize * 0.85, `500 ${Math.round(capSize * 0.8)}px Onest, system-ui, sans-serif`, k * 0.8);
      const fade = clamp((t - (total - 0.4)) / 0.4);
      if (fade > 0) {
        ctx.fillStyle = `rgba(0,0,0,${fade})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  };

  draw(0);
  const stream = canvas.captureStream(30);
  let audioCtx = null;
  let music$ = null;
  try {
    audioCtx = primeAudio();
    if (audioCtx) {
      await audioCtx.resume?.();
      music$ = createMusic(audioCtx, music, total);
      music$.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    }
  } catch {
    music$ = null; // musiqasiz davom etamiz
  }

  const mime = pickMime(Boolean(music$ && stream.getAudioTracks().length));
  const rec = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: W * H > 1_000_000 ? 6_000_000 : 4_500_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks = [];
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  const stopped = new Promise((resolve, reject) => {
    rec.onstop = resolve;
    rec.onerror = (e) => reject(e.error || new Error("Videoni yozib olishda xato"));
  });

  rec.start(250);
  const startedAt = performance.now();
  try {
    await new Promise((resolve, reject) => {
      const frame = (now) => {
        if (signal?.aborted) return reject(new DOMException("Bekor qilindi", "AbortError"));
        const t = Math.min((now - startedAt) / 1000, total);
        draw(t);
        onProgress?.(t / total);
        if (t >= total) return resolve();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  } finally {
    if (rec.state !== "inactive") rec.stop();
  }
  await stopped;
  stream.getTracks().forEach((tr) => tr.stop());
  if (!chunks.length) throw new Error("Video yozib olinmadi. Sahifa ochiq turganini tekshiring.");
  const type = rec.mimeType || mime || "video/webm";
  return { blob: new Blob(chunks, { type }), mime: type, duration: Math.round(total), width: W, height: H };
}
