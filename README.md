# Zumrad AI

Zumrad AI — o‘zbek tilidagi AI yordamchi: chat, kod, rasm/video, ovozli boshqaruv va Code & Design Studio. Cloudflare Workers ustida ishlaydi va **boshqa tayyor AI modellarini chaqirmaydi**.

## Tuzilma

- `web/` — sayt (frontend), `studio.html` — Code & Design Studio.
- `worker/` — Cloudflare Worker API.
- `extension/` — ovozli buyruqlar uchun Chrome kengaytmasi (`VOICE_VA_BRAUZER.md`).
- `tests/`, `scripts/` — testlar va lokal mock server.

## Sozlamalar (Cloudflare → Settings → Variables and Secrets)

- `OWN_MODEL_URL` — o‘zingiz joylashtirgan matn modeli serverining HTTPS manzili (Worker `/api/chat` ga so‘rov yuboradi).
- `OWN_MODEL_TOKEN` — ixtiyoriy Secret, serverdagi token bilan bir xil.
- `OWN_IMAGE_URL`, `OWN_VIDEO_URL` — faqat o‘z rasm/video model serveringiz bo‘lsa.
- `ACCESS_CODE` — saytga kirishni cheklash (ixtiyoriy).
- `TAVILY_API_KEY` yoki `BRAVE_API_KEY` — internet qidiruvi uchun (ixtiyoriy).

Deploydan so‘ng `/api/health` da `aiMode: "own-model-only"` ko‘rinishi kerak. Batafsil: `DEPLOY.md`.

## Test

```bash
npm install
npm test
```
