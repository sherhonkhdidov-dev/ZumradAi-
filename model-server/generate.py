"""Generate text with a trained Zumrad checkpoint and its saved tokenizer."""
import argparse,os,torch
from model import TinyZumradLM
from tokenizer import ZumradBPETokenizer

def main():
 ap=argparse.ArgumentParser(); ap.add_argument('--prompt',default='Salom'); ap.add_argument('--tokens',type=int,default=120); ap.add_argument('--temperature',type=float,default=.8); ap.add_argument('--out',default='out'); ap.add_argument('--checkpoint',default=''); ap.add_argument('--top-k',type=int,default=40); a=ap.parse_args()
 ckpt=a.checkpoint or os.path.join(a.out,'best_model.pt')
 tok_path=os.path.join(os.path.dirname(ckpt),'tokenizer.json')
 if not os.path.exists(tok_path): tok_path=os.path.join(a.out,'tokenizer.json')
 if not os.path.exists(tok_path): raise SystemExit('tokenizer.json topilmadi. Yangi train.py bilan modelni o‘qiting.')
 tokenizer=ZumradBPETokenizer.load(tok_path); ck=torch.load(ckpt,map_location='cpu',weights_only=False); cfg=ck['config']
 model=TinyZumradLM(**cfg); model.load_state_dict(ck['state_dict']); model.eval()
 ids=tokenizer.encode(a.prompt) or [0]; idx=torch.tensor([ids],dtype=torch.long)
 with torch.no_grad():
  for _ in range(max(1,min(a.tokens,1000))):
   logits,_=model(idx[:,-cfg['block_size']:]); logits=logits[0,-1]/max(a.temperature,.05)
   if a.top_k>0:
    k=min(a.top_k,logits.numel()); cutoff=torch.topk(logits,k).values[-1]; logits[logits<cutoff]=-float('inf')
   probs=torch.softmax(logits,dim=-1)
   if not torch.isfinite(probs).all(): nxt=int(torch.argmax(logits))
   else: nxt=int(torch.multinomial(probs,1).item())
   idx=torch.cat([idx,torch.tensor([[nxt]])],dim=1)
 print(tokenizer.decode(idx[0].tolist())[len(a.prompt):])
if __name__=='__main__': main()
