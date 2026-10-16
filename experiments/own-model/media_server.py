"""Own-only media inference API for prompt-conditioned checkpoints.
Run separately from server.py after training. No external AI service is used.
"""
import os, io, base64, torch, numpy as np, imageio.v2 as imageio
from PIL import Image
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from prompt_models import PromptImageDenoiser, PromptVideoDenoiser, tokenize_prompt

app=FastAPI(title="Zumrad AI Own Media Generators",version="0.1.0")
TOKEN=os.getenv("OWN_MEDIA_TOKEN", os.getenv("OWN_MODEL_TOKEN",""))
IMG=os.getenv("OWN_IMAGE_CHECKPOINT","out/prompt_image_model.pt")
VID=os.getenv("OWN_VIDEO_CHECKPOINT","out/prompt_video_model.pt")
image_model=video_model=None
img_cfg=vid_cfg=None
device="cuda" if torch.cuda.is_available() else "cpu"

@app.on_event("startup")
def load_models():
 global image_model,video_model,img_cfg,vid_cfg
 if os.path.exists(IMG):
  ck=torch.load(IMG,map_location="cpu",weights_only=False); img_cfg=ck
  image_model=PromptImageDenoiser(base=int(ck["base"])).to(device); image_model.load_state_dict(ck["state_dict"]); image_model.eval()
 if os.path.exists(VID):
  ck=torch.load(VID,map_location="cpu",weights_only=False); vid_cfg=ck
  video_model=PromptVideoDenoiser(base=int(ck["base"])).to(device); video_model.load_state_dict(ck["state_dict"]); video_model.eval()

def auth(authorization):
 if TOKEN and authorization != f"Bearer {TOKEN}": raise HTTPException(401,"Unauthorized")
def prompt_ids(prompt):
 ids=(tokenize_prompt(prompt)+[0]*48)[:48]
 return torch.tensor([ids],device=device)

class ImageReq(BaseModel):
 prompt:str=Field(min_length=1,max_length=1500)
 quality:str="fast"
 aspect:str="1:1"
 width:int=64
 height:int=64
 steps:int=40
 seed:int=42
class VideoReq(BaseModel):
 prompt:str=Field(min_length=1,max_length=1500)
 seconds:int=4
 aspect:str="16:9"
 frames:int=8
 fps:int=6
 steps:int=40
 seed:int=42

@app.get("/health")
def health():
 return {"status":"ok","own_only":True,"image_checkpoint_loaded":image_model is not None,"video_checkpoint_loaded":video_model is not None,"device":device}

def sample(model,ck,prompt,steps,seed,video=False):
 betas=ck["betas"].to(device); alphas=1-betas; abar=torch.cumprod(alphas,0)
 ids=prompt_ids(prompt); torch.manual_seed(int(seed))
 if video: x=torch.randn(1,3,int(ck["frames"]),int(ck["size"]),int(ck["size"]),device=device)
 else: x=torch.randn(1,3,int(ck["size"]),int(ck["size"]),device=device)
 indices=torch.linspace(len(betas)-1,0,min(max(int(steps),1),len(betas))).long().unique_consecutive()
 with torch.no_grad():
  for tv in indices:
   t=int(tv); tb=torch.tensor([t],device=device); pred=model(x,tb,ids)
   x=(x-(1-alphas[t])/torch.sqrt(1-abar[t])*pred)/torch.sqrt(alphas[t])
   if t>0: x=x+torch.sqrt(betas[t])*torch.randn_like(x)
 return x

@app.post("/api/image")
def image(req:ImageReq,authorization:str|None=Header(default=None)):
 auth(authorization)
 if image_model is None: raise HTTPException(503,"O‘z promptli rasm modelimiz o‘qitilmagan. train_image_prompt.py ni bajaring.")
 x=sample(image_model,img_cfg,req.prompt,req.steps,req.seed)
 arr=((x[0].clamp(-1,1)+1)*127.5).byte().permute(1,2,0).cpu().numpy()
 buf=io.BytesIO(); Image.fromarray(arr).save(buf,format="PNG")
 uri="data:image/png;base64,"+base64.b64encode(buf.getvalue()).decode()
 return {"image":uri,"model":"Zumrad Own Prompt Image Model (research)","prompt":req.prompt,"width":int(img_cfg["size"]),"height":int(img_cfg["size"]),"warning":"Tajriba modeli; sifat o‘quv ma’lumotlari va treningga bog‘liq."}

@app.post("/api/video")
def video(req:VideoReq,authorization:str|None=Header(default=None)):
 auth(authorization)
 if video_model is None: raise HTTPException(503,"O‘z promptli video modelimiz o‘qitilmagan. train_video_prompt.py ni bajaring.")
 x=sample(video_model,vid_cfg,req.prompt,req.steps,req.seed,video=True)
 arr=((x[0].clamp(-1,1)+1)*127.5).byte().permute(1,2,3,0).cpu().numpy()
 frames=[Image.fromarray(fr) for fr in arr]; buf=io.BytesIO()
 frames[0].save(buf,format="GIF",save_all=True,append_images=frames[1:],duration=int(1000/max(req.fps,1)),loop=0)
 uri="data:image/gif;base64,"+base64.b64encode(buf.getvalue()).decode()
 return {"url":uri,"model":"Zumrad Own Prompt Video Model (research)","prompt":req.prompt,"frames":len(frames),"warning":"Tajriba modeli; sifat o‘quv ma’lumotlari va treningga bog‘liq."}
