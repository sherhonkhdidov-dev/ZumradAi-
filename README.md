# Zumrad AI

Zumrad AI — o‘zbek tilidagi AI yordamchi: chat, kod, rasm/video, ovozli boshqaruv va Code & Design Studio. Cloudflare Workers ustida ishlaydi va **boshqa tayyor AI modellarini chaqirmaydi**.

## Tuzilma

- `web/` — sayt (frontend), `studio.html` — Code & Design Studio.
- `worker/` — Cloudflare Worker API.
- `model-server/` — Zumrad'ning o‘z modeli serveri (Python/PyTorch) va uni o‘qitish kodi. Render uchun `render.yaml` + `Dockerfile` bor.
- `android/` — Android ilova: sayt + fon rejimida «Zumrad» deb chaqirish. APK'ni GitHub Actions yig‘adi (Releases → `apk-latest`).
- `extension/` — kompyuterdagi Chrome uchun ovozli buyruq kengaytmasi (`VOICE_VA_BRAUZER.md`).
- `tests/`, `scripts/` — testlar va lokal mock server.

## Sozlamalar (Cloudflare → Settings → Variables and Secrets)

- `OWN_MODEL_URL` — model serverining HTTPS manzili (masalan Render'dagi `https://zumrad-own-model.onrender.com`).
- `OWN_MODEL_TOKEN` — Render'da avtomatik yaratiladi; Cloudflare'ga ham xuddi shu qiymatni Secret qilib qo‘shing.
- `OWN_IMAGE_URL`, `OWN_VIDEO_URL` — faqat o‘z rasm/video model serveringiz bo‘lsa.
- `ACCESS_CODE` — saytga kirishni cheklash (ixtiyoriy).
- `TAVILY_API_KEY` yoki `BRAVE_API_KEY` — internet qidiruvi uchun (ixtiyoriy).

Deploydan so‘ng `/api/health` da `aiMode: "own-model-only"` ko‘rinishi kerak. Batafsil: `DEPLOY.md`.

## Android ilova

1. `android/app/src/main/res/values/config.xml` ichida `app_url` ni o‘z saytingiz manziliga o‘zgartiring.
2. Push qiling — Actions APK'ni yig‘adi. GitHub → Releases → **Zumrad AI (Android)** dan `ZumradAI.apk` ni telefonga yuklab o‘rnating.
3. Ilovani bir marta oching: mikrofon, bildirishnoma va «boshqa ilovalar ustida ko‘rsatish» ruxsatlarini bering. Shundan keyin ilova yopiq bo‘lsa ham «Zumrad» desangiz "Eshitaman" deydi va buyruqni bajaradi.

## Test

```bash
npm install
npm test
```

## Miya serveri (limitsiz, o‘zingiz joylagan)

`llm-server/` — Hugging Face Space (Docker) uchun tayyor ochiq model serveri. Cloudflare'da `OWN_MODEL_API=openai` bilan ulanadi. Qadamlar: `llm-server/README.md`.
