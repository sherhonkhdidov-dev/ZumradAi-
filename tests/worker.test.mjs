import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { makeFakeAI } from "../scripts/mock-ai.mjs";
import { ThinkFilter, extractJson, sniffImageMime } from "../worker/lib/util.js";
import { pickModelKey, looksLikeCode } from "../worker/lib/models.js";
import { normalizePlan } from "../worker/lib/video.js";
import { wantsSearch } from "../worker/lib/search.js";

const BASE = "http://zumrad.test";
const call = (env, path, init) => worker.fetch(new Request(BASE + path, init), env, { waitUntil() {} });
const post = (env, path, body, headers = {}) =>
  call(env, path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

async function readSse(res) {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((b) => b.startsWith("data:"))
    .map((b) => JSON.parse(b.slice(5)));
}

test("health: sozlamalar holatini qaytaradi", async () => {
  const res = await call({ AI: makeFakeAI() }, "/api/health");
  const j = await res.json();
  assert.equal(j.ok, true);
  assert.equal(j.ai, true);
  assert.equal(j.video.montage, true);
  assert.equal(j.video.generative, false);
  assert.match(j.models.fast.id, /gemma/);
});

test("chat (oqim): Gemma formatidagi oqimni to'g'ri yig'adi", async () => {
  const env = { AI: makeFakeAI({ delayMs: 0 }) };
  const res = await post(env, "/api/chat", { messages: [{ role: "user", content: "Salom, qalaysan?" }], model: "fast" });
  assert.equal(res.headers.get("content-type").startsWith("text/event-stream"), true);
  const events = await readSse(res);
  assert.equal(events[0].type, "meta");
  const text = events.filter((e) => e.type === "token").map((e) => e.t).join("");
  assert.match(text, /Zumrad AI/);
  assert.equal(events.at(-1).type, "done");
  assert.equal(events.find((e) => e.type === "model").key, "fast");
});

test("chat: kod so'rovi avtomatik kod modeliga yo'naltiriladi (Llama formati)", async () => {
  const log = [];
  const env = { AI: makeFakeAI({ delayMs: 0, log }) };
  const res = await post(env, "/api/chat", { messages: [{ role: "user", content: "Python bilan telegram bot yozib ber" }] });
  const events = await readSse(res);
  assert.equal(events.find((e) => e.type === "model").key, "code");
  assert.match(log[0].model, /qwen2.5-coder/);
  const text = events.filter((e) => e.type === "token").map((e) => e.t).join("");
  assert.match(text, /```html:index\.html/);
});

test("chat: birinchi model ishlamasa zaxira modelga o'tadi", async () => {
  const env = { AI: makeFakeAI({ delayMs: 0, failModels: ["@cf/google/gemma-4-26b-a4b-it"] }) };
  const res = await post(env, "/api/chat", { messages: [{ role: "user", content: "Salom" }], model: "fast" });
  const events = await readSse(res);
  const model = events.find((e) => e.type === "model");
  assert.equal(model.key, "smart");
  assert.equal(events.at(-1).type, "done");
});

test("chat: kvota tugasa tushunarli o'zbekcha xabar beradi", async () => {
  const ai = { run: async () => { throw new Error("4006: you have used up your daily free allocation of 10,000 neurons"); } };
  const res = await post({ AI: ai }, "/api/chat", { messages: [{ role: "user", content: "Salom" }] });
  const events = await readSse(res);
  const err = events.find((e) => e.type === "error");
  assert.match(err.message, /10 000 neyron/);
});

test("chat: rasm biriktirilsa ko'rish qobiliyatli modelga multimodal xabar yuboriladi", async () => {
  const log = [];
  const env = { AI: makeFakeAI({ delayMs: 0, log }) };
  const img = "data:image/png;base64,iVBORw0KGgo=";
  await (await post(env, "/api/chat", { messages: [{ role: "user", content: "Bu nima?", images: [img] }], model: "code" })).text();
  assert.match(log[0].model, /gemma/);
  const last = log[0].input.messages.at(-1);
  assert.equal(last.content[1].type, "image_url");
});

test("chat: oqimsiz rejim JSON qaytaradi", async () => {
  const env = { AI: makeFakeAI({ delayMs: 0 }) };
  const res = await post(env, "/api/chat", { messages: [{ role: "user", content: "Salom" }], stream: false });
  const j = await res.json();
  assert.match(j.reply, /Zumrad AI/);
});

test("rasm: o'zbekcha tavsif inglizchaga boyitiladi va rasm qaytadi", async () => {
  const log = [];
  const env = { AI: makeFakeAI({ log }) };
  const res = await post(env, "/api/image", { prompt: "Samarqand Registoni kechqurun", aspect: "16:9" });
  const j = await res.json();
  assert.equal(j.enhanced, true);
  assert.match(j.prompt, /Registan/);
  assert.equal(j.mime, "image/png");
  const bytes = Buffer.from(j.image, "base64");
  assert.equal(sniffImageMime(bytes), "image/png");
  assert.match(log.at(-1).model, /flux-1-schnell/);
});

test("rasm: sifatli rejim Lucid modelini o'lcham bilan chaqiradi", async () => {
  const log = [];
  const env = { AI: makeFakeAI({ log }) };
  await post(env, "/api/image", { prompt: "tog‘ ko‘li", quality: "hq", aspect: "9:16" });
  const call = log.at(-1);
  assert.match(call.model, /lucid-origin/);
  assert.equal(call.input.width, 720);
  assert.equal(call.input.height, 1280);
});

test("video ssenariy: JSON tuzilmasi tozalanib, uslub har bir kadrga qo'shiladi", async () => {
  const env = { AI: makeFakeAI() };
  const res = await post(env, "/api/video/plan", { idea: "Samarqandda tong", seconds: 20, aspect: "16:9" });
  const plan = await res.json();
  assert.equal(plan.scenes.length, 5);
  assert.ok(plan.scenes.every((s) => s.caption && s.image_prompt.includes("teal and gold")));
  assert.ok(["calm", "uplifting", "epic", "mysterious"].includes(plan.music));
});

test("video: generativ provayder sozlanmagan bo'lsa 503 va aniq xabar", async () => {
  const res = await post({ AI: makeFakeAI() }, "/api/video/generate", { prompt: "x" });
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /REPLICATE/);
});

test("xavfsizlik: boshqa saytdan kelgan POST rad etiladi", async () => {
  const res = await post({ AI: makeFakeAI() }, "/api/chat", { messages: [{ role: "user", content: "x" }] }, { origin: "https://evil.example" });
  assert.equal(res.status, 403);
});

test("xavfsizlik: ACCESS_CODE o'rnatilgan bo'lsa kod talab qilinadi", async () => {
  const env = { AI: makeFakeAI({ delayMs: 0 }), ACCESS_CODE: "sir123" };
  const body = { messages: [{ role: "user", content: "Salom" }], stream: false };
  assert.equal((await post(env, "/api/chat", body)).status, 401);
  assert.equal((await post(env, "/api/chat", body, { "x-access-code": "xato" })).status, 401);
  assert.equal((await post(env, "/api/chat", body, { "x-access-code": "sir123" })).status, 200);
  assert.equal((await call(env, "/api/health")).status, 200); // health ochiq
});

test("xavfsizlik: tezlik cheklovi", async () => {
  const env = { AI: makeFakeAI({ delayMs: 0 }) };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html></html>"); // tashqi qidiruvga chiqmaymiz
  let last;
  for (let i = 0; i < 30; i++) {
    last = await call(env, "/api/search?q=test", { headers: { "cf-connecting-ip": "9.9.9.9" } });
    await last.text();
    if (last.status === 429) break;
  }
  globalThis.fetch = realFetch;
  assert.equal(last.status, 429);
});

test("chat: parametr nomi rad etilsa, shu modelning o'zida muqobil nom bilan qayta urinadi", async () => {
  const calls = [];
  const inner = makeFakeAI({ delayMs: 0 });
  const ai = {
    run: async (model, input) => {
      calls.push({ model, keys: Object.keys(input) });
      if ("max_completion_tokens" in input) throw new Error("AiError: Unrecognized key: max_completion_tokens");
      return inner.run(model, input);
    },
  };
  const res = await post({ AI: ai }, "/api/chat", { messages: [{ role: "user", content: "Salom" }], model: "fast" });
  const events = await readSse(res);
  assert.equal(events.find((e) => e.type === "model").key, "fast"); // qimmatroq modelga tushmadi
  assert.equal(calls.length, 2);
  assert.ok(calls[1].keys.includes("max_tokens"));
});

test("AI binding yo'q bo'lsa chat 503 va yo'l-yo'riq beradi", async () => {
  const res = await post({}, "/api/chat", { messages: [{ role: "user", content: "Salom" }] });
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /Workers AI binding/);
});

/* ---- yordamchi funksiyalar ---- */

test("ThinkFilter: bo'laklarga bo'lingan <think> blokini olib tashlaydi", () => {
  const f = new ThinkFilter();
  const parts = ["Salom <thi", "nk>yashirin fik", "r</think> dunyo", "!"];
  const out = parts.map((p) => f.push(p)).join("") + f.flush();
  assert.equal(out, "Salom  dunyo!");
});

test("extractJson: ```json bilan o'ralgan va vergul xatosi bor javobni ham o'qiydi", () => {
  const j = extractJson('Mana:\n```json\n{"a":1,"b":[1,2,],"c":"}"}\n```');
  assert.deepEqual(j, { a: 1, b: [1, 2], c: "}" });
});

test("normalizePlan: kam kadr bo'lsa xato beradi", () => {
  assert.throws(() => normalizePlan({ scenes: [{ image_prompt: "x" }] }, { scenes: 4, perScene: 4, aspect: "16:9", idea: "x" }));
});

test("model tanlash va qidiruv aniqlash", () => {
  assert.equal(pickModelKey("auto", { text: "Salom" }), "fast");
  assert.equal(pickModelKey("auto", { text: "JavaScript funksiya yoz" }), "code");
  assert.equal(pickModelKey("smart", { text: "kod" }), "smart");
  assert.equal(looksLikeCode("bugun ob-havo qanday"), false);
  assert.equal(wantsSearch("bugungi dollar kursi qancha"), true);
  assert.equal(wantsSearch("rekursiya nima"), false);
});
