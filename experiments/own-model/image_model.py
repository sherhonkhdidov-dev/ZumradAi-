"""Small unconditional pixel-space DDPM U-Net for research from-scratch image training."""
import math, torch
from torch import nn

class SinusoidalTime(nn.Module):
    def __init__(self, dim): super().__init__(); self.dim=dim
    def forward(self,t):
        half=self.dim//2
        freq=torch.exp(-math.log(10000)*torch.arange(half,device=t.device,dtype=torch.float32)/max(half-1,1))
        x=t.float()[:,None]*freq[None,:]
        return torch.cat([x.sin(),x.cos()],dim=-1)

class ResBlock(nn.Module):
    def __init__(self,cin,cout,tdim):
        super().__init__(); self.n1=nn.GroupNorm(8,cin); self.c1=nn.Conv2d(cin,cout,3,padding=1)
        self.n2=nn.GroupNorm(8,cout); self.c2=nn.Conv2d(cout,cout,3,padding=1)
        self.temb=nn.Linear(tdim,cout); self.skip=nn.Conv2d(cin,cout,1) if cin!=cout else nn.Identity()
    def forward(self,x,t):
        h=self.c1(torch.nn.functional.silu(self.n1(x)))+self.temb(t)[:,:,None,None]
        h=self.c2(torch.nn.functional.silu(self.n2(h)))
        return (h+self.skip(x))/math.sqrt(2)

class TinyImageDenoiser(nn.Module):
    def __init__(self,channels=3,base=64,time_dim=128):
        super().__init__(); self.time=nn.Sequential(SinusoidalTime(time_dim),nn.Linear(time_dim,time_dim*4),nn.SiLU(),nn.Linear(time_dim*4,time_dim))
        self.inp=nn.Conv2d(channels,base,3,padding=1)
        self.d1=ResBlock(base,base,time_dim); self.down1=nn.Conv2d(base,base*2,4,2,1)
        self.d2=ResBlock(base*2,base*2,time_dim); self.down2=nn.Conv2d(base*2,base*4,4,2,1)
        self.mid=ResBlock(base*4,base*4,time_dim); self.up2=nn.ConvTranspose2d(base*4,base*2,4,2,1)
        self.u2=ResBlock(base*4,base*2,time_dim); self.up1=nn.ConvTranspose2d(base*2,base,4,2,1)
        self.u1=ResBlock(base*2,base,time_dim); self.out=nn.Sequential(nn.GroupNorm(8,base),nn.SiLU(),nn.Conv2d(base,channels,3,padding=1))
    def forward(self,x,t):
        te=self.time(t); a=self.d1(self.inp(x),te); b=self.d2(self.down1(a),te); m=self.mid(self.down2(b),te)
        z=self.u2(torch.cat([self.up2(m),b],1),te); z=self.u1(torch.cat([self.up1(z),a],1),te)
        return self.out(z)
