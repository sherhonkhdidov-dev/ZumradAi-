"""Generate a prompt-conditioned GIF from a trained from-scratch video checkpoint."""
import argparse, os, torch, numpy as np, imageio.v2 as imageio
from PIL import Image
from prompt_models import PromptVideoDenoiser,tokenize_prompt
def main():
 p=argparse.ArgumentParser(); p.add_argument('--checkpoint',default='out/prompt_video_model.pt'); p.add_argument('--prompt',required=True); p.add_argument('--out',default='out/generated-prompt-video.gif'); p.add_argument('--steps',type=int,default=80); p.add_argument('--fps',type=int,default=6); p.add_argument('--seed',type=int,default=42); a=p.parse_args()
 ck=torch.load(a.checkpoint,map_location='cpu',weights_only=False); frames,size,base=int(ck['frames']),int(ck['size']),int(ck['base']); dev='cuda' if torch.cuda.is_available() else 'cpu'
 model=PromptVideoDenoiser(base=base).to(dev); model.load_state_dict(ck['state_dict']); model.eval()
 ids=(tokenize_prompt(a.prompt)+[0]*48)[:48]; ids=torch.tensor([ids],device=dev)
 betas=ck['betas'].to(dev); alphas=1-betas; abar=torch.cumprod(alphas,0); torch.manual_seed(a.seed)
 x=torch.randn(1,3,frames,size,size,device=dev); indices=torch.linspace(len(betas)-1,0,min(max(a.steps,1),len(betas))).long().unique_consecutive()
 with torch.no_grad():
  for tv in indices:
   t=int(tv); tb=torch.tensor([t],device=dev); pred=model(x,tb,ids)
   x=(x-(1-alphas[t])/torch.sqrt(1-abar[t])*pred)/torch.sqrt(alphas[t])
   if t>0: x=x+torch.sqrt(betas[t])*torch.randn_like(x)
 arr=((x[0].clamp(-1,1)+1)*127.5).byte().permute(1,2,3,0).cpu().numpy(); imgs=[Image.fromarray(fr) for fr in arr]
 os.makedirs(os.path.dirname(a.out) or '.',exist_ok=True); imgs[0].save(a.out,save_all=True,append_images=imgs[1:],duration=int(1000/max(a.fps,1)),loop=0)
 print('Saved:',a.out,'Prompt:',a.prompt)
if __name__=='__main__': main()
