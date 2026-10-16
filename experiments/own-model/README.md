# Zumrad AI — Own Model Training Lab

**Only the project's own from-scratch networks are used here.** No pretrained model weights are downloaded and no third-party AI inference API is called by these training scripts.

## What is actually included

- `model.py` / `train.py`: a small decoder Transformer, initialized randomly, using a simple Unicode character-pair BPE tokenizer learned from the training corpus.
- `data/seed_uzbek_code.jsonl`: 68 initial Uzbek instruction/answer examples across programming, web development, UI/UX, security, and model-training concepts.
- `data/validation.jsonl`: 12 held-out examples excluded from training.
- `check_data.py`: checks JSONL structure, empty answers, and duplicate prompts.
- `evaluate.py`: evaluates a checkpoint and saves generated answers to `out/evaluation.json` for human review.
- `image_model.py` / `train_image.py`: a small unconditional diffusion experiment. It does not understand text prompts.
- `video_model.py` / `train_video.py`: a small 3D video-noise prediction experiment, not a finished text-to-video generator.
- `server.py`: API for the trained text checkpoint only.

## Important reality check

No model weights are pretrained in this ZIP. Training has to be run to create `out/model.pt`. The starter text model and tokenizer are small research components; the seed dataset is only a beginning and cannot make it as capable as Gemini or Claude by itself. The image and video experiments are also not prompt-conditioned products. The project deliberately does not use other AI models as a shortcut.

## Train the text/code model

Run commands from this directory. Python 3.10+ and dependencies in `requirements.txt` are needed.

```bash
python -m pip install -r requirements.txt
python check_data.py
python train.py --steps 20 --batch-size 2 --block-size 128 --eval-every 10 --save-every 10
```

The short run above checks that the pipeline works. For a longer run, try:

```bash
python train.py --steps 5000 --batch-size 4 --gradient-accumulation 4 --block-size 256 --eval-every 100 --save-every 500
```

Continue a compatible checkpoint with `--resume`. If RAM is low, lower `--batch-size` to 1 or 2 and `--block-size` to 128. CUDA GPU users may add `--amp`.

Add your own legally usable, high-quality `.txt` or `.jsonl` files under `data/`. JSONL instruction records can look like:

```json
{"prompt":"Python’da ro‘yxatni saralashni ko‘rsat.","response":"sonlar = [3, 1, 2]\nprint(sorted(sonlar))"}
```

Then check and evaluate:

```bash
python check_data.py
python evaluate.py --checkpoint out/best_model.pt --data data/validation.jsonl
```

Review `out/evaluation.json` manually. Lower validation loss is useful diagnostic information but does not prove the generated answer is correct. Keep the validation set separate from training data.

## Images and video

For image training, place licensed images under `data/images/`, then use a GPU-capable machine:

```bash
python train_image.py --data data/images --steps 10000 --size 64 --batch-size 4
python sample_image.py --checkpoint out/image_model.pt --out out/sample.png
```

This model is unconditional and will not follow a text prompt. For the video experiment, add licensed clips under `data/videos/`:

```bash
python train_video.py --data data/videos --steps 5000 --frames 8 --size 32 --batch-size 1
python sample_video.py --checkpoint out/video_model.pt --out out/sample.gif
```

This is a research noise predictor, not a complete text-to-video generator. Prompt conditioning, a suitable text encoder, sampling/evaluation, more data, and substantial compute are still needed.

## Deploy the own text model API

After training, run `uvicorn server:app --host 0.0.0.0 --port 8000` from this directory. Set `OWN_MODEL_TOKEN` before exposing the API publicly. The current API only serves the text model. Do not expose an unauthenticated training endpoint or commit secrets.

For a step-by-step roadmap, see `TRAINING_PLAN.md`. An experimental short-run checkpoint may be included under `runs/`; it is not production-ready and is not automatically loaded by the app.


## Promptli o‘z rasm/video generatorlari (yangi eksperimental yo‘l)

`train_image_prompt.py` va `train_video_prompt.py` matnli tavsifni shart sifatida qabul qiladigan, noldan boshlanadigan kichik tajriba modellaridir. Ular tayyor vaznlarni yuklamaydi va tashqi AI API chaqirmaydi. **Bu hali professional sifatdagi generator emas**: tokenizator juda sodda, rasm o‘lchamlari kichik, model va ma’lumotlar hajmi cheklangan.

### Rasm modeli
1. `data/images/` ichiga o‘zingizga tegishli yoki qayta ishlatishga litsenziyasi bor rasmlarni joylang.
2. Shu papkada `captions.jsonl` fayl yarating. Har bir rasm uchun bir qatordan yozing:
   ```json
   {"file":"cat.jpg","caption":"oq mushuk yashil o'tloqda, yumshoq quyosh nuri"}
   {"file":"mountain.png","caption":"qorli tog'lar va ko'k ko'l, keng kadr"}
   ```
3. Kamida 20 juftlik bilan sinov boshlang; foydali natija uchun minglab yoki undan ko‘p xilma-xil, sifatli juftliklar kerak:
   ```bash
   python train_image_prompt.py --steps 10000 --size 64 --batch-size 4
   python sample_image_prompt.py --checkpoint out/prompt_image_model.pt --prompt "qadimiy Samarqand, quyosh botishi" --out out/samarqand.png
   ```

### Video modeli
`data/videos/` ichiga litsenziyali video kliplar qo‘ying va `captions.jsonl` faylida har bir klipni tavsiflang:
```json
{"file":"horse.mp4","caption":"ot yashil dalada chopmoqda"}
```
So‘ng:
```bash
python train_video_prompt.py --steps 5000 --frames 8 --size 32 --batch-size 1
python sample_video_prompt.py --checkpoint out/prompt_video_model.pt --prompt "ot yashil dalada chopmoqda" --out out/horse.gif
```
Bu kichik tajriba modelidan olingan GIF bo‘ladi; hozircha u tabiiy, yuqori sifatli matndan-video generatori emas.

### O‘z media API serveri
Rasm/video checkpointlarini o‘qitganingizdan so‘ng, shu papkada:
```bash
export OWN_MEDIA_TOKEN='uzun-tasodifiy-maxfiy-token'
uvicorn media_server:app --host 0.0.0.0 --port 8001
```
Cloudflare Worker sozlamalarida `OWN_IMAGE_URL` ni media serverning `/api` yo‘li emas, serverning asosiy manziliga qo‘ying (server endpointni `/api/image` sifatida o‘zi qo‘shadi), va `OWN_IMAGE_TOKEN` ni `OWN_MEDIA_TOKEN` bilan bir xil qiling. Video endpoint: `POST /api/video`. Hozirgi veb ilovadagi video ssenariysi/animatsiya oqimi bilan ushbu generativ video endpointni birlashtirish uchun alohida frontend ulanishi kerak.

**Eslatma:** `media_server.py` checkpoint mavjud bo‘lmasa modelni yuklamaydi; endpoint 503 qaytaradi. Generator kodining mavjudligi tayyor o‘qitilgan model mavjudligini anglatmaydi. Trening uchun odatda GPUli kompyuter yoki bulut kerak.
