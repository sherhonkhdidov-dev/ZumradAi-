"""From-scratch prompt-conditioned research models. No pretrained weights."""
import math, re, torch
from torch import nn
from image_model import SinusoidalTime, ResBlock

def tokenize_prompt(text, max_len=48):
    words = re.findall(r"[a-zA-Z0-9_]+|[^\w\s]", str(text).lower(), flags=re.UNICODE)[:max_len]
    # Stable hashed vocabulary; intentionally simple starter tokenizer, not a semantic pretrained encoder.
    ids = [1 + (sum((i+1)*ord(c) for i,c in enumerate(w)) % 8190) for w in words]
    return ids or [0]

class PromptEncoder(nn.Module):
    def __init__(self, vocab=8192, dim=128):
        super().__init__()
        self.emb = nn.Embedding(vocab, dim, padding_idx=0)
        self.proj = nn.Sequential(nn.Linear(dim, dim), nn.SiLU(), nn.Linear(dim, dim))
    def forward(self, ids):
        mask = (ids != 0).float().unsqueeze(-1)
        pooled = (self.emb(ids) * mask).sum(1) / mask.sum(1).clamp_min(1)
        return self.proj(pooled)

class PromptImageDenoiser(nn.Module):
    def __init__(self, channels=3, base=32, time_dim=128):
        super().__init__()
        self.text = PromptEncoder(dim=time_dim)
        self.time = nn.Sequential(SinusoidalTime(time_dim), nn.Linear(time_dim,time_dim*2), nn.SiLU(), nn.Linear(time_dim*2,time_dim))
        self.inp=nn.Conv2d(channels,base,3,padding=1)
        self.d1=ResBlock(base,base,time_dim); self.down1=nn.Conv2d(base,base*2,4,2,1)
        self.d2=ResBlock(base*2,base*2,time_dim); self.down2=nn.Conv2d(base*2,base*4,4,2,1)
        self.mid=ResBlock(base*4,base*4,time_dim); self.up2=nn.ConvTranspose2d(base*4,base*2,4,2,1)
        self.u2=ResBlock(base*4,base*2,time_dim); self.up1=nn.ConvTranspose2d(base*2,base,4,2,1)
        self.u1=ResBlock(base*2,base,time_dim); self.out=nn.Sequential(nn.GroupNorm(8,base),nn.SiLU(),nn.Conv2d(base,channels,3,padding=1))
    def forward(self,x,t,caption_ids):
        te=self.time(t)+self.text(caption_ids)
        a=self.d1(self.inp(x),te); b=self.d2(self.down1(a),te); m=self.mid(self.down2(b),te)
        z=self.u2(torch.cat([self.up2(m),b],1),te); z=self.u1(torch.cat([self.up1(z),a],1),te)
        return self.out(z)

class PromptVideoDenoiser(nn.Module):
    def __init__(self, channels=3, base=16, dim=64):
        super().__init__()
        self.text=PromptEncoder(dim=dim)
        self.t=nn.Sequential(nn.Embedding(1000,dim),nn.SiLU(),nn.Linear(dim,dim))
        self.c1=nn.Conv3d(channels,base,3,padding=1); self.n1=nn.GroupNorm(8,base)
        self.d=nn.Conv3d(base,base*2,4,stride=2,padding=1); self.n2=nn.GroupNorm(8,base*2)
        self.mid=nn.Sequential(nn.Conv3d(base*2,base*2,3,padding=1),nn.SiLU(),nn.Conv3d(base*2,base*2,3,padding=1))
        self.u=nn.ConvTranspose3d(base*2,base,4,stride=2,padding=1); self.n3=nn.GroupNorm(8,base)
        self.out=nn.Conv3d(base*2,channels,3,padding=1)
        self.cond=nn.Linear(dim,base*2)
    def forward(self,x,t,caption_ids):
        e=self.t(t)+self.text(caption_ids)
        a=torch.nn.functional.silu(self.n1(self.c1(x)))
        b=torch.nn.functional.silu(self.n2(self.d(a))+self.cond(e)[:,:,None,None,None])
        m=self.mid(b)+b; u=torch.nn.functional.silu(self.n3(self.u(m)))
        if u.shape[2:]!=a.shape[2:]: u=torch.nn.functional.interpolate(u,size=a.shape[2:],mode='trilinear',align_corners=False)
        return self.out(torch.cat([u,a],dim=1))
