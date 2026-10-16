"""Zumrad 1.0 — suhbat modelini o'zbekcha ma'lumot bilan LoRA fine-tune qilish.

Colab (T4/L4) yoki Kaggle GPU da ishlaydi:
    pip install -r requirements.txt
    python train_lora.py --data data.jsonl --out zumrad-1.0-lora

data.jsonl: har qatorda {"messages":[{"role":"user"|"assistant"|"system","content":"..."}]}
(data_example.jsonl ga qarang). Yaxshi natija uchun kamida 3-10 ming sifatli suhbat kerak.
"""
import argparse

import torch
from datasets import load_dataset
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer

p = argparse.ArgumentParser()
p.add_argument("--base", default="Qwen/Qwen2.5-1.5B-Instruct", help="asos model (Apache-2.0). Kuchliroq GPU bo'lsa: Qwen/Qwen2.5-7B-Instruct")
p.add_argument("--data", required=True)
p.add_argument("--out", default="zumrad-1.0-lora")
p.add_argument("--epochs", type=float, default=3)
p.add_argument("--max_len", type=int, default=2048)
a = p.parse_args()

ds = load_dataset("json", data_files=a.data, split="train")

cfg = SFTConfig(
    output_dir=a.out,
    num_train_epochs=a.epochs,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.03,
    logging_steps=10,
    save_strategy="epoch",
    bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
    fp16=torch.cuda.is_available() and not torch.cuda.is_bf16_supported(),
    max_length=a.max_len,
    gradient_checkpointing=True,
    report_to="none",
)
lora = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, target_modules="all-linear", task_type="CAUSAL_LM")

trainer = SFTTrainer(model=a.base, args=cfg, train_dataset=ds, peft_config=lora)
trainer.train()
trainer.save_model(a.out)
print("Tayyor:", a.out)
