"""Train prompt-conditioned image diffusion from random initialization.
Requires data/images/ and data/images/captions.jsonl: {"file":"cat.jpg","caption":"a cat on grass"}.
"""
import argparse, os, glob, json, random
import numpy as np, torch
from torch.nn import functional as F
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from prompt_models import PromptImageDenoiser, tokenize_prompt
class Images(Dataset):
 def __init__(self,root,size):
  self.root=root; self.size=size; self.paths=[]
  for ext in ('*.png','*.jpg','*.jpeg','*.webp','*.bmp'): self.paths+=glob.glob(os.path.join(root,'**',ext),recursive=True)
  cap=os.path.join(root,'captions.jsonl'); self.caps={}
  if os.path.exists(cap):
   for line in open(cap,encoding='utf-8'):
    try:
     x=json.loads(line); self.caps[os.path.basename(x['file'])]=x['caption']
    except Exception: pass
  self.paths=[x for x in self.paths if os.path.basename(x) in self.caps]
 def __len__(self): return len(self.paths)
 def __getitem__(self,i):
  path=self.paths[i]; im=Image.open(path).convert('RGB').resize((self.size,self.size),Image.Resampling.BICUBIC)
  arr=np.asarray(im,dtype=np.float32)/127.5-1
  ids=tokenize_prompt(self.caps[os.path.basename(path)])
  ids=(ids+[0]*48)[:48]
  return torch.from_numpy(arr).permute(2,0,1),torch.tensor(ids,dtype=torch.long)
def main():
 p=argparse.ArgumentParser(); p.add_argument('--data',default='data/images'); p.add_argument('--out',default='out/prompt_image_model.pt'); p.add_argument('--steps',type=int,default=10000); p.add_argument('--size',type=int,default=64); p.add_argument('--batch-size',type=int,default=4); p.add_argument('--base',type=int,default=32); p.add_argument('--lr',type=float,default=2e-4); a=p.parse_args()
 ds=Images(a.data,a.size)
 if len(ds)<20: raise SystemExit('Kamida 20 ta rasm va har biri uchun captions.jsonl yozuvi kerak. Haqiqiy sifat uchun minglab litsenziyali rasm-caption juftligi kerak.')
 dev='cuda' if torch.cuda.is_available() else 'cpu'; dl=DataLoader(ds,batch_size=a.batch_size,shuffle=True,drop_last=True)
 model=PromptImageDenoiser(base=a.base).to(dev); opt=torch.optim.AdamW(model.parameters(),lr=a.lr)
 betas=torch.linspace(1e-4,.02,1000,device=dev); alphas=1-betas; abar=torch.cumprod(alphas,0); step=0; model.train()
 while step<a.steps:
  for x,ids in dl:
   x,ids=x.to(dev),ids.to(dev); t=torch.randint(0,1000,(x.size(0),),device=dev); eps=torch.randn_like(x)
   ab=abar[t,None,None,None]; xt=ab.sqrt()*x+(1-ab).sqrt()*eps
   loss=F.mse_loss(model(xt,t,ids),eps); opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1); opt.step(); step+=1
   if step==1 or step%100==0: print(f'step {step}/{a.steps} loss={loss.item():.5f} device={dev}')
   if step%500==0 or step==a.steps:
    os.makedirs(os.path.dirname(a.out) or '.',exist_ok=True); torch.save({'state_dict':model.state_dict(),'size':a.size,'base':a.base,'steps':step,'betas':betas.cpu()},a.out)
   if step>=a.steps: break
 print('Saved prompt-conditioned research model:',a.out)
if __name__=='__main__': main()
