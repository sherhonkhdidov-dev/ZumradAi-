# Zumrad AI Professional Full v12 — Code & Design Studio

This release keeps the existing v11 application files and adds an optional, working local project-starter studio at `/studio.html`. The original chat UI files are preserved byte-for-byte.

## New working feature

- Open `web/studio.html` after deploying the Worker/static assets.
- Choose a portfolio, school dashboard, online shop, or SaaS dashboard.
- Customize project name, accent theme, and short description.
- View the result live; inspect HTML/CSS/JavaScript; download the project ZIP.
- Generated projects use local HTML/CSS/JS and require no external AI API.

This is a deterministic template-assisted project generator, not a claim that the small from-scratch neural checkpoint can independently produce professional code. It is intended as a real, demonstrable feature while the own model is trained and evaluated further.

## Existing AI/model files

The v11 application, own-model training code/checkpoints, experimental image/video modules, and C2PA tools are retained. The current small text checkpoint is still experimental; image/video checkpoints are not trained production generators. No third-party AI inference model was added.

## Test

From `ZumradAI/`: `npm test`. For a static UI smoke test, run `node scripts/ui-smoke.mjs` if its local dependencies are available. The new Studio page can be opened directly in a browser; for the ZIP download, keep `/vendor/jszip.min.js` accessible at the existing static path.


## v12 code/design learning corpus

A new original JSONL corpus and separate benchmark are included: `experiments/own-model/data/professional_code_design_v12.jsonl` and `experiments/own-model/benchmarks/code_design_benchmark_v12.jsonl`. The benchmark is deliberately outside `data/` to prevent accidental training leakage. To train with this dataset, run `check_data.py` and then `train.py` with a new output directory; do not overwrite existing checkpoints before backing them up.
