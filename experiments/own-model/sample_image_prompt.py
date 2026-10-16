"""Generate a prompt-conditioned sample from a trained from-scratch checkpoint."""
import argparse, os, torch, numpy as np
from PIL import Image
from prompt_models import PromptImageDenoiser, tokenize_prompt
def main():
 p=argparse.ArgumentParser(); p.add_argument('--checkpoint',default='out/prompt_image_model.pt'); p.add_argument('--prompt',required=True); p.add_argument('--out',default='out/generated-prompt-image.png'); p.add_argument('--steps',type=int,default=100); p.add_argument('--seed',type=int,default=42); a=p.parse_args()
 ck=torch.load(a.checkpoint,map_location='cpu',weights_only=False); size=int(ck['size']); dev='cuda' if torch.cuda.is_available() else 'cpu'
 model=PromptImageDenoiser(base=int(ck['base'])).to(dev); model.load_state_dict(ck['state_dict']); model.eval()
 ids=(tokenize_prompt(a.prompt)+[0]*48)[:48]; ids=torch.tensor([ids],device=dev)
 betas=ck['betas'].to(dev); alphas=1-betas; abar=torch.cumprod(alphas,0); torch.manual_seed(a.seed)
 x=torch.randn(1,3,size,size,device=dev); indices=torch.linspace(len(betas)-1,0,min(max(a.steps,1),len(betas))).long().unique_consecutive()
 with torch.no_grad():
  for tv in indices:
   t=int(tv); tb=torch.tensor([t],device=dev); pred=model(x,tb,ids)
   x=(x-(1-alphas[t])/torch.sqrt(1-abar[t])*pred)/torch.sqrt(alphas[t])
   if t>0: x=x+torch.sqrt(betas[t])*torch.randn_like(x)
 arr=((x[0].clamp(-1,1)+1)*127.5).byte().permute(1,2,0).cpu().numpy(); os.makedirs(os.path.dirname(a.out) or '.',exist_ok=True); Image.fromarray(arr).save(a.out); print('Saved:',a.out,'Prompt:',a.prompt)
if __name__=='__main__': main()
