"""Train Zumrad TinyLM from scratch. Character-level research baseline; no pretrained weights."""
import argparse, glob, json, os, random, math, time, hashlib
import torch
from model import TinyZumradLM
from tokenizer import ZumradBPETokenizer

def record_to_text(item):
    if not isinstance(item, dict): return ''
    if isinstance(item.get('messages'), list):
        parts=[]
        for m in item['messages']:
            if isinstance(m,dict):
                content=m.get('content','')
                if isinstance(content,list): content=' '.join(str(x.get('text','')) for x in content if isinstance(x,dict))
                parts.append(f"\n{str(m.get('role','user')).upper()}: {content}\n")
        return ''.join(parts)
    if 'prompt' in item and ('response' in item or 'completion' in item):
        return f"\nUSER: {item['prompt']}\nASSISTANT: {item.get('response',item.get('completion',''))}\n"
    if 'text' in item: return str(item['text'])+'\n'
    return ''

def load_corpus(root, validation_path=None):
    chunks=[]
    for path in sorted(glob.glob(os.path.join(root,'**','*.txt'),recursive=True)):
        try:
            with open(path,encoding='utf-8') as f: chunks.append(f.read())
        except (OSError,UnicodeError) as e: print('Skip',path,e)
    for path in sorted(glob.glob(os.path.join(root,'**','*.jsonl'),recursive=True)):
        if validation_path and os.path.abspath(path)==os.path.abspath(validation_path): continue
        if os.path.basename(path).lower().startswith(('validation','eval','test')): continue
        try:
            with open(path,encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        try: chunks.append(record_to_text(json.loads(line)))
                        except json.JSONDecodeError: print('Skip invalid JSON line in',path)
        except (OSError,UnicodeError) as e: print('Skip',path,e)
    return '\n'.join(x for x in chunks if x.strip())

def load_validation(path):
    if not path or not os.path.isfile(path): return ''
    chunks=[]
    with open(path,encoding='utf-8') as f:
        for line in f:
            if line.strip():
                try: chunks.append(record_to_text(json.loads(line)))
                except json.JSONDecodeError: print('Skip invalid validation JSON line')
    return '\n'.join(chunks)

def main():
    p=argparse.ArgumentParser(description='Zumrad AI: own-model training from random initialization')
    p.add_argument('--steps',type=int,default=5000); p.add_argument('--batch-size',type=int,default=4)
    p.add_argument('--gradient-accumulation',type=int,default=4); p.add_argument('--block-size',type=int,default=256)
    p.add_argument('--lr',type=float,default=3e-4); p.add_argument('--min-lr',type=float,default=3e-5)
    p.add_argument('--n-layer',type=int,default=4); p.add_argument('--n-head',type=int,default=4); p.add_argument('--n-embd',type=int,default=128); p.add_argument('--vocab-size',type=int,default=512)
    p.add_argument('--data',default='data'); p.add_argument('--validation',default='data/validation.jsonl')
    p.add_argument('--out',default='out'); p.add_argument('--eval-every',type=int,default=100)
    p.add_argument('--save-every',type=int,default=500); p.add_argument('--resume',action='store_true')
    p.add_argument('--seed',type=int,default=42); p.add_argument('--amp',action='store_true',help='Use mixed precision on supported CUDA GPUs')
    a=p.parse_args()
    if a.steps<1 or a.batch_size<1 or a.gradient_accumulation<1: raise SystemExit('steps, batch-size va gradient-accumulation musbat bo‘lsin.')
    random.seed(a.seed); torch.manual_seed(a.seed)
    train_text=load_corpus(a.data,a.validation); val_text=load_validation(a.validation)
    if len(train_text)<1000: raise SystemExit('Trening ma’lumoti kam. data/ ichiga ko‘proq .txt yoki JSONL misollar qo‘shing (kamida 1 000 belgi).')
    if len(train_text)<a.block_size*3: raise SystemExit(f"Trening korpusi {len(train_text)} belgi; block-size={a.block_size} uchun ma’lumotni ko‘paytiring yoki --block-size 128 qiling.")
    tokenizer=ZumradBPETokenizer.train(train_text,vocab_size=a.vocab_size)
    train_ids=torch.tensor(tokenizer.encode(train_text),dtype=torch.long)
    val_ids=torch.tensor(tokenizer.encode(val_text),dtype=torch.long) if val_text else train_ids
    if len(val_ids)<a.block_size+2: val_ids=train_ids
    os.makedirs(a.out,exist_ok=True)
    tokenizer.save(os.path.join(a.out,'tokenizer.json'))
    with open(os.path.join(a.out,'tokenizer.json'),'rb') as tf: tokenizer_sha256=hashlib.sha256(tf.read()).hexdigest()
    with open(os.path.join(a.out,'vocab.json'),'w',encoding='utf-8') as f: json.dump({t:i for i,t in enumerate(tokenizer.tokens)},f,ensure_ascii=False)
    device='cuda' if torch.cuda.is_available() else 'cpu'
    if a.amp and device!='cuda': print('AMP faqat CUDA GPU’da yoqiladi; CPU’da odatiy aniqlik ishlatiladi.')
    use_amp=a.amp and device=='cuda'; scaler=torch.amp.GradScaler('cuda',enabled=use_amp)
    config={'vocab_size':len(tokenizer.tokens),'block_size':a.block_size,'n_layer':a.n_layer,'n_head':a.n_head,'n_embd':a.n_embd}
    model=TinyZumradLM(**config).to(device); opt=torch.optim.AdamW(model.parameters(),lr=a.lr,weight_decay=.1)
    start=0; ckpt=os.path.join(a.out,'model.pt'); best=float('inf')
    if a.resume and os.path.exists(ckpt):
        old=torch.load(ckpt,map_location=device,weights_only=False)
        if old.get('config')==config and old.get('tokenizer_sha256')==tokenizer_sha256:
            model.load_state_dict(old['state_dict']); start=int(old.get('step',0))
            if old.get('optimizer'): opt.load_state_dict(old['optimizer'])
            best=float(old.get('best_val',float('inf'))); print('Checkpoint davom ettirildi, step:',start)
        else: print('Checkpoint arxitekturasi yoki tokenizer mos emas; trening noldan boshlanadi.')
    def batch(source):
        ix=torch.randint(0,len(source)-a.block_size-1,(a.batch_size,))
        x=torch.stack([source[i:i+a.block_size] for i in ix]).to(device)
        y=torch.stack([source[i+1:i+a.block_size+1] for i in ix]).to(device)
        return x,y
    def evaluate():
        model.eval(); vals=[]
        with torch.no_grad():
            for _ in range(8):
                x,y=batch(val_ids)
                with torch.autocast(device_type='cuda',dtype=torch.float16,enabled=use_amp): _,vl=model(x,y)
                vals.append(float(vl.item()))
        model.train(); return sum(vals)/len(vals)
    print(f'Training chars={len(train_text):,}; train tokens={len(train_ids):,}; validation tokens={len(val_ids):,}; vocab={len(tokenizer.tokens)}; device={device}; params={sum(p.numel() for p in model.parameters()):,}')
    started=time.time(); opt.zero_grad(set_to_none=True)
    for step in range(start+1,start+a.steps+1):
        # cosine decay, with a gentle warm-up
        progress=(step-start)/max(a.steps,1)
        warmup=min(1.0,step/100)
        lr=a.min_lr+(a.lr-a.min_lr)*0.5*(1+math.cos(math.pi*progress))
        lr=a.min_lr+(lr-a.min_lr)*warmup
        for group in opt.param_groups: group['lr']=lr
        running=0.0
        for _ in range(a.gradient_accumulation):
            x,y=batch(train_ids)
            with torch.autocast(device_type='cuda',dtype=torch.float16,enabled=use_amp): _,loss=model(x,y)
            scaler.scale(loss/a.gradient_accumulation).backward(); running+=float(loss.detach().item())
        scaler.unscale_(opt); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0)
        scaler.step(opt); scaler.update(); opt.zero_grad(set_to_none=True)
        should_eval=(step==start+1 or step%a.eval_every==0 or step==start+a.steps)
        state=None
        if should_eval:
            val=evaluate(); tr=running/a.gradient_accumulation
            print(f'step {step} train={tr:.4f} validation={val:.4f} lr={lr:.2e} elapsed={int(time.time()-started)}s')
            state={'state_dict':model.state_dict(),'config':config,'step':step,'train_loss':tr,'val_loss':val,'best_val':min(best,val),'optimizer':opt.state_dict(),'tokenizer_sha256':tokenizer_sha256,'seed':a.seed,'model_name':'Zumrad TinyLM from scratch'}
            torch.save(state,ckpt)
            if val<best:
                best=val; state['best_val']=best; torch.save(state,os.path.join(a.out,'best_model.pt')); print('  -> best_model.pt yangilandi')
        elif step%a.save_every==0:
            torch.save({'state_dict':model.state_dict(),'config':config,'step':step,'best_val':best,'optimizer':opt.state_dict(),'tokenizer_sha256':tokenizer_sha256,'seed':a.seed},ckpt)
            print('checkpoint saqlandi:',step)
    print('Tugadi. Natijalarni mustaqil eval.py bilan tekshiring; loss kamayishi o‘zi yaxshi javob kafolati emas.')
if __name__=='__main__': main()
