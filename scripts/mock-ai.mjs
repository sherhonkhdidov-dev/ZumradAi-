// Cloudflare Workers AI ni taqlid qiluvchi soxta "AI" — mahalliy sinov uchun (haqiqiy hisob kerak emas).
// Chat uchun ikki xil oqim formatini (Llama: {"response"}, Gemma: OpenAI "choices") ham beradi.

import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Tavsifdan rang oladigan chiroyli gradient PNG (haqiqiy rasm o'rniga). */
export function fakePng(seedText = "", w = 640, h = 640) {
  let hash = 0;
  for (const ch of seedText) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const hsl = (hh, s, l) => {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + hh / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const dx = x / w - 0.5;
      const dy = y / h - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy);
      const [R, G, B] = hsl((hue + x / 6 + y / 9) % 360, 0.6, 0.25 + 0.45 * (1 - Math.min(1, r * 1.6)));
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = R; raw[o + 1] = G; raw[o + 2] = B;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CODE_REPLY = `Mana ishlaydigan to‘liq sahifa. U telefon va kompyuterda moslashadi.

\`\`\`html:index.html
<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salom</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<main>
  <h1>Salom, dunyo</h1>
  <button id="b">Bos</button>
  <p id="out"></p>
</main>
<script src="app.js"></script>
</body>
</html>
\`\`\`

\`\`\`css:style.css
body{font-family:system-ui;background:#0f2a21;color:#e8fff5;display:grid;place-items:center;min-height:100vh;margin:0}
button{padding:12px 20px;border:0;border-radius:10px;background:#2bd39a;font-weight:700}
\`\`\`

\`\`\`javascript:app.js
let n = 0;
document.getElementById('b').onclick = () => {
  n++;
  document.getElementById('out').textContent = 'Bosildi: ' + n;
};
\`\`\`

**Ishga tushirish:** \`index.html\` faylini brauzerda oching.`;

const PLAIN_REPLY = `Albatta! Bu **Zumrad AI** sinov javobi.

- Birinchi band
- Ikkinchi band, \`inline kod\` bilan

| Ustun | Qiymat |
|---|---|
| A | 1 |
| B | 2 |

Rahmat!`;

function textOf(content) {
  if (Array.isArray(content)) return content.filter((p) => p.type === "text").map((p) => p.text).join("\n");
  return String(content || "");
}

export function makeFakeAI({ delayMs = 12, failModels = [], log = [] } = {}) {
  return {
    async run(model, input) {
      log.push({ model, input });
      if (failModels.includes(model)) throw new Error("5007: No such model " + model);

      if (/flux|lucid/.test(model)) {
        const w = input.width && input.height ? Math.min(input.width, 640) : 640;
        const h = input.width && input.height ? Math.round((w * input.height) / input.width) : 640;
        return { image: fakePng(input.prompt, w, h).toString("base64") };
      }

      const messages = input.messages || [];
      const system = textOf(messages[0]?.content);
      const user = textOf(messages[messages.length - 1]?.content);
      if (user.includes("__quota__")) throw new Error("4006: you have used up your daily free allocation of 10,000 neurons");
      let reply;
      if (/prompt engineer/i.test(system)) {
        reply = "A cinematic photograph of Registan square in Samarkand at blue hour, glowing turquoise domes, warm lantern light, wide composition, shallow haze, rich teal and gold palette, ultra detailed";
      } else if (/storyboard artist/i.test(system)) {
        const n = Number(/exactly (\d+) scenes/.exec(system)?.[1] || 4);
        const motions = ["zoom_in", "pan_right", "zoom_out", "pan_left", "pan_up"];
        reply = "```json\n" + JSON.stringify({
          title: "Samarqand tongi",
          style: "cinematic, teal and gold palette, soft morning light",
          music: "uplifting",
          scenes: Array.from({ length: n }, (_, i) => ({
            caption: ["Tong otadi", "Ko‘chalar uyg‘onadi", "Non hidi taraladi", "Registonda quyosh", "Yangi kun boshlanadi", "Shahar jonlanadi", "Xalq yig‘iladi", "Xayrli tong"][i % 8],
            image_prompt: "Ancient Silk Road city street scene number " + (i + 1) + ", people and architecture, golden light",
            motion: motions[i % motions.length],
            seconds: 4,
          })),
        }) + "\n```";
      } else if (/```|kod|code|sayt|html|python/i.test(user)) {
        reply = CODE_REPLY;
      } else {
        reply = PLAIN_REPLY;
      }

      const gemmaStyle = /gemma/.test(model);
      if (!input.stream) {
        return gemmaStyle ? { choices: [{ message: { role: "assistant", content: reply } }], usage: {} } : { response: reply, usage: {} };
      }

      const enc = new TextEncoder();
      const pieces = reply.match(/[\s\S]{1,14}/g) || [];
      return new ReadableStream({
        async start(controller) {
          for (const p of pieces) {
            const payload = gemmaStyle ? { choices: [{ delta: { content: p } }] } : { response: p };
            controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
            await new Promise((r) => setTimeout(r, user.includes("__slow__") ? 90 : delayMs));
          }
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
    },
  };
}
