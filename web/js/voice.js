// Zumrad Voice — wake word "Zumrad" + qoidaga asoslangan buyruq tahlilchisi (AI modeli yo'q).
// Ovoz->matn: brauzer/OS ichki tanib olish xizmati (ilovaga model qo'shilmagan).
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const WAKE = /(zumrad|zumrat|zumurrad|zumrud|зумрад|зумрат)[,.!?\s]*/i;
const SITES = { youtube: "youtube.com", google: "google.com", gmail: "mail.google.com", github: "github.com", telegram: "web.telegram.org/k/", whatsapp: "web.whatsapp.com", instagram: "instagram.com", facebook: "facebook.com", render: "dashboard.render.com", cloudflare: "dash.cloudflare.com", supabase: "supabase.com/dashboard" };
const MSG = { telegram: /telegram|телеграм/i, whatsapp: /whats\s?app|watsap|ватсап/i, instagram: /instagram|insta|инстаграм/i };
let rec, on = false, armed = false, btn;

export function speak(t) {
  if (!("speechSynthesis" in window) || !t) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(t).slice(0, 600)); u.lang = "uz-UZ"; speechSynthesis.speak(u);
}
const ext = (cmd) => new Promise((res) => {
  const id = Math.random().toString(36).slice(2);
  const h = (e) => { if (e.source === window && e.data?.zumradReply === id) { removeEventListener("message", h); res(e.data.result); } };
  addEventListener("message", h);
  postMessage({ zumradCmd: cmd, id }, "*");
  setTimeout(() => { removeEventListener("message", h); res({ ok: false, error: "Zumrad kengaytmasi topilmadi. extension/ papkasini Chrome'ga o'rnating." }); }, 15000);
});

export function parse(raw) {
  const t = raw.toLowerCase().replace(/[ʻ’‘`]/g, "'").trim();
  const msgApp = Object.keys(MSG).find((k) => MSG[k].test(t));
  if (/(xabar|habar|сообщени|message|yozishma|o'qi|oqi|читай|read)/.test(t) && msgApp) return { type: "read", app: msgApp };
  if (/(to'xta|toxta|jim|стоп|stop)/.test(t)) return { type: "stop" };
  if (/(orqaga|назад|back)/.test(t)) return { type: "back" };
  if (/(pastga|вниз|scroll down)/.test(t)) return { type: "scroll", dy: 600 };
  if (/(tepaga|вверх|scroll up)/.test(t)) return { type: "scroll", dy: -600 };
  if (/(yangila|обнови|reload|refresh)/.test(t)) return { type: "reload" };
  const q = t.match(/(?:qidir|izla|найди|search)\s+(.+)/);
  if (q) return { type: "search", q: q[1] };
  const o = t.match(/(?:och|ochib ber|открой|open)\s+(.+)/) || t.match(/(.+?)(?:ni|ga)?\s+(?:och|ochib ber|открой)$/);
  if (o) {
    const name = o[1].replace(/\s+(ni|ga|saytini|sayti)$/g, "").trim();
    const k = Object.keys(SITES).find((s) => name.includes(s));
    if (k) return { type: "open", url: "https://" + SITES[k] };
    if (/^[\w-]+(\.[\w-]+)+/.test(name)) return { type: "open", url: "https://" + name.replace(/\s/g, "") };
  }
  return null;
}

export async function run(raw, say = speak) {
  const c = parse(raw);
  if (!c) return say("Buyruqni tushunmadim. Masalan: Zumrad, telegramdagi xabarlarni o'qi.");
  if (c.type === "stop") { speechSynthesis.cancel(); return; }
  const r = await ext(c);
  if (!r?.ok) return say(r?.error || "Bajarib bo'lmadi.");
  say(c.type === "read" ? (r.text || "Yangi xabar topilmadi.") : "Bajarildi.");
}

function handle(text) {
  const m = text.match(WAKE);
  if (m) { const cmd = text.slice(m.index + m[0].length).trim(); if (cmd) { armed = false; run(cmd); } else { armed = true; speak("Eshitaman"); } }
  else if (armed) { armed = false; run(text); }
  // Wake word aytilmasa hech narsa bajarilmaydi — faqat siz "Zumrad" desangiz.
}

export function toggle() {
  if (!SR) return alert("Bu brauzer ovoz tanishni qo'llamaydi. Chrome yoki Android Chrome'dan foydalaning.");
  if (on) { on = false; rec?.stop(); btn?.classList.remove("on"); return; }
  rec = new SR(); rec.lang = "uz-UZ"; rec.continuous = true; rec.interimResults = false;
  rec.onresult = (e) => handle(e.results[e.results.length - 1][0].transcript);
  rec.onend = () => { if (on) try { rec.start(); } catch {} };
  rec.onerror = (e) => { if (e.error === "not-allowed") { on = false; btn?.classList.remove("on"); } };
  on = true; rec.start(); btn?.classList.add("on");
}

export function initVoice() {
  document.head.insertAdjacentHTML("beforeend", '<meta name="zumrad-app" content="1"><style>#zVoice{position:fixed;right:16px;bottom:96px;z-index:50;width:52px;height:52px;border-radius:50%;border:0;color:#fff;font-size:22px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);box-shadow:0 8px 24px #6d28d980}#zVoice.on{animation:zp 1.4s infinite}@keyframes zp{50%{box-shadow:0 0 0 12px #8b5cf633}}</style>');
  btn = document.createElement("button"); btn.id = "zVoice"; btn.title = "Zumrad ovozli buyruq"; btn.textContent = "🎙";
  btn.onclick = toggle; document.body.appendChild(btn);
}
