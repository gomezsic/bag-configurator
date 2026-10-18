import numpy as np,json,sys
from PIL import Image
from scipy import ndimage
src=np.array(Image.open('src.jpg').convert('RGB')).astype(float)/255
boxes={'Ciliegia':(80,270,560,750),'Avio':(650,270,1130,750),'Militare':(80,890,560,1370),'Beige':(650,890,1130,1370)}
m=45;crops={k:src[y0+m:y1-m,x0+m:x1-m] for k,(x0,y0,x1,y1) in boxes.items()}
for k,c in crops.items(): Image.fromarray((c*255).astype(np.uint8)).save('crop_'+k+'.png')
# neutra: luminanza del beige (il più chiaro, si legge meglio la trama), luce appiattita
c=crops['Beige'];L=c@np.array([.299,.587,.114])
flat=L/ndimage.gaussian_filter(L,35)
# periodo della trama dall'autocorrelazione, per un ritaglio che si ripete pulito
f=flat-flat.mean();F=np.fft.fft2(f);ac=np.real(np.fft.ifft2(F*np.conj(F)));ac/=ac[0,0]
H,W=flat.shape
def best(axis):
    prof=ac[:,0] if axis==0 else ac[0,:];n=len(prof)//2
    cand=[(prof[i],i) for i in range(40,n) if prof[i]>=prof[i-1] and prof[i]>=prof[i+1]]
    return max(cand)[1] if cand else n
# cerca il miglior spostamento 2D (la trama è diagonale): picchi dell'autocorrelazione
acs=np.fft.fftshift(ac);cy,cx=H//2,W//2
print('periodi',best(0),best(1))
# ritaglio quadrato e bordi resi continui con dissolvenza su metà spostata
S=min(H,W)-2;S=S-S%2;t=flat[:S,:S]
sh=np.roll(np.roll(t,S//2,0),S//2,1)
yy,xx=np.mgrid[0:S,0:S]/S;w=np.minimum(np.minimum(yy,1-yy),np.minimum(xx,1-xx));w=np.clip(w/0.18,0,1)
tile=w*t+(1-w)*sh
tile=tile/tile.mean()*0.64
Image.fromarray(np.clip(tile*255,0,255).astype(np.uint8)).resize((512,512),Image.LANCZOS).save('trame_neutro_512.png')
# codici colore: colore = media campione × 0,64 / luminanza media della neutra (=0,64)
hexes={}
for k,c in crops.items():
    mean=c.reshape(-1,3).mean(0);hexes[k]='#'+''.join('%02x'%int(round(min(255,v*255))) for v in mean)
print(json.dumps(hexes))
json.dump(hexes,open('hex.json','w'))
# prova 2×2 per vedere le giunzioni
t2=np.array(Image.open('trame_neutro_512.png'));Image.fromarray(np.tile(t2,(2,2))).save('prova_ripetizione.png')
