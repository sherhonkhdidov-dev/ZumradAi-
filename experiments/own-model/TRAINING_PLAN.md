# Zumrad AI — real trening rejasi

Bu loyiha tayyor model vaznlarini yuklab olmaydi va tashqi AI API chaqirmaydi. Barcha tarmoq vaznlari noldan boshlanadi. Shuning uchun modelning foydasi faqat haqiqiy treningdan keyin paydo bo‘ladi.

## 1-bosqich: matn va kod

1. `data/seed_uzbek_code.jsonl` — o‘zbekcha tushuntirishlar, Python/JS/HTML/CSS/SQL, UI/UX va AI trening asoslaridan iborat boshlang‘ich o‘quv to‘plami.
2. `data/validation.jsonl` — treningga kiritilmaydigan kichik alohida baholash to‘plami.
3. O‘zingizning ruxsatli va sifatli `.txt` yoki `.jsonl` ma’lumotlaringizni `data/` ichiga qo‘shing. Har bir prompt uchun aniq, tekshirilgan javob yozing.
4. `python check_data.py` bilan JSONL formatini tekshiring.
5. Avval kichik sinov qiling: `python train.py --steps 20 --batch-size 2 --block-size 128 --eval-every 10 --save-every 10`.
6. So‘ng treningni davom ettiring: `python train.py --steps 5000 --batch-size 4 --gradient-accumulation 4 --block-size 256 --resume`.
7. `python evaluate.py` bilan checkpointni alohida savollarda baholang; `out/evaluation.json` ichidagi model javoblarini odam tekshirsin.

## 2-bosqich: datasetni kengaytirish

- Bitta takroriy savolni ko‘paytirish o‘rniga turli vazifa va qiyinchilik darajalarini qo‘shing.
- Kod misollari sintaksis va test bilan tekshirilgan bo‘lsin.
- O‘zbek lotin/kirill, rus va ingliz misollarini kerakli nisbatda alohida kuzating.
- Faqat treningga ruxsatli, litsenziyasi aniq ma’lumotdan foydalaning.
- Validation savollarini treningga aralashtirmang.

## 3-bosqich: kuchliroq til modeli

Hozirgi TinyZumradLM — character-level, kichik Transformer. U trening jarayonini o‘rganish uchun. Keyingi katta muhandislik bosqichi — yaxshiroq subword tokenizer, instruction loss masking, katta kontekst, barqaror checkpoint resume, ko‘proq tekshirilgan kod ma’lumotlari va mustaqil benchmark. Hozirgi tokenizer — sodda, o‘zimiz yozgan Unicode pair-merge tajribasi; u ishlab chiqarish darajasidagi tokenizer emas. Bu o‘zgarishlar bilan ham katta miqyosdagi sifat uchun ko‘p GPU-soat va katta ma’lumot talab qilinadi.

## 4-bosqich: rasm va video

`train_image.py` hozir promptni tushunmaydigan unconditional denoiser; `train_video.py` esa video kadrlariga shovqin bashoratini o‘rgatadigan tajriba. Ularni hozircha Zumrad AI chatiga haqiqiy prompt-to-image/video funksiyasi sifatida ulash mumkin emas. Keyingi bosqichda matn encoder/conditioning, litsenziyali rasm-caption va video-caption ma’lumotlari, to‘liq sampler va sifat metrikalari alohida ishlab chiqilishi kerak.

## Hisoblash

3 GB RAM’li Android telefon katta Transformer yoki diffusion treningi uchun mos emas. Telefonda fayllarni boshqarish va kichik CPU sinovlarini bajarish mumkin. Kattaroq tajriba uchun vaqtinchalik GPU serveri kerak bo‘ladi; checkpointlarni tez-tez saqlang va GPU limiti tugashi mumkinligini hisobga oling.


## Promptli rasm/video generatorlari

Yangi tajriba skriptlari: `train_image_prompt.py`, `sample_image_prompt.py`, `train_video_prompt.py`, `sample_video_prompt.py`, hamda `media_server.py`. Bular noldan boshlangan, kichik prompt-conditioned diffusion tajribalari. Har bir media faylga mos caption kerak; natija sifati kichik arxitektura va sodda hash-tokenizator sabab past bo‘lishi mumkin. Ular professional text-to-image/text-to-video sifatini va’da qilmaydi.
