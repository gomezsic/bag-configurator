import numpy as np
from PIL import Image, ImageFilter
base=Image.open('neutra.png').convert('RGB'); base.save('a_base.jpg',quality=90)
B=np.array(base).astype(np.float32)
L=B.mean(2)
uv=np.array(Image.open('handles_uv.png'))
hA=np.array(Image.open('handle39.png'))[:,:,3]
w=np.array(Image.open('handles_w.png')).astype(np.float32)
fab=np.array(Image.open('fabric710.png'));zip_=np.array(Image.open('zip.png'))
# drop stray low-alpha pixels far from strap center
u=uv[:,:,0]/255.;far=(np.abs(u-0.5)>0.62)
h=hA.copy();h[(hA<200)&(uv[:,:,0]==0)]=0
masks=np.dstack([h,fab[:,:,3],zip_[:,:,3]]).astype(np.uint8)
Image.fromarray(masks).save('a_masks.png',optimize=True)
Image.fromarray(uv[:,:,:3]).save('a_uv.png',optimize=True)
# reference luminances
print('handle L p90',np.percentile(L[hA>250],90),'body L median',np.median(L[fab[:,:,3]>250]),'zip L p90',np.percentile(L[zip_[:,:,3]>200],90))
# fabric tile from layer 710: crop and flatten
F=fab[:,:,:3].astype(np.float32)
x0,y0=600,610;S=192
crop=F[y0:y0+S,x0:x0+S]
print('crop alpha min',fab[y0:y0+S,x0:x0+S,3].min())
lum=crop.mean(2)
blur=np.array(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.GaussianBlur(24))).astype(np.float32)
det=lum/(blur+1)  # ~1 mean
# seamless: blend with half-rolled copy using radial-ish weight
r=np.roll(np.roll(det,S//2,0),S//2,1)
yy,xx=np.mgrid[0:S,0:S]/(S-1)
wgt=np.minimum(np.minimum(xx,1-xx),np.minimum(yy,1-yy))*2  # 0 at edges,1 center
wgt=np.clip(wgt*2.2,0,1)
tile=det*wgt+r*(1-wgt)
tile=(tile-tile.mean())/tile.std()
img=np.clip(128+tile*40,0,255).astype(np.uint8)
Image.fromarray(img).save('a_tile.png',optimize=True)
print('mean color 710',crop.reshape(-1,3).mean(0).round())
