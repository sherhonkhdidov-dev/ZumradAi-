# Experimental checkpoint — not production-ready

This checkpoint was trained from random initialization for about 1,200 optimization steps on the included 68-record seed dataset. It is kept for reproducibility only; it is not loaded by the app automatically. The evaluation report shows that generated responses are still poor/repetitive, so do not deploy it as a useful chat model. This is an honest baseline demonstrating that the pipeline runs, not a successful final training result.

To train a fresh model after improving the dataset, use the instructions in `../../README.md` and save to the normal `out/` folder only when you want to test it with `server.py`.
