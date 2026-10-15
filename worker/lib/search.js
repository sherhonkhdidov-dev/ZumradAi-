// Internet qidiruvi. Eng yaxshisidan oddiyiga: Tavily -> Brave -> DuckDuckGo -> Wikipedia.
// Kalit (secret) berilmasa, kalitsiz usullar sinab ko'riladi.

import { fetchTimeout } from "./util.js";

// So'z boshidan moslashadi (qo'shimchalar ruxsat), lekin so'z o'rtasidan emas: "rekursiya" ≠ "kurs".
const WANTS_SEARCH =
  /(?<!\p{L})(?:internet|qidir|izla|yangilik|so[‘'ʻ’`]?nggi|bugun|hozir|kecha|narx|kurs|valyuta|ob[- ]?havo|natija|chiqdi|versiya|qachon|kim\b|nima bo[‘'ʻ’`]?ldi|manba|latest|today|current|news|weather|price|score|release|who is|when did|202[5-9]|новост|сегодня|сейчас|курс|погода|цена|последн)/iu;

export function wantsSearch(text) {
  return WANTS_SEARCH.test(String(text || ""));
}

export async function searchWeb(env, query, { limit = 5 } = {}) {
  const q = String(query || "").trim().slice(0, 300);
  if (!q) return { provider: null, results: [] };

  const attempts = [];
  if (env.TAVILY_API_KEY) attempts.push(["tavily", () => tavily(env.TAVILY_API_KEY, q, limit)]);
  if (env.BRAVE_API_KEY) attempts.push(["brave", () => brave(env.BRAVE_API_KEY, q, limit)]);
  attempts.push(["duckduckgo", () => duckduckgo(q, limit)]);
  attempts.push(["wikipedia", () => wikipedia(q, limit)]);

  for (const [name, run] of attempts) {
    try {
      const results = await run();
      if (results.length) return { provider: name, results };
    } catch {
      /* keyingi manbaga o'tamiz */
    }
  }
  return { provider: null, results: [] };
}

async function tavily(key, q, limit) {
  const res = await fetchTimeout(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ query: q, max_results: limit, search_depth: "basic" }),
    },
    7000,
  );
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    title: clean(r.title),
    url: r.url,
    snippet: clean(r.content).slice(0, 420),
  }));
}

async function brave(key, q, limit) {
  const res = await fetchTimeout(
    `https://api.search.brave.com/res/v1/web/search?count=${limit}&q=${encodeURIComponent(q)}`,
    { headers: { accept: "application/json", "x-subscription-token": key } },
    7000,
  );
  if (!res.ok) throw new Error(`brave ${res.status}`);
  const data = await res.json();
  return (data.web?.results || []).map((r) => ({
    title: clean(r.title),
    url: r.url,
    snippet: clean(r.description).slice(0, 420),
  }));
}

async function duckduckgo(q, limit) {
  const res = await fetchTimeout(
    "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q),
    { headers: { "user-agent": "Mozilla/5.0 (compatible; ZumradAI/2.0)", accept: "text/html" } },
    6000,
  );
  if (!res.ok) throw new Error(`ddg ${res.status}`);
  const html = await res.text();
  const out = [];
  const seen = new Set();
  const blocks = html.split(/<div class="[^"]*\bresult\b[^"]*"/i).slice(1);
  for (const b of blocks) {
    const link = b.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    let href = link[1].replace(/&amp;/g, "&");
    const redirect = href.match(/[?&]uddg=([^&]+)/);
    if (redirect) {
      try {
        href = decodeURIComponent(redirect[1]);
      } catch {
        /* o'zgarishsiz qoldiramiz */
      }
    }
    if (href.startsWith("//")) href = "https:" + href;
    const snip = b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/i);
    const title = clean(link[2]);
    if (!/^https?:\/\//i.test(href) || !title || seen.has(href)) continue;
    seen.add(href);
    out.push({ title, url: href, snippet: clean(snip ? snip[1] : "").slice(0, 420) });
    if (out.length >= limit) break;
  }
  return out;
}

async function wikipedia(q, limit) {
  // So'rov tiliga qarab Wikipedia tilini tanlaymiz.
  const lang = /[а-яё]/i.test(q) ? "ru" : looksEnglish(q) ? "en" : "uz";
  const res = await fetchTimeout(
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${limit}&format=json&origin=*`,
    { headers: { "user-agent": "ZumradAI/2.0" } },
    6000,
  );
  if (!res.ok) throw new Error(`wiki ${res.status}`);
  const data = await res.json();
  return (data.query?.search || []).map((r) => ({
    title: clean(r.title),
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
    snippet: clean(r.snippet).slice(0, 420),
  }));
}

function looksEnglish(q) {
  return /\b(the|what|who|how|when|is|are|of|in|on|for)\b/i.test(q);
}

function clean(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatSourcesForPrompt(results) {
  return results.map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${s.snippet}`).join("\n\n");
}
