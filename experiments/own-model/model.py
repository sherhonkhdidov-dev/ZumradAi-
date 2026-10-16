"""Tiny decoder-only Transformer language model; random initialization only."""
import torch
from torch import nn
from torch.nn import functional as F

class CausalSelfAttention(nn.Module):
    def __init__(self, n_embd, n_head, block_size, dropout=0.1):
        super().__init__()
        assert n_embd % n_head == 0
        self.n_head, self.head_dim = n_head, n_embd // n_head
        self.qkv = nn.Linear(n_embd, 3*n_embd)
        self.proj = nn.Linear(n_embd, n_embd)
        self.attn_drop = nn.Dropout(dropout)
        self.resid_drop = nn.Dropout(dropout)
        self.register_buffer("mask", torch.tril(torch.ones(block_size, block_size)).view(1,1,block_size,block_size))
    def forward(self, x):
        B,T,C=x.shape
        q,k,v=self.qkv(x).split(C, dim=2)
        q=q.view(B,T,self.n_head,self.head_dim).transpose(1,2)
        k=k.view(B,T,self.n_head,self.head_dim).transpose(1,2)
        v=v.view(B,T,self.n_head,self.head_dim).transpose(1,2)
        scores=(q @ k.transpose(-2,-1)) * (self.head_dim ** -0.5)
        scores=scores.masked_fill(self.mask[:,:,:T,:T] == 0, float("-inf"))
        att=F.softmax(scores,dim=-1)
        att=self.attn_drop(att)
        y=(att @ v).transpose(1,2).contiguous().view(B,T,C)
        return self.resid_drop(self.proj(y))

class Block(nn.Module):
    def __init__(self, n_embd, n_head, block_size, dropout):
        super().__init__()
        self.ln1=nn.LayerNorm(n_embd)
        self.attn=CausalSelfAttention(n_embd,n_head,block_size,dropout)
        self.ln2=nn.LayerNorm(n_embd)
        self.mlp=nn.Sequential(nn.Linear(n_embd,4*n_embd),nn.GELU(),nn.Linear(4*n_embd,n_embd),nn.Dropout(dropout))
    def forward(self,x):
        x=x+self.attn(self.ln1(x))
        x=x+self.mlp(self.ln2(x))
        return x

class TinyZumradLM(nn.Module):
    def __init__(self, vocab_size, block_size=128, n_layer=4, n_head=4, n_embd=128, dropout=0.1):
        super().__init__()
        self.block_size=block_size
        self.token_emb=nn.Embedding(vocab_size,n_embd)
        self.pos_emb=nn.Embedding(block_size,n_embd)
        self.drop=nn.Dropout(dropout)
        self.blocks=nn.Sequential(*[Block(n_embd,n_head,block_size,dropout) for _ in range(n_layer)])
        self.ln_f=nn.LayerNorm(n_embd)
        self.head=nn.Linear(n_embd,vocab_size,bias=False)
        self.apply(self._init_weights)
    def _init_weights(self,m):
        if isinstance(m,nn.Linear):
            nn.init.normal_(m.weight,mean=0.0,std=0.02)
            if m.bias is not None: nn.init.zeros_(m.bias)
        elif isinstance(m,nn.Embedding):
            nn.init.normal_(m.weight,mean=0.0,std=0.02)
    def forward(self, idx, targets=None):
        B,T=idx.shape
        if T>self.block_size: idx=idx[:,-self.block_size:]; T=idx.shape[1]
        pos=torch.arange(T,device=idx.device)
        x=self.drop(self.token_emb(idx)+self.pos_emb(pos)[None,:,:])
        x=self.ln_f(self.blocks(x))
        logits=self.head(x)
        loss=None
        if targets is not None:
            if targets.size(1)>self.block_size: targets=targets[:,-self.block_size:]
            loss=F.cross_entropy(logits.reshape(-1,logits.size(-1)),targets.reshape(-1))
        return logits,loss
