// 1) Zumrad sahifasi <-> kengaytma ko'prigi (faqat <meta name="zumrad-app"> bor sahifada)
if (document.querySelector('meta[name="zumrad-app"]')) {
  addEventListener("message", (e) => {
    if (e.source !== window || !e.data?.zumradCmd) return;
    chrome.runtime.sendMessage({ cmd: e.data.zumradCmd }, (result) => postMessage({ zumradReply: e.data.id, result: result || { ok: false, error: "Javob yo'q" } }, "*"));
  });
}
// 2) Messenjerdan o'qish (faqat so'rov kelganda; DOM selektorlari sayt yangilanganda o'zgarishi mumkin)
const SEL = {
  telegram: ".chatlist-chat",
  whatsapp: '#pane-side [role="listitem"], #pane-side [role="row"]',
  instagram: 'a[href^="/direct/t/"]',
};
chrome.runtime.onMessage.addListener((m, _s, send) => {
  if (!m.read) return;
  const items = [...document.querySelectorAll(SEL[m.read] || "")].slice(0, 6);
  if (!items.length) return send({ ok: false, error: "Chatlar topilmadi. Tizimga kirganingizni tekshiring." });
  const text = items.map((el) => el.innerText.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3).join(": ")).join(". ");
  send({ ok: true, text });
});
