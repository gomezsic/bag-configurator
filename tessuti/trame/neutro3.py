# Trama neutra Tramè dal campione Beige: luminanza, luce appiattita, poi resa ripetibile
# con la scomposizione "periodica + liscia" (Moisan) e una cucitura stretta, senza doppie immagini.
import numpy as np
from PIL import Image
from scipy import ndimage
c=np.array(Image.open('crop_Beige.png').convert('RGB')).astype(float)/255
L=c@np.array([.299,.587,.114]);flat=L/ndimage.gaussian_filter(L,35)
S=min(flat.shape);u=flat[:S,:S]
def periodic(u):
    M,N=u.shape;v=np.zeros_like(u)
    v[0,:]+=u[-1,:]-u[0,:];v[-1,:]+=u[0,:]-u[-1,:];v[:,0]+=u[:,-1]-u[:,0];v[:,-1]+=u[:,0]-u[:,-1]
    q=np.arange(M)[:,None];r=np.arange(N)[None,:]
    den=2*np.cos(2*np.pi*q/M)+2*np.cos(2*np.pi*r/N)-4;den[0,0]=1
    s=np.real(np.fft.ifft2(np.fft.fft2(v)/den));s-=s.mean()
    return u-s
p=periodic(u)
# cucitura: sfuma 14 px tra il bordo e la copia spostata di mezzo tile solo vicino ai bordi
k=14;sh=np.roll(np.roll(p,S//2,0),S//2,1)
yy,xx=np.mgrid[0:S,0:S];d=np.minimum(np.minimum(yy,S-1-yy),np.minimum(xx,S-1-xx));w=np.clip(d/k,0,1)
t=w*p+(1-w)*sh
t=t/t.mean()*0.64
im=Image.fromarray(np.clip(t*255,0,255).astype(np.uint8)).resize((512,512),Image.LANCZOS);im.save('trame_neutro_512.png')
Image.fromarray(np.tile(np.array(im),(2,2))).save('prova_ripetizione.png')
