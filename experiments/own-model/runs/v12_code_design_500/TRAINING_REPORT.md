# Zumrad AI v12 — trening hisoboti

- Arxitektura: noldan boshlangan kichik decoder Transformer
- Parametrlar: 173,824
- Trening qurilmasi: CPU
- Trening qadamlar: 500
- Trening korpusi: 75,506 belgi / 34,303 tokenizer birligi
- Validation: 12 ajratilgan misol, 1,477 token
- Birinchi o‘lchangan validation loss: 6.2366
- Oxirgi o‘lchangan validation loss: 5.4006
- Eng yaxshi checkpoint: `best_model.pt`

## Talqin

Loss kamaygani model o‘quv matnini yaxshiroq bashorat qilishni o‘rganganini bildiradi. Bu professional kod yozish yoki dizayn qobiliyatini isbotlamaydi. Tekshiruv paytida modelning ayrim javoblari bo‘sh yoki ma’nosiz bo‘ldi. Shuning uchun checkpointni hozircha ishlab chiqarish uchun tayyor AI deb hisoblamang.

## Namoyish uchun tavsiya

Ishlaydigan kod/dizayn namoyishi sifatida asosiy ilovaga qo‘shilgan `/studio.html` sahifasidan foydalaning: u to‘rtta starter loyihani yaratadi, jonli ko‘rsatadi va HTML/CSS/JS fayllarini ZIP qilib beradi. Neural model esa alohida, davom ettirilishi kerak bo‘lgan tadqiqot/trening qismidir.
