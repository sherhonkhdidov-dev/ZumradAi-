"""Zumrad AI's own from-scratch text model API. No external model/API fallback."""
import json, os, torch
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field
from model import TinyZumradLM
from tokenizer import ZumradBPETokenizer

app = FastAPI(title="Zumrad AI Own Brain", version="0.2.0")
API_TOKEN = os.getenv("OWN_MODEL_TOKEN", "")

class ChatRequest(BaseModel):
    message: str = ""
    messages: list[dict] = Field(default_factory=list)
    max_new_tokens: int = 200
    temperature: float = 0.8

_model = None
_vocab = None
_rev = None
_cfg = None
_tokenizer = None

@app.on_event("startup")
def load():
    global _model, _vocab, _rev, _cfg, _tokenizer
    if not os.path.exists("out/model.pt") or not os.path.exists("out/vocab.json"):
        return
    if os.path.exists("out/tokenizer.json"):
        _tokenizer = ZumradBPETokenizer.load("out/tokenizer.json")
    with open("out/vocab.json", encoding="utf-8") as f:
        _vocab = json.load(f)
    _rev = {int(v): k for k, v in _vocab.items()}
    ck = torch.load("out/model.pt", map_location="cpu", weights_only=False)
    _cfg = ck["config"]
    _model = TinyZumradLM(**_cfg)
    _model.load_state_dict(ck["state_dict"])
    _model.eval()

@app.get("/health")
def health():
    return {"status": "ok", "mode": "own-model-only", "trained_model_loaded": _model is not None}

@app.post("/api/chat")
def chat(req: ChatRequest, authorization: str | None = Header(default=None)):
    if API_TOKEN and authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(401, "Unauthorized")
    if _model is None:
        raise HTTPException(503, "O‘z model hali o‘qitilmagan. experiments/own-model/README.md ni bajaring.")
    # Keep a compact conversation transcript. This model is character-level and does not
    # understand roles semantically unless such examples are represented in its training text.
    if req.messages:
        parts = []
        for m in req.messages[-12:]:
            role = str(m.get("role", "user")).upper()
            content = str(m.get("content", ""))
            if isinstance(m.get("content"), list):
                content = " ".join(str(x.get("text", "")) for x in m["content"] if isinstance(x, dict))
            parts.append(f"\n{role}: {content}")
        prompt = "".join(parts) + "\nASSISTANT:"
    else:
        prompt = req.message
    ids = _tokenizer.encode(prompt) if _tokenizer else [_vocab.get(c, 0) for c in prompt]
    if not ids:
        ids = [0]
    idx = torch.tensor([ids], dtype=torch.long)
    temperature = max(0.15, min(float(req.temperature), 1.4))
    with torch.no_grad():
        for _ in range(min(max(int(req.max_new_tokens), 1), 500)):
            logits, _ = _model(idx[:, -_cfg["block_size"]:])
            probs = torch.softmax(logits[0, -1] / temperature, dim=-1)
            nxt = torch.multinomial(probs, 1).item()
            idx = torch.cat([idx, torch.tensor([[nxt]])], dim=1)
    full = _tokenizer.decode(idx[0].tolist()) if _tokenizer else "".join(_rev.get(int(i), "") for i in idx[0].tolist())
    return {"reply": full[len(prompt):], "model": "Zumrad TinyLM (from-scratch, BPE tokenizer when available)", "warning": "Tajriba modeli; sifati o‘qitish ma’lumotlari va quvvatiga bog‘liq."}
