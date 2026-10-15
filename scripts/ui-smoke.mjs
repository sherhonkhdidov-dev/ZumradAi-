// Brauzer sinovi (Playwright): asosiy foydalanuvchi oqimlarini tekshiradi va skrinshotlar oladi.
// Ishga tushirish:  node scripts/dev-mock.mjs  (boshqa oynada)  →  node scripts/ui-smoke.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:8788";
const OUT = process.env.OUT || "/tmp/shots";
import fs from "node:fs";
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

async function session(name, viewport, fn) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: name.includes("dark") ? "dark" : "light", acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(`[${name}] console: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".welcome");
  try {
    await fn(page);
  } catch (e) {
    errors.push(`[${name}] SCENARIO FAILED: ${e.message}`);
    await page.screenshot({ path: `${OUT}/${name}-FAIL.png` });
  }
  await ctx.close();
}

const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}.png` });
const send = async (page, text) => {
  await page.fill("#prompt", text);
  await page.click("#sendBtn");
};
const waitIdle = (page, ms = 60000) => page.waitForFunction(() => !document.querySelector("#sendBtn.stop"), null, { timeout: ms });

// ---------------- Kompyuter, yorug' ----------------
await session("desktop-light", { width: 1360, height: 860 }, async (page) => {
  await shot(page, "01-welcome");
  await send(page, "Salom, qalaysan?");
  await waitIdle(page);
  await page.waitForSelector(".msg.assistant .md table");
  await shot(page, "02-chat");

  await send(page, "Menga sodda HTML sahifa kodini yozib ber");
  await waitIdle(page);
  await page.waitForSelector(".codeblock");
  const blocks = await page.locator(".codeblock").count();
  if (blocks < 3) throw new Error("kod bloklari soni: " + blocks);
  await page.click('[data-act="project-preview"]');
  await page.waitForSelector("#frame");
  await page.waitForTimeout(800);
  const frame = page.frameLocator("#frame");
  await frame.locator("#b").click();
  const out = await frame.locator("#out").textContent();
  if (!/Bosildi: 1/.test(out)) throw new Error("preview ishlamadi: " + out);
  await shot(page, "03-code-preview");
  await page.click("#tabCode");
  await page.waitForSelector(".code-view");
  await shot(page, "04-code-tab");
  await page.click("#panelClose");

  // rasm (avto yo'naltirish)
  await send(page, "Samarqand Registonining tongdagi rasmini chiz");
  await page.waitForSelector(".media-card .skeleton");
  await shot(page, "05-image-loading");
  await waitIdle(page);
  await page.waitForSelector(".media-card .media-frame img[src^=blob]");
  await shot(page, "06-image-done");
});

// ---------------- Video (kino-montaj) ----------------
await session("desktop-video", { width: 1360, height: 860 }, async (page) => {
  await page.click('#modes [data-mode="video"]');
  await page.click('#modeOptions [data-v="10"]');
  await send(page, "Samarqand tongi haqida video");
  await page.waitForSelector(".video-card .skeleton");
  await page.waitForSelector(".stages", { timeout: 20000 });
  await shot(page, "07-video-progress");
  await page.waitForSelector(".video-card video[src^=blob]", { timeout: 90000 });
  await waitIdle(page);
  const info = await page.evaluate(async () => {
    const v = document.querySelector(".video-card video");
    await new Promise((r) => (v.readyState >= 1 ? r() : v.addEventListener("loadedmetadata", r, { once: true })));
    const blob = await fetch(v.src).then((r) => r.blob());
    return { type: blob.type, size: blob.size, dur: v.duration, w: v.videoWidth, h: v.videoHeight };
  });
  console.log("video:", JSON.stringify(info));
  if (info.size < 20000) throw new Error("video fayli juda kichik: " + info.size);
  await shot(page, "08-video-done");
});

// ---------------- Mobil, qorong'i ----------------
await session("mobile-dark", { width: 390, height: 780 }, async (page) => {
  await shot(page, "09-mobile-welcome");
  await page.click("#menuBtn");
  await page.waitForTimeout(400);
  await shot(page, "10-mobile-drawer");
  await page.click("#scrim", { position: { x: 370, y: 400 } });
  await page.click('.starters li:first-child button');
  await waitIdle(page);
  await page.waitForSelector(".codeblock");
  await shot(page, "11-mobile-chat");
  await page.click('[data-act="project-preview"]');
  await page.waitForTimeout(900);
  await shot(page, "12-mobile-preview");
});

await browser.close();
console.log(errors.length ? "XATOLAR:\n" + errors.join("\n") : "Barcha UI sinovlari xatosiz o‘tdi.");
process.exit(errors.length ? 1 : 0);
