"""Evaluate a trained checkpoint on held-out JSONL examples; no model/API downloads."""
import argparse, json, math, os, torch
from model import TinyZumradLM
from tokenizer import ZumradBPETokenizer

def read_records(path):
    out=[]
    with open(path,encoding='utf-8') as f:
        for n,line in enumerate(f,1):
            if not line.strip(): continue
            try: r=json.loads(line)
            except json.JSONDecodeError as e: raise SystemExit(f'{path}:{n}: JSON xatosi: {e}')
            if isinstance(r,dict) and 'prompt' in r and ('response' in r or 'completion' in r): out.append((str(r['prompt']),str(r.get('response',r.get('completion','')))))
    return out

def main():
    p=argparse.ArgumentParser(); p.add_argument('--data',default='data/validation.jsonl'); p.add_argument('--checkpoint',default='out/best_model.pt'); p.add_argument('--out',default='out/evaluation.json'); p.add_argument('--max-new-tokens',type=int,default=500); a=p.parse_args()
    if not os.path.exists(a.checkpoint): raise SystemExit(f'Checkpoint topilmadi: {a.checkpoint}. Avval train.py ishlating.')
    tok_path=os.path.join(os.path.dirname(a.checkpoint),'tokenizer.json')
    if not os.path.exists(tok_path): raise SystemExit('tokenizer.json topilmadi; yangi tokenizer bilan qayta trening qiling.')
    tokenizer=ZumradBPETokenizer.load(tok_path); ck=torch.load(a.checkpoint,map_location='cpu',weights_only=False); cfg=ck['config']
    model=TinyZumradLM(**cfg); model.load_state_dict(ck['state_dict']); model.eval(); rows=read_records(a.data)
    if not rows: raise SystemExit('Validation JSONL ichida prompt/response yozuvlari topilmadi.')
    losses=[]; results=[]
    with torch.no_grad():
        for prompt,expected in rows:
            full=f'\nUSER: {prompt}\nASSISTANT: {expected}\n'
            ids=tokenizer.encode(full)
            if len(ids)>1:
                x=torch.tensor([ids[:-1]],dtype=torch.long); y=torch.tensor([ids[1:]],dtype=torch.long)
                # Measure chunks without crossing model context boundaries.
                token_losses=[]
                for start in range(0,x.shape[1],cfg['block_size']):
                    xx=x[:,start:start+cfg['block_size']]; yy=y[:,start:start+cfg['block_size']]
                    if xx.shape[1]==0: continue
                    _,loss=model(xx,yy); token_losses.append(float(loss))
                if token_losses: losses.extend(token_losses)
            prompt_text=f'\nUSER: {prompt}\nASSISTANT:'
            context=torch.tensor([tokenizer.encode(prompt_text)],dtype=torch.long)
            with torch.no_grad():
                for _ in range(min(max(a.max_new_tokens,1),300)):
                    logits,_=model(context[:,-cfg['block_size']:]); nxt=int(torch.argmax(logits[0,-1]).item())
                    context=torch.cat([context,torch.tensor([[nxt]])],dim=1)
                    decoded=tokenizer.decode(context[0].tolist())
                    # Answers often contain legitimate newlines. Stop only if the
                    # model appears to start the next training record, not at any newline.
                    if decoded.endswith('\nUSER:') or decoded.endswith('\nASSISTANT:'):
                        break
            decoded=tokenizer.decode(context[0].tolist())
            generated=decoded[len(prompt_text):]
            for marker in ('\nUSER:', '\nASSISTANT:'):
                if marker in generated: generated=generated.split(marker,1)[0]
            results.append({'prompt':prompt,'expected':expected,'generated':generated.strip()})
    mean_loss=sum(losses)/len(losses) if losses else None
    report={'checkpoint':a.checkpoint,'examples':len(rows),'mean_chunk_loss':mean_loss,'perplexity_estimate':math.exp(min(mean_loss,20)) if mean_loss is not None else None,'warning':'Character-level model; these metrics are diagnostic only and do not establish answer correctness. Review generated outputs manually.','results':results}
    os.makedirs(os.path.dirname(a.out) or '.',exist_ok=True)
    with open(a.out,'w',encoding='utf-8') as f: json.dump(report,f,ensure_ascii=False,indent=2)
    print(f"Examples: {len(rows)} | mean chunk loss: {mean_loss} | report: {a.out}")
    for r in results[:3]: print('\nUSER:',r['prompt'],'\nMODEL:',r['generated'][:500])
if __name__=='__main__': main()
