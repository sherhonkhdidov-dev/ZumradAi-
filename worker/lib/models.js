// Faqat so‘rov turini aniqlash. Bu faylda hech qanday tayyor AI modeli ro‘yxati yo‘q.
const CODE_RE = /\b(kod|code|coding|dastur|program|funksiya|function|class|bug|debug|xato|error|exception|sayt|website|html|css|javascript|typescript|python|react|api|json|sql|ilova|app|dizayn|design|ui|ux)\b|```|=>|<\/?[a-z]+>|код|программ|скрипт|сайт|функци|ошибк|баг/i;
export function looksLikeCode(text) {
  return CODE_RE.test(String(text || ""));
}
export function pickModelKey(choice, { text = "" } = {}) {
  // Kalit faqat prompt yo‘riqnomasi uchun; model tanlash/fallback yo‘q.
  return choice === "code" || looksLikeCode(text) ? "code" : "own";
}
