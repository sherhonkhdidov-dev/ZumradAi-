"""Sample from a trained unconditional DDPM image model; no prompt conditioning."""
import argparse, os, torch
from PIL import Image
import numpy as np
from image_model import TinyImageDenoiser

def main():
 p=argparse.ArgumentParser(); p.add_argument('--checkpoint',default='out/image_model.pt'); p.add_argument('--out',default='out/generated-image.png'); p.add_argument('--steps',type=int,default=1000); p.add_argument('--seed',type=int,default=42); a=p.parse_args()
 ck=torch.load(a.checkpoint,map_location='cpu',weights_only=False); size=int(ck['size']); dev='cuda' if torch.cuda.is_available() else 'cpu'
 model=TinyImageDenoiser(base=int(ck['base'])).to(dev); model.load_state_dict(ck['state_dict']); model.eval()
 betas=ck.get('betas',torch.linspace(1e-4,.02,1000)).to(dev); alphas=1-betas; abar=torch.cumprod(alphas,0)
 torch.manual_seed(a.seed); x=torch.randn(1,3,size,size,device=dev); total=len(betas); use=min(max(a.steps,1),total)
 indices=torch.linspace(total-1,0,use).long().unique_consecutive()
 with torch.no_grad():
  for j,tv in enumerate(indices):
   t=int(tv); tb=torch.tensor([t],device=dev); pred=model(x,tb)
   x=(x-(1-alphas[t])/torch.sqrt(1-abar[t])*pred)/torch.sqrt(alphas[t])
   if t>0:
    prev=max(t-1,0); x=x+torch.sqrt(betas[t])*torch.randn_like(x)
   if (j+1)%100==0: print(f'denoising {j+1}/{len(indices)}')
 arr=((x[0].clamp(-1,1)+1)*127.5).byte().permute(1,2,0).cpu().numpy(); os.makedirs(os.path.dirname(a.out) or '.',exist_ok=True); Image.fromarray(arr).save(a.out); print('Saved',a.out,'(unconditional; no prompt support)')
if __name__=='__main__': main()
