# Deploy: GitHub → Cloudflare (qadamma-qadam)

Taxminan 10 daqiqa. Pullik reja shart emas.

## 1. GitHub’ga yuklash

Papka tuzilmasi saqlanishi muhim: `wrangler.toml`, `worker/`, `web/` repozitoriyning **eng yuqori darajasida** turishi kerak.

**Kompyuterda (eng oson):**
1. github.com → **New repository** → nom: `zumrad-ai` → Create.
2. ZIPni oching → ichidagi **barcha fayl va papkalarni** (papkaning o‘zini emas) repozitoriy sahifasiga sudrab tashlang (**uploading an existing file**) → Commit.

**Yoki terminalda:**
```bash
unzip ZumradAI_Pro_v4.zip && cd ZumradAI
git init && git add . && git commit -m "Zumrad AI"
git branch -M main
git remote add origin https://github.com/SIZNING-NOM/zumrad-ai.git
git push -u origin main
```

**Android telefonda:** brauzer papka yuklay olmaydi, shuning uchun Termux’dan foydalaning: `pkg install git unzip`, keyin yuqoridagi buyruqlar (GitHub parol o‘rniga *Personal Access Token* so‘raydi: Settings → Developer settings → Tokens, “repo” huquqi bilan).

## 2. Cloudflare’da ulash

1. dash.cloudflare.com → **Workers & Pages** → **Create** → **Import a repository** (yoki *Connect to Git*).
2. GitHub’ni ulang, `zumrad-ai` repozitoriyasini tanlang.
3. Sozlamalar:
   - **Build command**: bo‘sh qoldiring
   - **Deploy command**: `npx wrangler deploy` (odatiy)
   - **Root directory**: `/`
4. **Save and Deploy** bosing. Birinchi deploy 1–2 daqiqa oladi.

`wrangler.toml` ichidagi `[ai]` bo‘limi **Workers AI**’ni avtomatik ulaydi. Tekshirish: Worker → **Settings → Bindings** → `AI` ko‘rinishi kerak. Ko‘rinmasa: *Add → Workers AI* → nomi aynan `AI`.

## 3. Tekshirish

1. `https://zumrad-ai.SIZNING-NOM.workers.dev/api/health` ni oching → `"ai": true` bo‘lishi kerak.
2. Saytni oching va ketma-ket sinang:
   - `Salom, o‘zingni tanishtir` → javob harf-harf chiqadi
   - `Hisoblagich (kalkulyator) sayti yoz` → kod bloklari + **Jonli ko‘rinish** tugmasi
   - `Samarqand Registonining tongdagi rasmini chiz` → rasm
   - **Video** rejimi → `10 s` → `Samarqand tongi haqida video` → ~1–2 daqiqada MP4

## 4. Saytni himoyalash (tavsiya etiladi)

Sayt ochiq bo‘lsa, har kim sizning bepul kvotangizni ishlatishi mumkin.

Worker → **Settings → Variables and Secrets → Add** → turi **Secret**:
- `ACCESS_CODE` = o‘zingiz o‘ylab topgan kod

Endi sayt birinchi ochilganda kodni so‘raydi (Sozlamalar → Kirish kodi).

## 5. Ixtiyoriy yaxshilashlar

| Nima | Qanday |
|---|---|
| Yaxshiroq internet qidiruvi | tavily.com da bepul kalit oling → Secret: `TAVILY_API_KEY` |
| Boshqa model | Variable: `MODEL_FAST`, `MODEL_SMART`, `MODEL_CODE` (Workers AI model ID, masalan `@cf/openai/gpt-oss-120b`). Ro‘yxat: developers.cloudflare.com/workers-ai/models |
| Generativ video | Secret: `REPLICATE_API_TOKEN`; Variable: `REPLICATE_VIDEO_MODEL` (`egasi/model-nomi`); kerak bo‘lsa `REPLICATE_VIDEO_INPUT` (JSON). Video rejimida “Usul → Generativ” paydo bo‘ladi. Pullik. |
| O‘z domeningiz | Worker → Settings → Domains & Routes → Add custom domain |
| So‘rovlarni cheklash | Cloudflare → Security → WAF → Rate limiting rules (`/api/*`) |

## Muammolar

| Belgi | Sabab va yechim |
|---|---|
| “AI ulanmagan…” (503) | `AI` binding yo‘q. 2-qadamdagi tekshiruvni bajaring, keyin **Deploy** ni qayta bosing. |
| “…bepul AI limiti tugadi” | Kuniga 10 000 neyron. Ertasi kuni 05:00 (Toshkent) da yangilanadi, yoki Workers Paid yoqing. |
| “Model … topilmadi” | Hisobingizda model yo‘q. `MODEL_FAST` / `MODEL_SMART` / `MODEL_CODE` ni mavjud modelga almashtiring. |
| “Kirish kodi noto‘g‘ri” | Sozlamalar → Kirish kodi maydoniga `ACCESS_CODE` ni kiriting. |
| Rasm “xavfsizlik filtri” | Tavsifni boshqacha yozing. |
| Video yig‘ilmayapti | Chrome/Safari’ning yangi versiyasidan foydalaning, montaj paytida sahifa ochiq va ekran yoniq tursin. |
| Shriftlar boshqacha ko‘rinadi | Shriftlar Google Fonts’dan yuklanadi; internet cheklangan bo‘lsa, tizim shrifti ishlatiladi (ilova baribir ishlaydi). |

Kodni yangilasangiz (`git push`), Cloudflare o‘zi qayta deploy qiladi.
