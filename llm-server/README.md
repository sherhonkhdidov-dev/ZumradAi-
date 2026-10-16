---
title: Zumrad Brain
emoji: 💎
colorFrom: green
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Zumrad miya serveri

Bu papka Zumrad AI uchun o'zingiz joylagan model serveri (llama.cpp + ochiq GGUF model).
Tashqi AI xizmatiga so'rov ketmaydi, kunlik limit yo'q.

## Hugging Face'da ishga tushirish (bepul, telefondan ham bo'ladi)

1. huggingface.co → **New Space** → SDK: **Docker** → *Blank* → CPU basic (bepul).
2. Space'ga shu papkadagi ikki faylni yuklang: `Dockerfile` va `README.md`.
3. Space → **Settings → Variables and secrets → New secret**: `LLAMA_API_KEY` = o'zingiz o'ylab topgan uzun parol.
4. Build tugagach Space manzili chiqadi: `https://<ism>-<space>.hf.space`.
5. Cloudflare → Workers → zumradai → Settings → Variables and Secrets:
   - `OWN_MODEL_URL` = Space manzili
   - `OWN_MODEL_API` = `openai`
   - `OWN_MODEL_TOKEN` = 3-qadamdagi parol (Secret)

Modelni almashtirish: `Dockerfile` oxiridagi `Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M` ni boshqa GGUF repo bilan almashtiring.
