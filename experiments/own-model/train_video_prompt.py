"""Train a prompt-conditioned 3D video diffusion research model from scratch.
data/videos/captions.jsonl rows: {"file":"clip.mp4","caption":"a horse running in a field"}.
"""
import argparse, os, glob, json
import numpy as np, torch, imageio.v3 as iio
from PIL import Image
from torch.nn import functional as F
from torch.utils.data import Dataset,DataLoader
from prompt_models import PromptVideoDenoiser,tokenize_prompt
class Clips(Dataset):
 def __init__(self,root,frames,size):
  self.root=root; self.frames=frames; self.size=size; self.paths=[]
  for ext in ('*.mp4','*.gif','*.webm','*.mov'): self.paths+=glob.glob(os.path.join(root,'**',ext),recursive=True)
  self.caps={}
  cap=os.path.join(root,'captions.jsonl')
  if os.path.exists(cap):
   for line in open(cap,encoding='utf-8'):
    try:
     x=json.loads(line); self.caps[os.path.basename(x['file'])]=x['caption']
    except Exception: pass
  self.paths=[x for x in self.paths if os.path.basename(x) in self.caps]
 def __len__(self): return len(self.paths)
 def __getitem__(self,i):
  path=self.paths[i]; raw=iio.imread(path)
  if raw.ndim==3: raw=np.repeat(raw[None,...],self.frames,axis=0)
  ids=np.linspace(0,len(raw)-1,self.frames).astype(int); arr=[]
  for j in ids:
   fr=raw[j]
   if fr.ndim==2: fr=np.stack([fr]*3,-1)
   im=Image.fromarray(fr[:,:,:3].astype('uint8')).convert('RGB').resize((self.size,self.size),Image.Resampling.BICUBIC)
   arr.append(np.asarray(im,dtype=np.float32)/127.5-1)
  tokens=(tokenize_prompt(self.caps[os.path.basename(path)])+[0]*48)[:48]
  return torch.from_numpy(np.stack(arr)).permute(3,0,1,2),torch.tensor(tokens,dtype=torch.long)
def main():
 p=argparse.ArgumentParser(); p.add_argument('--data',default='data/videos'); p.add_argument('--out',default='out/prompt_video_model.pt'); p.add_argument('--steps',type=int,default=5000); p.add_argument('--frames',type=int,default=8); p.add_argument('--size',type=int,default=32); p.add_argument('--batch-size',type=int,default=1); p.add_argument('--base',type=int,default=16); a=p.parse_args()
 ds=Clips(a.data,a.frames,a.size)
 if len(ds)<10: raise SystemExit('Kamida 10 ta video-caption juftligi kerak; amaliy sifat uchun ko‘proq litsenziyali videolar zarur.')
 dev='cuda' if torch.cuda.is_available() else 'cpu'; dl=DataLoader(ds,batch_size=a.batch_size,shuffle=True,drop_last=True)
 model=PromptVideoDenoiser(base=a.base).to(dev); opt=torch.optim.AdamW(model.parameters(),lr=1e-4)
 betas=torch.linspace(1e-4,.02,1000,device=dev); alphas=1-betas; abar=torch.cumprod(alphas,0); step=0; model.train()
 while step<a.steps:
  for x,ids in dl:
   x,ids=x.to(dev),ids.to(dev); t=torch.randint(0,1000,(x.size(0),),device=dev); eps=torch.randn_like(x)
   ab=abar[t,None,None,None,None]; xt=ab.sqrt()*x+(1-ab).sqrt()*eps
   loss=F.mse_loss(model(xt,t,ids),eps); opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1); opt.step(); step+=1
   if step==1 or step%50==0: print(f'step {step}/{a.steps} loss={loss.item():.5f} device={dev}')
   if step%250==0 or step==a.steps:
    os.makedirs(os.path.dirname(a.out) or '.',exist_ok=True); torch.save({'state_dict':model.state_dict(),'frames':a.frames,'size':a.size,'base':a.base,'steps':step,'betas':betas.cpu()},a.out)
   if step>=a.steps: break
 print('Saved prompt-conditioned video research model:',a.out)
if __name__=='__main__': main()
