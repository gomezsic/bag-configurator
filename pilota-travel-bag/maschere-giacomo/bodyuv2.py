# UV del corpo dalle maschere di Giacomo: fronte = avvolgimento cilindrico, sopra = pannello a parte, fianco = testata ellittica
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
def mask(f):
    a=np.array(Image.open(f).convert('RGBA'))[...,3].astype(np.float32)/255
    # togli le macchie: pezzi minuscoli o che toccano il bordo dell'immagine
    lab,n=ndimage.label(a>0.05);keep=np.zeros(a.shape,bool);h,w=a.shape
    for i,sl in enumerate(ndimage.find_objects(lab),1):
        r=lab[sl]==i;sz=r.sum();edge=sl[0].start==0 or sl[1].start==0 or sl[0].stop==h or sl[1].stop==w
        if sz>300 and not edge:keep[sl]|=r
    return a*keep
fr,so,fi=mask('fronte.png'),mask('sopra.png'),mask('fianco.png')
H,W=fr.shape
hm=np.array(Image.open('a_masks.png'))[:,:,0].astype(np.float32)/255
def cr(P,n=400):
    P=np.array(P,float);Q=np.vstack([P[0]*2-P[1],P,P[-1]*2-P[-2]]);out=[]
    for i in range(1,len(Q)-2):
        p0,p1,p2,p3=Q[i-1],Q[i],Q[i+1],Q[i+2]
        for t in np.linspace(0,1,50,endpoint=False):
            out.append(0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3))
    out.append(P[-1]);out=np.array(out)
    d=np.r_[0,np.cumsum(np.linalg.norm(np.diff(out,axis=0),axis=1))];s=np.linspace(0,d[-1],n)
    return np.c_[np.interp(s,d,out[:,0]),np.interp(s,d,out[:,1])]
# bordi del pezzo frontale letti dalla maschera: sinistra = cucitura col fianco, destra = profilo
ys,xs=np.nonzero(fr>0.5)
def edge_pts(side,y0,y1,k=7):
    pts=[]
    for y in np.linspace(y0,y1,k):
        row=np.nonzero(fr[int(y)]>0.5)[0]
        if len(row):pts.append((row.min() if side=='L' else row.max(),y))
    return pts[::-1]
yb=ys.max();yt=ys.min()
Lc=cr([(345,958),(338,880),(325,780),(305,670),(275,590),(236,548)])
Rc=cr([(986,824),(997,750),(1000,660),(990,570),(962,500),(926,470)])
Bc=cr([(345,958),(500,930),(650,898),(800,866),(986,824)])
Tc=cr([(236,548),(400,530),(560,512),(740,490),(926,470)])
n=Lc.shape[0];S,T=1400,1000
sl=np.linspace(-0.06,1.06,S);tl=np.linspace(-0.3,1.08,T)
s=sl[None,:,None];t=tl[:,None,None]
idx_s=np.round(np.clip(sl,0,1)*(n-1)).astype(int);idx_t=np.round(np.clip(tl,0,1)*(n-1)).astype(int)
def ext(C,par,idx):
    out=C[idx].copy();d0=(C[1]-C[0])*(n-1);d1=(C[-1]-C[-2])*(n-1);lo=par<0;hi=par>1
    out[lo]=C[0]+d0*par[lo][:,None];out[hi]=C[-1]+d1*(par[hi]-1)[:,None];return out
