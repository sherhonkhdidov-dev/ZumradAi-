# Zumrad AI — o‘z modelini o‘qitish holati

## Ushbu versiyada mavjud

- [x] Chat/kod so‘rovlari faqat `OWN_MODEL_URL` orqali yuboriladi; tayyor tashqi chat modeli fallback’i yo‘q.
- [x] Tashqi AI rasm/video provayderlari chaqirilmaydi.
- [x] Matn/kod uchun noldan o‘qitiladigan kichik Transformer va `train.py`.
- [x] 68 ta o‘zbekcha/kod instruction misoli va alohida 12 ta validation misoli.
- [x] O‘zimiz yozgan sodda Unicode pair-merge BPE tokenizer, dataset tekshiruvchisi va checkpoint baholash skripti.
- [x] Qisqa trening real ishga tushirildi; eksperimental checkpoint `runs/experimental_bpe_1200/` ichida saqlangan.
- [x] Alohida noldan o‘qitiladigan kichik image diffusion denoiser va sample skripti.
- [x] Alohida noldan o‘qitiladigan kichik 3D video noise-prediction tarmog‘i va GIF sample skripti.
- [x] Python sintaksisi, image/video model forward-shape va 2-step matn trening smoke testlari bajarildi.

## Hali bajarilmaganlar

- [ ] Katta, sifatli va litsenziyasi tekshirilgan o‘zbekcha/multilingual hamda kod korpusi.
- [ ] Kuchli tokenizator va katta til modeli arxitekturasi, distributed GPU training, instruction tuning va benchmarklar.
- [ ] Prompt-conditioned text-to-image (matnni rasmga aylantirish), rasm tahriri va rasmni tushunish.
- [ ] To‘liq, prompt-conditioned text-to-video pipeline, temporal sifat baholash va amaliy inference API.
- [ ] O‘qitilgan vaznlarni serverga joylash va ilovaga rasm/video API sifatida ulash.

## Haqiqatni aniq ajratish

`TinyZumradLM` — random vaznlardan boshlanadigan kichik Transformer; tokenizeri sodda, o‘zimiz yozgan BPE tajribasi. Image va video tarmoqlari ham random vaznlardan boshlanadi. Ushbu ZIP trening kodini va sifat jihatidan hali yaroqsiz bo‘lgan bir qisqa eksperimental matn checkpointini beradi; ichida tayyor kuchli model yoki sifatli rasm/video vaznlari yo‘q. Eksperimental checkpoint ilova tomonidan avtomatik yuklanmaydi. Image model hozircha promptni tushunmaydi, video modeli esa tadqiqot prototipi. Katta multimodal model uchun katta qonuniy dataset, GPU hisoblash quvvati va ko‘p iteratsiya kerak.
