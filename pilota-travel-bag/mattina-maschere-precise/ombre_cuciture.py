# Ombre in più sopra la resa di stamattina: cuciture tra i pezzi (AO) e rotondità verso il contorno (chiaroscuro).
import numpy as np
from PIL import Image
from scipy import ndimage
A=np.array(Image.open('c_bodyA.png').convert('RGB')).astype(float);B=np.array(Image.open('c_bodyB.png').convert('RGB')).astype(float)
M=np.array(Image.open('c_masks.png').convert('RGB'));body=M[...,1]>127
P=np.array(Image.open('b_pieces.png').convert('L'))//60
# cuciture: dove due pezzi diversi si toccano
seam=np.zeros(P.shape,bool)
for a in (1,2,3):
    for b in (1,2,3):
        if a<b: seam|=ndimage.binary_dilation(P==a,iterations=2)&ndimage.binary_dilation(P==b,iterations=2)
ds=ndimage.distance_transform_edt(~seam)
ao_seam=0.95*np.exp(-(ds/4.0)**2)+0.40*np.exp(-(ds/18.0))   # riga scura stretta + alone morbido
# rotondità: il tessuto gira via verso il contorno della borsa
de=ndimage.distance_transform_edt(body)
t=np.clip(de/90.0,0,1);round_=0.55+0.45*(1-(1-t)**2.2)
# ombre portate di manici e anelli sul corpo: sagoma spostata in basso a destra e sfumata
base=np.array(Image.open('a_base.jpg').convert('RGB')).astype(float)/255;Lb=base.mean(2)
hand=M[...,0]>100
near=ndimage.distance_transform_edt(~body)<25
metal=(~body)&(~hand)&near&(Lb<0.72)
metal=ndimage.binary_opening(metal,iterations=1)
def cast(src,dx,dy,blur,k):
    s=np.roll(np.roll(src.astype(float),dy,0),dx,1)
    return k*ndimage.gaussian_filter(s,blur)
ao_cast=cast(hand,6,7,5.0,1.3)+cast(hand,2,2,1.5,0.7)+cast(metal,4,7,3.0,1.6)+cast(metal,1,2,1.0,0.8)
# sotto il manico disegnato restava la fettuccia bianca della foto: lì metto il tessuto (il manico disegnato va sopra)
closed=ndimage.binary_closing(body,structure=np.ones((1,61),bool))&ndimage.binary_closing(body,structure=np.ones((61,1),bool))
under=hand&closed&~body

body2=body
src=hand&~under  # il manico vero che proietta ombra: lo stimo restringendo la zona manico
ao_cast=np.clip(ao_cast,0,1.0)*body2
ao=np.clip(A[...,2]/255+ao_seam*body+ao_cast,0,1)
syn=np.clip(B[...,2]*round_,0,255)
A[...,2]=ao*255;B[...,2]=syn
Image.fromarray(A.astype(np.uint8)).save('d_bodyA.png',optimize=True);Image.fromarray(B.astype(np.uint8)).save('d_bodyB.png',optimize=True)
