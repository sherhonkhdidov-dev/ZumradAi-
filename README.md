# Zumrad AI — Own Model Only

Zumrad AI loyihasi foydalanuvchining talabiga ko‘ra **boshqa tayyor AI modellarini chaqirmaydigan** rejimga o‘tkazildi.

## Muhim haqiqat

- Chat va kod javoblari faqat `OWN_MODEL_URL` orqali o‘zingiz joylashtirgan Zumrad model serveriga yuboriladi.
- Workers AI, Gemma, Llama, Qwen, FLUX, Lucid va Replicate endi ilovaning chat/rasm/video yo‘llarida chaqirilmaydi.
- `experiments/own-model/` ichidagi TinyZumradLM noldan yozilgan kichik Transformer; unga sodda, o‘zimiz yozgan Unicode pair-merge BPE tokenizer qo‘shildi. U hali kuchli, ko‘p tilli yoki kodga ixtisoslashgan model emas. Uni kichik matnlar bilan o‘qitish Claude darajasidagi natija bermaydi.
- O‘z rasm va video modellari hozircha yo‘q. Ilova tashqi modelni yashirincha ishlatmaydi; tegishli o‘z modelingiz ulanmaguncha aniq xato xabari ko‘rsatadi.
- Internet qidiruvi (DuckDuckGo/Tavily/Brave) AI modeli emas, lekin tashqi internet xizmatidir. U alohida qidiruv funksiyasi sifatida qoladi.

## Tuzilma

- `worker/` — Cloudflare Worker API va veb ilova.
- `experiments/own-model/` — o‘z matn modelini o‘qitish va ishga tushirish kodi.
- `OWN_MODEL_URL` — o‘zingiz joylashtirgan matn modeli serverining asosiy URL manzili. Worker `/api/chat` endpointiga so‘rov yuboradi.
- `OWN_IMAGE_URL` — faqat keyinchalik o‘zingiz ishlab chiqqan rasm modeli API manzili.
- `OWN_VIDEO_URL` — kelajakdagi o‘z video modeli API manzili uchun ajratilgan sozlama.

## O‘z modelini o‘qitish laboratoriyasi

`experiments/own-model/README.md` va `TRAINING_PLAN.md` ichida matn/kod, rasm diffusion va video 3D diffusion uchun alohida o‘qitish buyruqlari bor. 68 ta boshlang‘ich o‘zbekcha/kod misoli, alohida validation to‘plami, dataset tekshiruvi va baholash skripti qo‘shilgan. Qisqa treningni ishga tushirdik, ammo checkpoint javoblari hozircha sifatsiz; u ishlab chiqarishda ishlatishga tayyor emas. Bular tayyor o‘qitilgan modellar emas: rasm modeli hozircha promptni tushunmaydi, video modeli tadqiqot darajasida. Litsenziyali ma’lumotlar va GPU kerak.

## O‘z matn modelingizni o‘qitish

1. Python 3.11+ va PyTorch o‘rnatilgan kompyuter/server kerak. Android telefonda o‘qitish juda sekin yoki imkonsiz bo‘lishi mumkin.
2. `experiments/own-model/` ichida `data/` papkasini yarating.
3. O‘zingizga tegishli yoki foydalanishga ruxsatingiz bor `.txt` ma’lumotlarni `data/` ichiga joylang. O‘zbekcha suhbat, tushuntirish va kod misollari sifatli, toza bo‘lsin.
4. O‘sha papkada quyidagilarni bajaring:

```bash
pip install -r requirements.txt
python train.py --data data --steps 5000
uvicorn server:app --host 0.0.0.0 --port 8000
```

O‘qitish `out/model.pt`, `out/best_model.pt`, `out/tokenizer.json` va `out/vocab.json` yaratadi. `server.py` faqat shu vaznlar mavjud bo‘lsa javob beradi. Bu minimal tajriba kodi; natija ma’lumotlar hajmi/sifati va hisoblash quvvatiga bog‘liq.

## Cloudflare ulash

1. O‘z model serveringizni HTTPS orqali joylashtiring.
2. Cloudflare Worker → Settings → Variables and Secrets bo‘limida `OWN_MODEL_URL` ni server URL’iga sozlang.
3. Serverda `OWN_MODEL_TOKEN` ishlatsangiz, Worker’da ham xuddi shu qiymatni Secret sifatida qo‘shing.
4. Deploy qiling va `/api/health` ni oching. `aiMode` `own-model-only` bo‘lishi kerak.
5. `/health` server endpointi `trained_model_loaded: true` qaytarsa, vaznlar yuklangan.

## Rasm va video

Hozircha o‘z rasm/video generatsiya modeli tayyor emas. `OWN_IMAGE_URL` yoki `OWN_VIDEO_URL` ni faqat o‘zingizning haqiqiy model serveringiz bo‘lganda sozlang. Bu loyiha ichida hozircha o‘qitilgan rasm/video neyron tarmoqlari mavjud emas; oddiy matn modelini o‘qitishning o‘zi rasm yoki video generatsiya qila olmaydi.

## Test

```bash
npm install
npm test
```


## Content Credentials (C2PA)

See `experiments/own-model/CONTENT_CREDENTIALS_C2PA.md` and `add_content_credentials.py` for adding signed provenance manifests to generated media. Signing requires server-side certificate/key credentials; no private key is bundled.


## Code & Design Studio (v12)

Open `/studio.html` after deployment for the new local project starter builder. It creates portfolio, school dashboard, online shop, and SaaS dashboard projects, with live preview and downloadable ZIP output. This is template-assisted and does not pretend the tiny own-model checkpoint is already professional. See `PROFESSIONAL_FULL_V12.md`.