L=ext(Lc,tl,idx_t)[:,None,:];R=ext(Rc,tl,idx_t)[:,None,:];B=ext(Bc,sl,idx_s)[None,:,:];Tp=ext(Tc,sl,idx_s)[None,:,:]
P=(1-s)*L+s*R+(1-t)*B+t*Tp-((1-s)*(1-t)*Lc[0]+s*(1-t)*Rc[0]+(1-s)*t*Lc[-1]+s*t*Rc[-1])
xi=np.round(P[...,0]).astype(int);yi=np.round(P[...,1]).astype(int);ok=(xi>=0)&(xi<W)&(yi>=0)&(yi<H)
su=np.full((H,W),np.nan);tv=np.full((H,W),np.nan)
su[yi[ok],xi[ok]]=np.broadcast_to(s[...,0],(T,S))[ok];tv[yi[ok],xi[ok]]=np.broadcast_to(t[...,0],(T,S))[ok]
def fill(a,it=60):
    a=a.copy()
    for _ in range(it):
        m=np.isnan(a)
        if not m.any():break
        acc=np.zeros_like(a);cnt=np.zeros_like(a)
        for dy,dx in [(-1,0),(1,0),(0,-1),(0,1)]:
            sh=np.roll(np.roll(a,dy,0),dx,1);v=~np.isnan(sh);acc[v&m]+=sh[v&m];cnt[v&m]+=1
        a[m&(cnt>0)]=acc[m&(cnt>0)]/cnt[m&(cnt>0)]
    return np.nan_to_num(a,nan=0.5)
su=fill(su);tv=fill(tv)
lo,hi=np.sin(np.radians(-62)),np.sin(np.radians(80))
tc=np.clip(tv,0,1);phi=np.arcsin(np.clip(lo+(hi-lo)*tc,-1,1))
k0=(hi-lo)/np.cos(np.radians(-62));k1=(hi-lo)/np.cos(np.radians(80))
phi=np.where(tv<0,np.radians(-62)+tv*k0,np.where(tv>1,np.radians(80)+(tv-1)*k1,phi))
Rpx=205.;Lpx=720.
U=su*Lpx;V=(phi+np.pi/2)*Rpx*1.25
phiL=np.radians(28)
shw=0.50+0.55*np.clip(np.cos(phi-phiL),0,1)**0.8
shw*=1-0.10*np.exp(-(su/0.03)**2)-0.10*np.exp(-((1-su)/0.05)**2)
# pannello sopra: stessa direzione del fronte ma tagliato a parte (fase diversa) e un po' più in ombra verso la zip
Us=U+137.;Vs=V+211.;shs=shw*0.97
# fianco: testata ellittica dalla maschera (momenti), grana ruotata di 90°
yy,xx=np.mgrid[0:H,0:W]
w=fi;cy,cx=(w*yy).sum()/w.sum(),(w*xx).sum()/w.sum()
cov=np.cov(np.vstack([xx[w>0.5]-cx,yy[w>0.5]-cy]));ev,evec=np.linalg.eigh(cov)
ax_major=evec[:,1];ax_minor=evec[:,0];a_=2*np.sqrt(ev[0]);b_=2*np.sqrt(ev[1])
dx=xx-cx;dy=yy-cy
ex=(dx*ax_minor[0]+dy*ax_minor[1])/a_;ey=(dx*ax_major[0]+dy*ax_major[1])/b_
if ax_major[1]<0:ey=-ey
r=np.sqrt(ex**2+ey**2)
# fianco: disco di raggio reale uguale al corpo (Rpx), stessa scala del fronte (1,25 unità per pixel di raggio), trama girata di 90°
shc=(0.74+0.20*np.sqrt(np.clip(1-r**2,0,1)))*(0.95-0.12*ey)
print('fianco centro',round(cx),round(cy),'semiassi',round(a_),round(b_))
Uc=ey*Rpx*1.25+3000;Vc=ex*Rpx*1.25+3000
body=np.clip(np.maximum(np.maximum(fr,so),fi),0,1)
# chiudi le fessure di 1-3 px tra un pezzo e l'altro
closed=ndimage.grey_closing(body,size=(7,7))
gap=(closed>0.5)&(body<0.5)&(ndimage.distance_transform_edt(body<0.5)<=4)
body=np.where(gap,closed,body)
near_fi=ndimage.distance_transform_edt(fi<0.5)<=4
fi=np.where(gap&near_fi&(ndimage.distance_transform_edt(fr<0.5)>ndimage.distance_transform_edt(fi<0.5)),1.0,fi)
#
U2=np.where(fi>0.5,Uc,np.where(so>0.5,Us,U));V2=np.where(fi>0.5,Vc,np.where(so>0.5,Vs,V));SH=np.where(fi>0.5,shc,np.where(so>0.5,shs,shw))
hb=Image.fromarray((hm*255).astype(np.uint8)).transform((W,H),Image.AFFINE,(1,0,-4,0,1,-7)).filter(ImageFilter.GaussianBlur(7))
ao=np.clip(np.array(hb).astype(np.float32)/255*1.3-hm,0,1)
# ombra di contatto lungo le cuciture tra i pezzi
seam=np.zeros_like(body)
for a,b in [(fr,fi),(fr,so)]:
    da=ndimage.distance_transform_edt(a<0.5);db=ndimage.distance_transform_edt(b<0.5)
    seam=np.maximum(seam,np.exp(-(np.minimum(da,db)/3.0)**2)*(body>0.5))
