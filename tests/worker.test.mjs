import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { pickModelKey, looksLikeCode } from "../worker/lib/models.js";
import { normalizePlan } from "../worker/lib/video.js";
import { wantsSearch } from "../worker/lib/search.js";

const BASE = "http://zumrad.test";
const call = (env, path, init) => worker.fetch(new Request(BASE + path, init), env, { waitUntil() {} });
const post = (env, path, body, headers = {}) =>
  call(env, path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

test("health: manbalar ro‘yxati", async () => {
  const res = await call({ GEMINI_API_KEY: "k", AI: { run() {} } }, "/api/health");
  const j = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(j.providers, ["gemini", "workers-ai"]);
  assert.equal(j.ai, true);
  const none = await (await call({}, "/api/health")).json();
  assert.equal(none.ai, false);
});

test("chat: hech qanday miya ulanmagan bo‘lsa aniq 503 beradi", async () => {
  const res = await post({}, "/api/chat", { messages: [{ role: "user", content: "Salom" }] });
  const j = await res.json();
  assert.equal(res.status, 503);
  assert.equal(j.code, "own_model_not_configured");
});

test("chat: Gemini limitga yetsa Groq ga o‘tadi", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes("generativelanguage")) {
      return new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "Salom, men Zumrad!" } }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const res = await post({ GEMINI_API_KEY: "a", GROQ_API_KEY: "b" }, "/api/chat", { stream: false, messages: [{ role: "user", content: "Salom" }] });
    const j = await res.json();
    assert.equal(res.status, 200);
    assert.match(j.reply, /Zumrad/);
    assert.equal(urls.length, 2);
    assert.match(urls[1], /groq/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("chat: javob faqat OWN_MODEL_URL serveridan olinadi", async () => {
  const originalFetch = globalThis.fetch;
  let called = "";
  globalThis.fetch = async (url, init) => {
    called = String(url);
    const body = JSON.parse(init.body);
    assert.match(body.messages.at(-1).content, /Salom/);
    return new Response(JSON.stringify({ reply: "Salom! Men Zumradning o‘z modeliman.", model: "Zumrad-test" }), {
      status: 200, headers: { "content-type": "application/json" }
    });
  };
  try {
    const res = await post({ OWN_MODEL_URL: "https://own-model.example" }, "/api/chat", {
      stream: false, messages: [{ role: "user", content: "Salom" }]
    });
    const j = await res.json();
    assert.equal(res.status, 200);
    assert.match(called, /^https:\/\/own-model\.example\/api\/chat$/);
    assert.match(j.reply, /o‘z modeliman/);
    assert.equal(j.model.key, "own");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("chat: OWN_MODEL_API=openai rejimi /v1/chat/completions ga so‘rov yuboradi", async () => {
  const originalFetch = globalThis.fetch;
  let called = "", auth = "";
  globalThis.fetch = async (url, init) => {
    called = String(url);
    auth = init.headers.authorization;
    const body = JSON.parse(init.body);
    assert.equal(body.stream, false);
    assert.match(body.messages.at(-1).content, /Salom/);
    return new Response(JSON.stringify({ model: "zumrad-gguf", choices: [{ message: { role: "assistant", content: "Salom! Men Zumradman." } }] }), {
      status: 200, headers: { "content-type": "application/json" }
    });
  };
  try {
    const res = await post({ OWN_MODEL_URL: "https://llm.example/", OWN_MODEL_API: "openai", OWN_MODEL_TOKEN: "k" }, "/api/chat", {
      stream: false, messages: [{ role: "user", content: "Salom" }]
    });
    const j = await res.json();
    assert.equal(res.status, 200);
    assert.equal(called, "https://llm.example/v1/chat/completions");
    assert.equal(auth, "Bearer k");
    assert.match(j.reply, /Zumradman/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rasm: o‘z rasm modeli yo‘q bo‘lsa tashqi model ishlatmaydi", async () => {
  const res = await post({ AI: { run() { throw new Error("Tashqi model chaqirildi"); } } }, "/api/image", { prompt: "tog‘lar" });
  const j = await res.json();
  assert.equal(res.status, 503);
  assert.equal(j.code, "own_image_not_configured");
});

test("video: generativ tashqi provayderga ulanmaydi", async () => {
  const res = await post({ REPLICATE_API_TOKEN: "fake", REPLICATE_VIDEO_MODEL: "someone/model" }, "/api/video/generate", { prompt: "tog‘lar" });
  const j = await res.json();
  assert.equal(res.status, 503);
  assert.equal(j.code, "own_video_not_configured");
  assert.match(j.error, /Tashqi video AI o‘chirildi/);
});

test("xavfsizlik: boshqa origin POST so‘rovi rad etiladi", async () => {
  const res = await post({}, "/api/chat", { messages: [{ role: "user", content: "Salom" }] }, { origin: "https://evil.example" });
  assert.equal(res.status, 403);
});

test("xavfsizlik: ACCESS_CODE talab qilinadi", async () => {
  const res = await post({ ACCESS_CODE: "secret" }, "/api/chat", { messages: [{ role: "user", content: "Salom" }] });
  assert.equal(res.status, 401);
});

test("intent: kod so‘rovi faqat ichki prompt rejimini belgilaydi, model tanlamaydi", () => {
  assert.equal(pickModelKey("auto", { text: "HTML sayt yarat" }), "code");
  assert.equal(pickModelKey("auto", { text: "Salom" }), "own");
  assert.equal(looksLikeCode("Python function"), true);
});

test("normalizePlan: kadrlar tuzilmasini normallashtiradi", () => {
  const result = normalizePlan({
    title: "Sinov", style: "cinematic", music: "epic",
    scenes: [{ caption: "1", image_prompt: "A mountain", motion: "zoom_in", seconds: 4 },
             { caption: "2", image_prompt: "A river", motion: "pan_left", seconds: 4 }]
  }, { scenes: 2, perScene: 4, aspect: "16:9", idea: "Tabiat" });
  assert.equal(result.scenes.length, 2);
  assert.match(result.scenes[0].image_prompt, /cinematic/);
});

test("internet qidiruv intenti saqlanadi", () => {
  assert.equal(wantsSearch("Bugungi yangiliklarni top"), true);
});
