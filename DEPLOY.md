# Zumrad AI — o‘z modelini ulash

Bu versiya boshqa tayyor AI modellarini ishlatmaydi. Cloudflare Worker faqat sizning `OWN_MODEL_URL` serveringizga so‘rov yuboradi.

## 1. Avval o‘z matn modelini o‘qiting

`experiments/own-model/README.md` ko‘rsatmalarini bajaring. Python/PyTorch serveri va model vaznlari kerak. O‘qitilmagan model javob bera olmaydi. Bu kichik character-level tajriba modeli; Claude sifatidagi javoblarni kutmang.

## 2. Model serverini joylashtirish

Serverni HTTPS bilan ochiq qiladigan o‘zingiz boshqaradigan serverga joylashtiring. `GET /health` `trained_model_loaded: true` qaytarishi kerak. Agar `OWN_MODEL_TOKEN` ishlatsangiz, uni server environment variable sifatida o‘rnating.

## 3. Cloudflare Worker

Worker → Settings → Variables and Secrets:

- `OWN_MODEL_URL` — o‘z model serveringizning HTTPS manzili.
- `OWN_MODEL_TOKEN` — ixtiyoriy Secret, serverdagi token bilan bir xil.
- `ACCESS_CODE` — saytga kirishni cheklash uchun ixtiyoriy Secret.
- `TAVILY_API_KEY` yoki `BRAVE_API_KEY` — faqat internet qidiruvi uchun ixtiyoriy; bular AI modeli emas.

`wrangler.toml` ichida Workers AI binding yo‘q. Eski `MODEL_FAST`, `MODEL_CODE`, `REPLICATE_API_TOKEN` kabi o‘zgaruvchilar endi kerak emas.

## 4. Holatni tekshirish

`/api/health` endpointida `aiMode: "own-model-only"` va `externalAiModels: false` ko‘rinishi kerak.

## 5. Rasm va video

Hozir o‘z rasm va video neyron tarmoqlari mavjud emas. Ilova FLUX, Lucid, Replicate yoki boshqa tayyor AI modeliga murojaat qilmaydi. Rasm/video uchun keyin alohida o‘z modelingizni o‘qitish va `OWN_IMAGE_URL` / `OWN_VIDEO_URL` API serverlarini ishlab chiqish kerak bo‘ladi.
