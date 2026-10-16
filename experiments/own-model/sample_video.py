"""Sample a short unconditional clip from a trained tiny 3D DDPM denoiser."""
import argparse, os, torch
import numpy as np
from PIL import Image
from video_model import VideoDenoiser3D
try: import imageio.v2 as imageio
except ImportError: imageio=None

def main():
 p=argparse.ArgumentParser(); p.add_argument('--checkpoint',default='out/video_model.pt'); p.add_argument('--out',default='out/generated-video.gif'); p.add_argument('--steps',type=int,default=1000); p.add_argument('--fps',type=int,default=6); p.add_argument('--seed',type=int,default=42); a=p.parse_args()
 if imageio is None: raise SystemExit('Install imageio and imageio-ffmpeg first.')
 ck=torch.load(a.checkpoint,map_location='cpu',weights_only=False); frames=int(ck['frames']); size=int(ck['size']); dev='cuda' if torch.cuda.is_available() else 'cpu'
 model=VideoDenoiser3D(base=int(ck['base'])).to(dev); model.load_state_dict(ck['state_dict']); model.eval()
 betas=ck.get('betas',torch.linspace(1e-4,.02,1000)).to(dev); alphas=1-betas; abar=torch.cumprod(alphas,0)
 torch.manual_seed(a.seed); x=torch.randn(1,3,frames,size,size,device=dev); total=len(betas); use=min(max(a.steps,1),total); indices=torch.linspace(total-1,0,use).long().unique_consecutive()
 with torch.no_grad():
  for j,tv in enumerate(indices):
   t=int(tv); tb=torch.tensor([t],device=dev); pred=model(x,tb)
   x=(x-(1-alphas[t])/torch.sqrt(1-abar[t])*pred)/torch.sqrt(alphas[t])
   if t>0: x=x+torch.sqrt(betas[t])*torch.randn_like(x)
   if (j+1)%100==0: print(f'denoising {j+1}/{len(indices)}')
 arr=((x[0].clamp(-1,1)+1)*127.5).byte().permute(1,2,3,0).cpu().numpy(); imgs=[Image.fromarray(fr) for fr in arr]
 os.makedirs(os.path.dirname(a.out) or '.',exist_ok=True)
 if a.out.lower().endswith('.gif'): imgs[0].save(a.out,save_all=True,append_images=imgs[1:],duration=int(1000/max(a.fps,1)),loop=0)
 else: imageio.mimsave(a.out,[np.asarray(im) for im in imgs],fps=a.fps)
 print('Saved',a.out,'(unconditional research sample; no prompt support)')
if __name__=='__main__': main()