ao=np.clip(ao+0.35*seam,0,1)
ui=np.clip(np.round(U2*16),0,65535).astype(np.int64);vi=np.clip(np.round(V2*16),0,65535).astype(np.int64)
m=body>0.01
A=np.zeros((H,W,3),np.uint8);Bm=np.zeros((H,W,3),np.uint8)
A[...,0]=np.where(m,ui>>8,0);A[...,1]=np.where(m,ui&255,0);A[...,2]=np.round(ao*255)
Bm[...,0]=np.where(m,vi>>8,0);Bm[...,1]=np.where(m,vi&255,0);Bm[...,2]=np.where(m,np.clip(SH*160,0,255),0)
Image.fromarray(A).save('b_bodyA.png',optimize=True);Image.fromarray(Bm).save('b_bodyB.png',optimize=True)
mk=np.array(Image.open('a_masks.png'));mk[...,1]=np.round(body*255).astype(np.uint8)
Image.fromarray(mk).save('b_masks.png',optimize=True)
vis=np.zeros((H,W,3),np.uint8);gu=np.floor(U2/40)%2;gv=np.floor(V2/40)%2
vis[...,0]=np.where(m,(gu*160+60)*SH,255).clip(0,255);vis[...,1]=np.where(m,(gv*160+60)*SH,255).clip(0,255);vis[...,2]=np.where(fi>0.5,200,np.where(so>0.5,120,np.where(m,0,255)))
Image.fromarray(vis).save('b_debug.png')
# ---- pezzi per l'editor del tessuto: id per pixel + punto e jacobiano UV al centro di ogni pezzo
import json
pid=np.zeros((H,W),np.uint8)
pid[(fr>0.5)|((body>0.5))]=1
pid[so>0.5]=2
pid[fi>0.5]=3
pid[body<=0.01]=0
Image.fromarray(np.dstack([pid*60,pid*60,pid*60]).astype(np.uint8)).save('b_pieces.png',optimize=True)
info={}
for k,(i,lab) in {'fronte':(1,'Corpo davanti'),'sopra':(2,'Fascia sopra'),'fianco':(3,'Fianco')}.items():
    mm=pid==i;ys,xs=np.nonzero(mm)
    # punto interno vicino al baricentro
    cy,cx=ys.mean(),xs.mean();d=(ys-cy)**2+(xs-cx)**2;j=np.argmin(d+np.where(ndimage.distance_transform_edt(mm)[ys,xs]<6,1e9,0));y,x=int(ys[j]),int(xs[j])
    r=4;J=np.array([[(U2[y,x+r]-U2[y,x-r])/(2*r),(U2[y+r,x]-U2[y-r,x])/(2*r)],[(V2[y,x+r]-V2[y,x-r])/(2*r),(V2[y+r,x]-V2[y-r,x])/(2*r)]])
    info[k]={'id':i,'nome':lab,'x':x,'y':y,'J':J.round(4).tolist()}
json.dump(info,open('b_pieces.json','w'))
print(info)
