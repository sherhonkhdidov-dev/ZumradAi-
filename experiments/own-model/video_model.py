"""Compact 3D convolutional video-noise predictor; input shape [B,C,T,H,W]."""
import torch
from torch import nn
class VideoDenoiser3D(nn.Module):
 def __init__(self,channels=3,base=32):
  super().__init__(); self.t=nn.Sequential(nn.Embedding(1000,base*2),nn.SiLU(),nn.Linear(base*2,base*2))
  self.c1=nn.Conv3d(channels,base,3,padding=1); self.n1=nn.GroupNorm(8,base)
  self.d=nn.Conv3d(base,base*2,4,stride=2,padding=1); self.n2=nn.GroupNorm(8,base*2)
  self.mid=nn.Sequential(nn.Conv3d(base*2,base*2,3,padding=1),nn.SiLU(),nn.Conv3d(base*2,base*2,3,padding=1))
  self.u=nn.ConvTranspose3d(base*2,base,4,stride=2,padding=1); self.n3=nn.GroupNorm(8,base)
  self.out=nn.Conv3d(base*2,channels,3,padding=1)
 def forward(self,x,t):
  e=self.t(t)[:,:,None,None,None]
  a=torch.nn.functional.silu(self.n1(self.c1(x))); b=torch.nn.functional.silu(self.n2(self.d(a))+e)
  m=self.mid(b)+b; u=torch.nn.functional.silu(self.n3(self.u(m)))
  if u.shape[2:]!=a.shape[2:]: u=torch.nn.functional.interpolate(u,size=a.shape[2:],mode='trilinear',align_corners=False)
  return self.out(torch.cat([u,a],dim=1))
