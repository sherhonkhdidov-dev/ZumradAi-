"""Train a tiny video diffusion noise predictor from scratch on local GIF/MP4 clips.
Requires imageio + imageio-ffmpeg for MP4 support. This is research-scale only.
"""
import argparse, os, glob
import numpy as np, torch
from torch.nn import functional as F
from torch.utils.data import Dataset,DataLoader
from video_model import VideoDenoiser3D
try: import imageio.v3 as iio
except ImportError: iio=None
from PIL import Image
class Clips(Dataset):
 def __init__(self,root,frames,size):
  self.paths=[]
  for ext in ('*.mp4','*.gif','*.webm','*.mov'): self.paths+=glob.glob(os.path.join(root,'**',ext),recursive=True)
  self.frames,self.size=frames,size
 def __len__(self): return len(self.paths)
 def __getitem__(self,i):
  path=self.paths[i]
  if iio is None: raise RuntimeError('imageio va imageio-ffmpeg paketlarini o‘rnating.')
  try: raw=iio.imread(path)
  except Exception as e: raise RuntimeError(f'Clip o‘qilmadi: {path}: {e}')
  if raw.ndim==3: raw=np.repeat(raw[None,...],self.frames,axis=0)
  ids=np.linspace(0,len(raw)-1,self.frames).astype(int); frames=[]
  for j in ids:
   fr=raw[j]
   if fr.ndim==2: fr=np.stack([fr]*3,-1)
   im=Image.fromarray(fr[:,:,:3].astype('uint8')).convert('RGB').resize((self.size,self.size),Image.Resampling.BICUBIC)
   frames.append(np.asarray(im,dtype=np.float32)/127.5-1)
  arr=np.stack(frames); return torch.from_numpy(arr).permute(3,0,1,2)
def main():
 p=argparse.ArgumentParser(); p.add_argument('--data',default='data/videos'); p.add_argument('--out',default='out/video_model.pt'); p.add_argument('--steps',type=int,default=5000); p.add_argument('--frames',type=int,default=8); p.add_argument('--size',type=int,default=32); p.add_argument('--batch-size',type=int,default=2); p.add_argument('--base',type=int,default=32); a=p.parse_args()
 ds=Clips(a.data,a.frames,a.size)
 if len(ds)<10: raise SystemExit('Kamida 10 ta litsenziyali video clipni data/videos/ ga joylang; sifat uchun ko‘p, xilma-xil video kerak.')
 dev='cuda' if torch.cuda.is_available() else 'cpu'; dl=DataLoader(ds,batch_size=a.batch_size,shuffle=True,drop_last=True)
 model=VideoDenoiser3D(base=a.base).to(dev); opt=torch.optim.AdamW(model.parameters(),lr=1e-4)
 betas=torch.linspace(1e-4,.02,1000,device=dev); abar=torch.cumprod(1-betas,0); step=0
 while step<a.steps:
  for x in dl:
   x=x.to(dev); t=torch.randint(0,1000,(x.size(0),),device=dev); eps=torch.randn_like(x)
   ab=abar[t,None,None,None,None]; xt=ab.sqrt()*x+(1-ab).sqrt()*eps
   loss=F.mse_loss(model(xt,t),eps); opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1); opt.step(); step+=1
   if step==1 or step%100==0: print(f'step {step}/{a.steps} loss={loss.item():.5f} device={dev}')
   if step%500==0 or step==a.steps:
    os.makedirs(os.path.dirname(a.out) or '.',exist_ok=True); torch.save({'state_dict':model.state_dict(),'frames':a.frames,'size':a.size,'base':a.base,'steps':step,'betas':betas.cpu()},a.out)
   if step>=a.steps: break
 print('Saved from-scratch video denoiser:',a.out)
if __name__=='__main__': main()
