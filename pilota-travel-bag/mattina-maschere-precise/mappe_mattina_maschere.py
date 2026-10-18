# Resa del pilota di stamattina (UV e ombre di a_bodyA/B) ritagliata con le maschere precise di Giacomo,
# più la mappa dei pezzi per l'editor del verso del tessuto.
import numpy as np,json
from PIL import Image
from scipy import ndimage
A=np.array(Image.open('mattina/a_bodyA.png').convert('RGB'));B=np.array(Image.open('mattina/a_bodyB.png').convert('RGB'))
M0=np.array(Image.open('mattina/a_masks.png').convert('RGB'));Mg=np.array(Image.open('b_masks.png').convert('RGB'))
P=np.array(Image.open('b_pieces.png').convert('L'))//60
old=M0[...,1]>127;new=Mg[...,1]>0
# dove la maschera nuova esce da quella vecchia, prendo l'UV e l'ombra del pixel vecchio più vicino
idx=ndimage.distance_transform_edt(~old,return_distances=False,return_indices=True)
A2=A[idx[0],idx[1]];B2=B[idx[0],idx[1]]
# sotto i manici la maschera precisa lascia fessure bianche: lì tengo il corpo di stamattina, ma non sul contorno esterno della borsa
bg=ndimage.binary_propagation(np.pad(np.zeros((old.shape[0]-2,old.shape[1]-2),bool),1,constant_values=True),mask=~(old|new))
extra=old&~new&(ndimage.distance_transform_edt(~bg)>10)
M=M0.copy();M[...,1]=np.maximum(Mg[...,1],extra*255)
Image.fromarray(A2).save('c_bodyA.png',optimize=True);Image.fromarray(B2).save('c_bodyB.png',optimize=True);Image.fromarray(M).save('c_masks.png',optimize=True)
U=(A2[...,0].astype(float)*256+A2[...,1])/16;V=(B2[...,0].astype(float)*256+B2[...,1])/16
info={}
for k,(i,lab) in {'fronte':(1,'Corpo davanti'),'sopra':(2,'Fascia sopra'),'fianco':(3,'Fianco')}.items():
    mm=P==i;ys,xs=np.nonzero(mm);cy,cx=ys.mean(),xs.mean()
    j=np.argmin((ys-cy)**2+(xs-cx)**2+np.where(ndimage.distance_transform_edt(mm)[ys,xs]<6,1e9,0));y,x=int(ys[j]),int(xs[j]);r=4
    J=[[(U[y,x+r]-U[y,x-r])/(2*r),(U[y+r,x]-U[y-r,x])/(2*r)],[(V[y,x+r]-V[y,x-r])/(2*r),(V[y+r,x]-V[y-r,x])/(2*r)]]
    info[k]={'id':i,'nome':lab,'x':x,'y':y,'J':np.round(J,4).tolist()}
json.dump(info,open('c_pieces.json','w'));print(info,'aggiunti',(new&~old).sum(),'tolti',(old&~new).sum())
