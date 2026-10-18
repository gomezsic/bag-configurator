# Ombre e cuciture prese dalla foto neutra: luminanza della foto, contrastata ("sovrasaturata") e moltiplicata sul tessuto.
# Niente cuciture disegnate a mano. Restano le ombre portate di manici e anelli.
import numpy as np
from PIL import Image
from scipy import ndimage
A=np.array(Image.open('c_bodyA.png').convert('RGB')).astype(float);B=np.array(Image.open('c_bodyB.png').convert('RGB')).astype(float)
M=np.array(Image.open('c_masks.png').convert('RGB'));body=M[...,1]>127;hand=M[...,0]>100
base=np.array(Image.open('a_base.jpg').convert('RGB')).astype(float)/255;Lb=base.mean(2)
# dettaglio della foto (cuciture, pieghe): rapporto tra la foto e la sua versione sfocata, solo dentro il corpo
w=ndimage.gaussian_filter(body.astype(float),12)+1e-4
Lblur=ndimage.gaussian_filter(np.where(body,Lb,0),12)/w
det=np.clip(Lb/np.maximum(Lblur,1e-3),0.4,1.6)
GAIN=float(__import__('os').environ.get('GAIN','1.8'))
detail=np.clip(det**GAIN,0.35,1.5)
# ombre portate di manici e anelli
near=ndimage.distance_transform_edt(~body)<25
metal=ndimage.binary_opening((~body)&(~hand)&near&(Lb<0.72),iterations=1)
def cast(src,dx,dy,blur,k): return k*ndimage.gaussian_filter(np.roll(np.roll(src.astype(float),dy,0),dx,1),blur)
ao_cast=np.clip(cast(hand,5,6,4.5,1.0)+cast(hand,2,2,1.5,0.5)+cast(metal,4,7,3.0,1.3)+cast(metal,1,2,1.0,0.6),0,1)*body
A[...,2]=np.clip(A[...,2]/255+ao_cast,0,1)*255
B[...,2]=np.clip(B[...,2]*np.where(body,detail,1),0,255)
Image.fromarray(A.astype(np.uint8)).save('e_bodyA.png',optimize=True);Image.fromarray(B.astype(np.uint8)).save('e_bodyB.png',optimize=True)
