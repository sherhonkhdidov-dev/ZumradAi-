// Mahalliy sinov serveri: haqiqiy Worker kodi + soxta AI + web/ papkasi.
// Ishga tushirish:  npm run dev:mock   →  http://localhost:8788
// Bu Cloudflare hisobisiz ham interfeys va butun oqimni sinab ko'rish imkonini beradi.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../worker/index.js";
import { makeFakeAI } from "./mock-ai.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "web");
const port = Number(process.env.PORT || 8788);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".txt": "text/plain",
};

const env = {
  AI: makeFakeAI({ delayMs: Number(process.env.MOCK_DELAY || 15) }),
  ACCESS_CODE: process.env.ACCESS_CODE || undefined,
  ASSETS: {
    async fetch(request) {
      let path = decodeURIComponent(new URL(request.url).pathname);
      if (path.endsWith("/")) path += "index.html";
      const file = normalize(join(root, path));
      if (!file.startsWith(root)) return new Response("Forbidden", { status: 403 });
      try {
        const data = await readFile(file);
        return new Response(data, { headers: { "content-type": TYPES[extname(file)] || "application/octet-stream" } });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  },
};

http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
    });
    const response = await worker.fetch(request, env, { waitUntil() {} });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body) return res.end();
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  })
  .listen(port, () => console.log(`Zumrad AI (mock) → http://localhost:${port}`));
