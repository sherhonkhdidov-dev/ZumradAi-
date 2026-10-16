# Zumrad AI — Code & Design training v10

## Nima o‘zgardi
- `data/focused_code_design_uz.jsonl` — Python, JavaScript, HTML/CSS, UI/UX, accessibility, API, SQL, xavfsizlik, debugging va deploy bo‘yicha qo‘shimcha o‘quv namunalar.
- `data/validation.jsonl` yangilandi: yangi savollar treningga aralashtirilmaydi.
- Mavjud `web/` interfeysi va `web/css/app.css` ataylab o‘zgartirilmadi.

## Trening
Python 3.10+ va `requirements.txt` talab qilinadi. Avval tekshiring:

```bash
python check_data.py
python train.py --steps 800 --batch-size 2 --gradient-accumulation 2 --block-size 128 --n-layer 2 --n-head 4 --n-embd 64 --vocab-size 512 --eval-every 100 --save-every 200 --out out_code_design
python evaluate.py --checkpoint out_code_design/best_model.pt --data data/validation.jsonl
```

Checkpoint nomi va `out_code_design/` alohida: avvalgi tajriba vaznlari ustiga yozilmaydi. Agar `best_model.pt` yaratilsa ham, javoblarni odam tekshirishi shart. Loss pasayishi professional darajani anglatmaydi.

## Halol cheklovlar
Bu dataset — o‘qitishni yaxshilash uchun kichik boshlang‘ich to‘plam, katta korpus emas. Tiny Transformer’dan Claude/Gemini darajasini kutib bo‘lmaydi. Katta va sifatli kod korpusi, testlar, ko‘proq parametrlar va GPU treningi talab qilinadi. Rasm/video generatorlari ushbu ishda o‘zgartirilmadi.
