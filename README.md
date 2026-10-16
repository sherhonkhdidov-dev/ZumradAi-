# Zumrad AI

O‘zbek tilidagi AI yordamchi: **suhbat, kod (jonli ko‘rinish bilan), rasm va video**. Zumrad 1.0 (suhbat), Zumrad 1.3 (rasm), Zumrad 1.5 (video) — ichki motor Cloudflare Workers AI dagi tayyor ochiq modellar; alohida server ham, API kaliti ham kerak emas. O'z og'irliklaringizni o'qitish uchun `finetune/` papkasiga qarang.

## Nimalar qila oladi

| | Qanday ishlaydi |
|---|---|
| **Suhbat** | Oqimli (harf-harf) javob. Model avtomatik tanlanadi: oddiy savol → Gemma 4, kod → Qwen 2.5 Coder, qo‘lda “Aqlli” → Llama 3.3 70B. Biri ishlamasa, zaxira modelga o‘tadi. |
| **Kod** | To‘liq, ishlaydigan fayllar yozadi. Har fayl alohida blokda, nusxa/yuklab olish bilan. HTML/SVG uchun **jonli ko‘rinish** (telefon/planshet/kompyuter o‘lchamida), ko‘p fayl uchun **ZIP**. Ko‘rinishda xato chiqsa, “AI bilan tuzatish” tugmasi xatoni AI ga yuboradi. |
| **Dizayn** | Tizim ko‘rsatmasida dizayn qoidalari bor: mobil-birinchi, aniq palitra va shrift, real matn (lorem ipsum yo‘q), ishlaydigan formalar va holatlar. |
| **Rasm** | O‘zbekcha tavsifni AI avval inglizcha professional promptga aylantiradi, keyin FLUX.1 schnell (tez) yoki Lucid Origin (sifatli, o‘lchamni tanlash mumkin) chizadi. |
| **Video** | AI ssenariy yozadi → har kadr FLUX bilan chiziladi → brauzer kadrlarni kino-harakat, o‘tishlar, subtitr va musiqa bilan **haqiqiy MP4/WebM faylga** yig‘adi. Tashqi xizmat kerak emas. Ixtiyoriy: Replicate orqali generativ model. |
| **Rasm tahlili** | Rasm tashlasangiz, Gemma 4 uni ko‘radi va tushuntiradi. Matn/kod fayllari ham o‘qiladi. |
| **Internet** | Yangilik, narx, bugungi voqealar so‘ralsa, avtomatik qidiradi va manbalarni `[1]` havolalari bilan ko‘rsatadi. |
| **Saqlash** | Suhbatlar, rasmlar, videolar shu qurilma brauzerida (IndexedDB) saqlanadi. PWA sifatida telefonga o‘rnatiladi. |

## Muhim cheklovlar (ochiq aytamiz)

- **Bepul kvota**: Cloudflare kuniga 10 000 “neyron” beradi (UTC 00:00, ya’ni 05:00 Toshkent vaqti bilan yangilanadi). Taxminiy sig‘im: ~250 ta oddiy javob, ~35 ta uzun kod javobi, ~100 ta rasm yoki ~15–20 ta video. Tugasa, ilova buni tushunarli xabar bilan aytadi. “Sifatli” rasm kvotani ~20 baravar tez sarflaydi.
- **Video** — “kino-montaj”: AI chizgan statik kadrlar harakatga keltiriladi. Bu Sora/Veo kabi to‘liq generativ video emas. Montaj paytida (~10–30 s) ekranni o‘chirmang.
- Model sifati tanlangan modellarga bog‘liq; Claude bilan bir xil emas. Modellarni almashtirish — `wrangler.toml` dagi izohga qarang.
- Ochiq saytga **kirish kodi** qo‘ying (`ACCESS_CODE`), aks holda begonalar kvotangizni ishlatib yuboradi.

## Loyiha tuzilmasi

```
worker/            Cloudflare Worker (API)
  index.js         marshrutlar, xavfsizlik, chat oqimi
  lib/prompts.js   AI "miyasi": tizim ko‘rsatmalari (kod, dizayn, tillar)
  lib/models.js    modellar va tanlash mantiqi
  lib/ai.js        Workers AI bilan ishlash, oqim, zaxira modellar
  lib/image.js     rasm: prompt boyitish + FLUX/Lucid
  lib/video.js     video ssenariy (+ ixtiyoriy Replicate)
  lib/search.js    internet qidiruvi
web/               Frontend (build kerak emas)
  js/              chat, preview, media, videoRender, store...
  css/app.css      dizayn tizimi
  vendor/          marked, DOMPurify, highlight.js, JSZip (ichiga joylangan)
tests/             Worker testlari (20 ta)
scripts/           mock server va brauzer sinovlari
experiments/       eski tajribalar (ilovaga kirmaydi)
```

## Mahalliy ishga tushirish

```bash
npm install
npm test             # Worker testlari (Cloudflare hisobi shart emas)
npm run dev:mock     # soxta AI bilan to‘liq interfeys: http://localhost:8788
npm run dev          # haqiqiy Workers AI bilan (wrangler login kerak)
```

Brauzer sinovlari (ixtiyoriy): `npm i -D playwright && npx playwright install chromium`, so‘ng `npm run dev:mock` ishlab turganda `node scripts/ui-smoke.mjs`.

## AI ni “o‘rgatish” (sozlash)

AI ning xulqi `worker/lib/prompts.js` da. Masalan, javob uslubini, dizayn qoidalarini yoki kod yozish talablarini o‘sha yerda o‘zgartirasiz — qayta o‘qitish kerak emas. Rasm prompti qoidalari (`IMAGE_PROMPT_SYSTEM`) va video ssenariy shabloni (`videoPlanSystem`) ham shu faylda.

## Deploy

GitHub → Cloudflare bo‘yicha qadamma-qadam qo‘llanma: **[DEPLOY.md](DEPLOY.md)**.
