# Tajribalar (asosiy ilovaga kirmaydi)

- `own-model/` — avvalgi versiyadagi kichik, noldan o‘qitiladigan matn modeli (PyTorch). O‘quv maqsadida qoldirilgan; Zumrad AI hozir Cloudflare Workers AI dagi tayyor, kuchli modellardan foydalanadi.
- `supabase_schema.sql` — kelajakda suhbatlarni serverda saqlash (hisob tizimi bilan) uchun jadval namunasi. Hozir suhbatlar brauzerda saqlanadi.


## Own-model training lab (v7)
See `own-model/README.md` and `own-model/TRAINING_PLAN.md`. The project includes a small checked-in Uzbek/code seed dataset and a separate validation set, data-quality checks, and checkpoint evaluation. The starter networks are randomly initialized research baselines; no Gemini/Claude-level capability or trained weights are included.
