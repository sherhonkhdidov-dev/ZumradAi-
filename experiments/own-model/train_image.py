"""Train a tiny diffusion image model from random initialization on local image files."""
import argparse, os, glob, random
import torch
from torch.nn import functional as F
from torch.utils.data import Dataset,DataLoader
from PIL import Image
import numpy as np
from image_model import TinyImageDenoiser

class Images(Dataset):
 def __init__(self,root,size):
  self.paths=[]
  for ext in ('*.png','*.jpg','*.jpeg','*.webp','*.bmp'): self.paths += glob.glob(os.path.join(root,'**',ext),recursive=True)
  self.size=size
 def __len__(self): return len(self.paths)
 def __getitem__(self,i):
  im=Image.open(self.paths[i]).convert('RGB').resize((self.size,self.size),Image.Resampling.BICUBIC)
  arr=np.asarray(im,dtype=np.float32)/127.5-1
  return torch.from_numpy(arr).permute(2,0,1)

def main():
 p=argparse.ArgumentParser(); p.add_argument('--data',default='data/images'); p.add_argument('--out',default='out/image_model.pt'); p.add_argument('--steps',type=int,default=10000); p.add_argument('--size',type=int,default=64); p.add_argument('--batch-size',type=int,default=8); p.add_argument('--base',type=int,default=64); p.add_argument('--lr',type=float,default=2e-4); p.add_argument('--workers',type=int,default=0); a=p.parse_args()
 ds=Images(a.data,a.size)
 if len(ds)<20: raise SystemExit('Kamida 20 ta o‘zingizga tegishli yoki litsenziyali rasmni data/images/ ga joylang. Amaliy sifat uchun minglab rasm kerak.')
 dev='cuda' if torch.cuda.is_available() else 'cpu'; dl=DataLoader(ds,batch_size=a.batch_size,shuffle=True,num_workers=a.workers,drop_last=True)
 model=TinyImageDenoiser(base=a.base).to(dev); opt=torch.optim.AdamW(model.parameters(),lr=a.lr)
 # DDPM linear noise schedule
 betas=torch.linspace(1e-4,.02,1000,device=dev); alphas=1-betas; abar=torch.cumprod(alphas,0)
 step=0; model.train()
 while step<a.steps:
  for x in dl:
   x=x.to(dev); t=torch.randint(0,1000,(x.size(0),),device=dev); eps=torch.randn_like(x)
   xt=abar[t,None,None,None].sqrt()*x+(1-abar[t,None,None,None]).sqrt()*eps
   pred=model(xt,t); loss=F.mse_loss(pred,eps); opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step(); step+=1
   if step==1 or step%100==0: print(f'step {step}/{a.steps} loss={loss.item():.5f} device={dev}')
   if step%1000==0 or step==a.steps:
    os.makedirs(os.path.dirname(a.out) or '.',exist_ok=True); torch.save({'state_dict':model.state_dict(),'size':a.size,'base':a.base,'steps':step,'betas':betas.cpu()},a.out)
   if step>=a.steps: break
 print('Saved from-scratch image denoiser:',a.out)
if __name__=='__main__': main()
