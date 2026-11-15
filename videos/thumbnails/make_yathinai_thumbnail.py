import sys; sys.argv=['x']
exec(open('thumbnails/make_yathin_thumbnail.py').read().split('LABELS=')[0])
import numpy as np
from PIL import Image, ImageDraw, ImageFont
YI='../yathinai/yathinai_icon.png'
def bg2(W,H,cx,cy):
    y,x=np.mgrid[0:H,0:W]; dx=(x-cx)/W; dy=(y-cy)/W; r=np.sqrt(dx*dx+dy*dy)
    stops=[(0,(255,236,120)),(.18,(255,120,190)),(.45,(236,72,153)),(.75,(150,90,255)),(1,(59,130,246))]
    out=np.zeros((H,W,3))
    for c in range(3): out[...,c]=np.interp(r,[s[0] for s in stops],[s[1][c] for s in stops])
    ang=np.arctan2(dy,dx); out+=((np.sin(ang*16)>0.55)*np.clip(1-r*1.1,0,1)*40)[...,None]
    return Image.fromarray(np.clip(out,0,255).astype('uint8')).convert('RGBA')
def pill(bg,center,size):
    f=ImageFont.truetype(F,size); t='YATHIN LOOOPS'; tw=ImageDraw.Draw(bg).textlength(t,font=f)
    W=int(tw+size*1.4); H=int(size*1.9); L=Image.new('RGBA',(W+10,H+12),(0,0,0,0)); d=ImageDraw.Draw(L)
    d.rounded_rectangle([8,12,W+8,H+10],H//2,fill=(0,0,0,130)); d.rounded_rectangle([0,0,W,H],H//2,fill='white',outline=INK,width=6)
    d.text(((W-tw)/2,(H-size*1.25)/2-2),t,font=f,fill=INK); paste_rot(bg,L,center,0)
Y=(255,230,40)
# wide
bg=bg2(1280,720,960,380); d=ImageDraw.Draw(bg)
icon(bg,YI,300,(960,330),-6,(255,200,240)); ring(bg,(960,330),215,13)
emoji(bg,'1f3f0',190,(1150,560),8); emoji(bg,'1f3ae',130,(760,575),-10); emoji(bg,'2728',80,(1180,120),0)
f1=ImageFont.truetype(F,120); f2=ImageFont.truetype(F,128)
text(d,(46,60),'FREE AI.',f1,'white',11); text(d,(40,215),'NO KEY?!',f2,Y,12)
sticker(bg,'NO DOWNLOAD',(250,470),50,-5); sticker(bg,'Builds 3D castles',(300,585),40,3,fill=(255,255,255),fg=INK)
arrow(bg,curve((560,430),(640,330),(740,320))); pill(bg,(1080,40),26)
bg.convert('RGB').save('thumbnails/yathinai-thumbnail.jpg',quality=93)
# square
bg=bg2(1080,1080,540,700); d=ImageDraw.Draw(bg)
f1=ImageFont.truetype(F,130); f2=ImageFont.truetype(F,150)
for y,t,f,c in [(60,'FREE AI.',f1,'white'),(210,'NO KEY?!',f2,Y)]:
    tw=d.textlength(t,font=f); text(d,((1080-tw)/2,y),t,f,c,12)
icon(bg,YI,330,(540,690),-5,(255,200,240)); ring(bg,(540,690),230,13)
emoji(bg,'1f3f0',200,(860,880),8); emoji(bg,'1f3ae',140,(200,880),-10)
sticker(bg,'NO DOWNLOAD',(540,990),52,-3); pill(bg,(540,440),34)
bg.convert('RGB').save('thumbnails/yathinai-thumbnail-square.jpg',quality=93)
# vertical
bg=bg2(1080,1920,540,1250); d=ImageDraw.Draw(bg)
fa=ImageFont.truetype(F,190); fb=ImageFont.truetype(F,200)
for y,t,f,c in [(220,'FREE AI.',fa,'white'),(470,'NO KEY?!',fb,Y)]:
    tw=d.textlength(t,font=f); text(d,((1080-tw)/2,y),t,f,c,15)
pill(bg,(540,100),56); sticker(bg,'NO DOWNLOAD',(540,820),72,-4)
icon(bg,YI,420,(540,1250),-5,(255,200,240)); ring(bg,(540,1250),290,15)
emoji(bg,'1f3f0',260,(830,1600),8); emoji(bg,'1f3ae',190,(230,1610),-10)
sticker(bg,'Builds 3D castles',(540,1830),58,0,fill=(255,255,255),fg=INK)
bg.convert('RGB').save('thumbnails/yathinai-thumbnail-vertical.jpg',quality=93)
