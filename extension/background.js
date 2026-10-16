const APPS = { telegram: "https://web.telegram.org/k/", whatsapp: "https://web.whatsapp.com/", instagram: "https://www.instagram.com/direct/inbox/" };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function findOrOpen(app) {
  const host = new URL(APPS[app]).host;
  const tabs = await chrome.tabs.query({});
  let t = tabs.find((x) => x.url && new URL(x.url).host === host);
  if (!t) { t = await chrome.tabs.create({ url: APPS[app], active: false }); await wait(6000); }
  return t;
}
async function exec(c, sender) {
  const tab = sender.tab;
  if (c.type === "open") { await chrome.tabs.create({ url: c.url }); return { ok: true }; }
  if (c.type === "search") { await chrome.tabs.create({ url: "https://www.google.com/search?q=" + encodeURIComponent(c.q) }); return { ok: true }; }
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (c.type === "back") { await chrome.tabs.goBack(active.id); return { ok: true }; }
  if (c.type === "reload") { await chrome.tabs.reload(active.id); return { ok: true }; }
  if (c.type === "scroll") { await chrome.scripting.executeScript({ target: { tabId: active.id }, func: (dy) => scrollBy({ top: dy, behavior: "smooth" }), args: [c.dy] }); return { ok: true }; }
  if (c.type === "read") { // faqat foydalanuvchi so'raganda, faqat shu bitta messenjer
    const t = await findOrOpen(c.app);
    const r = await chrome.tabs.sendMessage(t.id, { read: c.app }).catch(() => null);
    return r || { ok: false, error: c.app + " ochilmagan yoki akkauntga kirilmagan. Avval tizimga kiring." };
  }
  return { ok: false, error: "Noma'lum buyruq" };
}
chrome.runtime.onMessage.addListener((m, sender, send) => { if (m.cmd) { exec(m.cmd, sender).then(send).catch((e) => send({ ok: false, error: String(e) })); return true; } });
