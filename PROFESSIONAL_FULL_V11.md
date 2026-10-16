# Zumrad AI — Professional Full v11

This archive combines the complete v9 application (including the existing UI, own-model experiments, media-generator experiments, and C2PA tooling) with the v10 focused code/design training dataset and its experimental checkpoint.

## What is included
- Existing ZumradAI app and UI assets preserved from v9.
- Experimental own text/code model and training/evaluation scripts.
- Focused Uzbek code/design training examples and separate evaluation results.
- Experimental image/video model code (not yet capable of high-quality prompt-to-media generation).
- C2PA Content Credentials signing/verification helper (requires valid signing certificate and private key configuration).

## Important limitations
The included checkpoints are small experiments, not a professional coding assistant or a Gemini/Claude-level image/video generator. The checkpoint is evidence of a training run, not proof of strong capability. Review `experiments/own-model/runs/code_design_1250/TRAINING_REPORT.md` and `evaluation.json`. No third-party AI model API has been added as the primary model.

## Next steps
Read `experiments/own-model/README.md`, `CODE_DESIGN_TRAINING.md`, `TRAINING_PLAN.md`, and `CONTENT_CREDENTIALS_C2PA.md` before deploying. Keep secrets and signing keys out of the ZIP and configure them as server secrets.
