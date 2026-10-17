import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { pickModelKey, looksLikeCode } from "../worker/lib/models.js";
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

test("rasm: Workers AI (FLUX) orqali rasm yaratiladi", async () => {
  const jpeg = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3));
  const calls = [];
  const AI = {
    run(id, args) {
      calls.push(id);
      if (id.includes("flux")) return { image: jpeg };
      return { response: "A majestic snow-capped mountain at sunrise, golden light, ultra detailed" };
    },
  };
  const res = await post({ AI }, "/api/image", { prompt: "tog‘lar" });
  const j = await res.json();
  assert.equal(res.status, 200);
  assert.equal(j.mime, "image/jpeg");
  assert.equal(j.image, jpeg);
  assert.ok(calls.some((c) => c.includes("flux")));
});

test("rasm: hech qanday rasm manbasi bo‘lmasa aniq 503", async () => {
  const res = await post({}, "/api/image", { prompt: "tog‘lar" });
  const j = await res.json();
  assert.equal(res.status, 503);
  assert.equal(j.code, "no_image_provider");
});

test("video: endpointlar olib tashlangan", async () => {
  const res = await post({}, "/api/video/plan", { idea: "x" });
  assert.equal(res.status, 404);
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

test("internet qidiruv intenti saqlanadi", () => {
  assert.equal(wantsSearch("Bugungi yangiliklarni top"), true);
});
