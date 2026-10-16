"""Small dependency-free Unicode character-pair BPE tokenizer for the from-scratch model."""
import json
from collections import Counter

class ZumradBPETokenizer:
    def __init__(self, tokens, merges):
        self.tokens=list(tokens)
        self.merges=[tuple(map(int,m)) for m in merges]
        self.token_to_id={}
        # Token IDs may decode to the same string if different merges create the same spelling.
        for i,t in enumerate(self.tokens): self.token_to_id.setdefault(t,i)
        self.unk_id=0
        self._merge_set={}
        for left,right,new in self.merges: self._merge_set[(left,right)]=new

    @classmethod
    def train(cls, text, vocab_size=512, min_pair_count=2):
        chars=sorted(set(text))
        tokens=['<unk>']+chars
        char_to_id={c:i+1 for i,c in enumerate(chars)}
        seq=[char_to_id[c] for c in text]
        merges=[]
        target=max(len(tokens),int(vocab_size))
        while len(tokens)<target and len(seq)>1:
            counts=Counter(zip(seq,seq[1:]))
            if not counts: break
            pair,count=max(counts.items(),key=lambda kv:(kv[1],-kv[0][0],-kv[0][1]))
            if count<min_pair_count: break
            new_id=len(tokens); left,right=pair
            tokens.append(tokens[left]+tokens[right]); merges.append([left,right,new_id])
            out=[]; i=0
            while i<len(seq):
                if i+1<len(seq) and seq[i]==left and seq[i+1]==right:
                    out.append(new_id); i+=2
                else: out.append(seq[i]); i+=1
            seq=out
        return cls(tokens,merges)

    def encode(self, text):
        # Start from Unicode code points, then apply the exact learned merge order.
        ids=[]
        for ch in text: ids.append(self.token_to_id.get(ch,self.unk_id))
        for left,right,new in self.merges:
            out=[]; i=0
            while i<len(ids):
                if i+1<len(ids) and ids[i]==left and ids[i+1]==right:
                    out.append(new); i+=2
                else: out.append(ids[i]); i+=1
            ids=out
        return ids

    def decode(self, ids):
        return ''.join(self.tokens[int(i)] if 0<=int(i)<len(self.tokens) and int(i)!=self.unk_id else '�' for i in ids)

    def save(self,path):
        with open(path,'w',encoding='utf-8') as f:
            json.dump({'type':'zumrad-char-bpe-v1','tokens':self.tokens,'merges':self.merges},f,ensure_ascii=False)

    @classmethod
    def load(cls,path):
        with open(path,encoding='utf-8') as f: obj=json.load(f)
        if obj.get('type')!='zumrad-char-bpe-v1': raise ValueError('Unsupported tokenizer format')
        return cls(obj['tokens'],obj['merges'])
