import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:8788";
const OUT = "/tmp/shots2"; fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync("/tmp/sample.py", "def add(a, b):\n    return a + b\n");
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, colorScheme: "dark", acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
const check = async (name, fn) => { try { await fn(); console.log("OK  ", name); } catch (e) { errors.push(`${name}: ${e.message}`); console.log("FAIL", name, e.message); await page.screenshot({ path: `${OUT}/FAIL-${name.replace(/\W+/g,"_")}.png` }); } };
const idle = () => page.waitForFunction(() => !document.querySelector("#sendBtn.stop"), null, { timeout: 60000 });

await page.goto(BASE); await page.waitForSelector(".welcome");

await check("kvota xatosi tushunarli ko'rsatiladi", async () => {
  await page.fill("#prompt", "__quota__ salom"); await page.press("#prompt", "Enter"); await idle();
  const t = await page.locator(".note.err").first().textContent();
  if (!/10 000 neyron/.test(t)) throw new Error(t);
  await page.screenshot({ path: `${OUT}/01-quota-error.png` });
});

await check("to'xtatish tugmasi", async () => {
  await page.fill("#prompt", "__slow__ kod yoz"); await page.press("#prompt", "Enter");
  await page.waitForSelector("#sendBtn.stop"); await page.waitForTimeout(500);
  await page.click("#sendBtn"); await idle();
  const t = await page.locator(".msg.assistant").last().textContent();
  if (!/to‘xtatildi/.test(t)) throw new Error("to'xtatildi belgisi yo'q: " + t.slice(0, 120));
});

await check("qayta yaratish", async () => {
  await page.fill("#prompt", "Salom"); await page.press("#prompt", "Enter"); await idle();
  await page.click('.msg.assistant:last-child [data-act="regen"]'); await idle();
  const n = await page.locator(".msg.assistant").count();
  if (n < 3) throw new Error("soni " + n);
});

await check("fayl va rasm biriktirish", async () => {
  await page.setInputFiles("#fileInput", ["/tmp/sample.py", "/home/claude/ZumradAI/web/icons/icon-192.png"]);
  await page.waitForSelector("#attached .att.img");
  await page.screenshot({ path: `${OUT}/02-attachments.png` });
  await page.fill("#prompt", "Bularni tushuntir"); await page.press("#prompt", "Enter"); await idle();
  const u = await page.locator(".msg.user").last().textContent();
  if (!/sample\.py/.test(u) || !/icon-192/.test(u)) throw new Error(u);
});

await check("slash buyruq: /rasm", async () => {
  await page.fill("#prompt", "/rasm tog‘ ko‘li"); await page.press("#prompt", "Enter");
  await page.waitForSelector(".media-card .media-frame img", { timeout: 20000 }); await idle();
});

await check("sozlamalar oynasi", async () => {
  await page.click("#openSettings"); await page.waitForSelector("dialog[open] .seg");
  await page.screenshot({ path: `${OUT}/03-settings.png` });
  await page.click('dialog [data-key="theme"] [data-v="light"]');
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  if (theme !== "light") throw new Error("mavzu: " + theme);
  await page.keyboard.press("Escape");
});

await check("saqlash: sahifani yangilagandan keyin suhbat va rasm qoladi", async () => {
  await page.reload(); await page.waitForSelector(".msg");
  const imgs = await page.locator(".media-card .media-frame img[src^=blob]").count();
  if (imgs < 1) throw new Error("rasm tiklanmadi");
  await page.screenshot({ path: `${OUT}/04-reload-light.png` });
});

await check("suhbatni o'chirish va yangi suhbat", async () => {
  await page.hover(".history-item"); page.once("dialog", (d) => d.accept());
  await page.click('.history-item [data-act="delete-chat"]');
  await page.waitForSelector(".welcome");
});

await check("xavfsizlik: markdown ichidagi xavfli HTML tozalanadi", async () => {
  const bad = await page.evaluate(async () => {
    const m = await import("/js/markdown.js");
    const html = m.renderMarkdown('<img src=x onerror=alert(1)> <script>alert(2)</script> [x](javascript:alert(3)) <a href="javascript:alert(4)">y</a>');
    return html;
  });
  if (/onerror|<script|javascript:/i.test(bad)) throw new Error(bad);
});

await browser.close();
console.log(errors.length ? "XATOLAR:\n" + errors.join("\n") : "Qo‘shimcha sinovlar xatosiz o‘tdi.");
process.exit(errors.length ? 1 : 0);
