// "Avto" rejimida foydalanuvchi niyatini aniqlash: oddiy suhbatmi, rasm yoki video yaratish so'rovimi.
// Qoida: yaratish fe'li + rasm/video ismi bo'lsa va kod/sayt haqida bo'lmasa — media rejimiga yo'naltiriladi.

const MAKE =
  /(?<!\p{L})(yarat|yasa|chiz|chizib|tayyorla|generatsiya|generate|create|make|draw|render|ishla(?:b|gin)|hosil|рисуй|нарису|созда|сдела|сгенерир|ярат|чиз|яса)/iu;
const IMAGE =
  /(?<!\p{L})(rasm|surat|tasvir|illyustratsiya|illustration|logo|logotip|banner|poster|plakat|kartina|image|picture|photo|artwork|wallpaper|oboy|avatar|ikonka|расм|картинк|изображени|фото|рисунок)/iu;
const VIDEO =
  /(?<!\p{L})(video|videorolik|rolik|klip|animatsiya|multfilm|reels|shorts|reklama\s+roli|видео|ролик|клип|анимаци)/iu;
const CODE =
  /(?<!\p{L})(kod|code|sayt|veb|website|html|css|javascript|python|dastur|funksiya|script|skript|api|bot|ilova|app|react|код|сайт|программ)/iu;
const ABOUT = /(?<!\p{L})(tushuntir|tahlil|tasvirlab|tasvirlang|explain|describe|analyze|объясни|опиши)/iu;

export function detectIntent(text) {
  const t = String(text || "").trim();
  const slash = /^\/(rasm|image|img|video|chat)\b\s*/i.exec(t);
  if (slash) {
    const cmd = slash[1].toLowerCase();
    const rest = t.slice(slash[0].length).trim();
    if (cmd === "chat") return { type: "chat", prompt: rest };
    return { type: cmd === "video" ? "video" : "image", prompt: rest };
  }
  if (t.length > 600 || t.length < 4) return { type: "chat", prompt: t };
  if (CODE.test(t)) return { type: "chat", prompt: t };
  const make = MAKE.test(t);
  if (VIDEO.test(t) && make) return { type: "video", prompt: t };
  if (IMAGE.test(t) && make && !ABOUT.test(t.replace(MAKE, ""))) return { type: "image", prompt: t };
  return { type: "chat", prompt: t };
}
