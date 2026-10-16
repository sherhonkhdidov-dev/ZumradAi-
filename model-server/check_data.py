"""Check JSONL training data for format issues and exact duplicate prompts."""
import argparse,json,glob,os
p=argparse.ArgumentParser(); p.add_argument('--data',default='data'); a=p.parse_args()
files=glob.glob(os.path.join(a.data,'**','*.jsonl'),recursive=True); total=bad=empty=0; seen={}; dup=[]
for path in files:
 if os.path.basename(path).lower().startswith(('validation','eval','test')): continue
 with open(path,encoding='utf-8') as f:
  for line_no,line in enumerate(f,1):
   if not line.strip(): continue
   total+=1
   try: r=json.loads(line)
   except json.JSONDecodeError: bad+=1; print(f'JSON xatosi: {path}:{line_no}'); continue
   if isinstance(r,dict) and 'prompt' in r and ('response' in r or 'completion' in r):
    q=str(r['prompt']).strip(); ans=str(r.get('response',r.get('completion',''))).strip()
    if not q or not ans: empty+=1; print(f'Bo‘sh prompt/javob: {path}:{line_no}')
    key=' '.join(q.lower().split())
    if key in seen: dup.append((path,line_no,seen[key]))
    else: seen[key]=f'{path}:{line_no}'
   elif not (isinstance(r,dict) and ('messages' in r or 'text' in r)):
    bad+=1; print(f'Tanish format emas: {path}:{line_no}')
print(f'Yozuvlar={total}, xato={bad}, bo‘sh={empty}, takroriy prompt={len(dup)}')
for path,line,first in dup[:20]: print(f'Takror: {path}:{line} (birinchi: {first})')
if bad or empty: raise SystemExit(1)
