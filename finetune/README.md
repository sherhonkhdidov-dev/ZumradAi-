# Zumrad 1.0 — o'z modelingizni o'qitish (fine-tune)

Bu **noldan** o'qitish emas: tayyor ochiq model (Qwen2.5, Apache-2.0) ustiga **o'zingizning o'zbekcha ma'lumotingiz** bilan LoRA qatlami o'qitiladi. Natija — sizga tegishli og'irliklar (`zumrad-1.0-lora`).

1. `data.jsonl` tayyorlang (`data_example.jsonl` formatida): o'zbekcha suhbat, kod, savol-javob. Kamida 3 000–10 000 sifatli misol.
2. Colab/Kaggle'da GPU yoqing, `pip install -r requirements.txt`, so'ng `python train_lora.py --data data.jsonl`.
3. Natijani Hugging Face'ga yuklang, keyin o'z serveringizda (Cloudflare Workers AI "LoRA", yoki vLLM/Ollama bilan GPU serverda) ishga tushiring va `MODEL_FAST` ni almashtiring.

Rasm (1.3) va video (1.5) modellarini o'qitish ancha katta GPU va ma'lumot talab qiladi; hozir ular tayyor motorda ishlaydi.
