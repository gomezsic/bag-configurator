import numpy as np, json
from PIL import Image
A=np.array(Image.open('handle39.png'))[:,:,3].astype(np.float32)/255.
H,W=A.shape
M=A>0.5
# rough centerlines (x,y), direction = from start to end
strands={
 'A':[(540,955),(545,850),(540,750),(530,650),(525,520),(523,400),(525,300),(535,235),(560,185),(600,155),(645,180),(690,235),(730,320),(765,420),(795,520),(825,620),(848,700),(862,780),(858,850),(835,885)],
 'B':[(385,530),(405,470),(430,400),(455,330),(485,265),(520,210),(560,170),(600,153),(632,175),(655,225),(663,290),(658,360),(652,430),(648,495)],
 'T':[(210,680),(198,730),(185,780),(175,830),(172,870)],
 'L':[(243,545),(262,565)],
 'R':[(885,462),(912,470)],
}
def resample(P,step=1.5):
    P=np.array(P,float)
    # catmull-rom
    pts=[]
    Q=np.vstack([P[0]*2-P[1],P,P[-1]*2-P[-2]])
    for i in range(1,len(Q)-2):
        p0,p1,p2,p3=Q[i-1],Q[i],Q[i+1],Q[i+2]
        for t in np.linspace(0,1,20,endpoint=False):
            t2,t3=t*t,t*t*t
            pts.append(0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3))
    pts.append(P[-1]);pts=np.array(pts)
    d=np.r_[0,np.cumsum(np.linalg.norm(np.diff(pts,axis=0),axis=1))]
    s=np.arange(0,d[-1],step)
    return np.c_[np.interp(s,d,pts[:,0]),np.interp(s,d,pts[:,1])]
def normals(C):
    T=np.gradient(C,axis=0);T/=np.linalg.norm(T,axis=1,keepdims=True)+1e-9
    return np.c_[-T[:,1],T[:,0]]
def inside(x,y):
    xi=np.clip(np.round(x).astype(int),0,W-1);yi=np.clip(np.round(y).astype(int),0,H-1)
    return M[yi,xi]
def smooth(a,k):
    k=max(1,int(k));ker=np.ones(2*k+1)/(2*k+1)
    pad=np.pad(a,((k,k),)+((0,0),)*(a.ndim-1),mode='edge')
    return np.apply_along_axis(lambda c:np.convolve(c,ker,'valid'),0,pad)
def refine(C,maxhw=34,iters=4):
    for it in range(iters):
        N=normals(C);ts=np.arange(0,maxhw,0.5)
        lo=np.full(len(C),np.nan);hi=np.full(len(C),np.nan)
        for i,(c,n) in enumerate(zip(C,N)):
            if not inside(*c):continue
            ins=inside(c[0]+n[0]*ts,c[1]+n[1]*ts);a=ts[np.argmin(ins)] if not ins.all() else np.nan
            ins2=inside(c[0]-n[0]*ts,c[1]-n[1]*ts);b=ts[np.argmin(ins2)] if not ins2.all() else np.nan
            hi[i]=a;lo[i]=b
        w=lo+hi;med=np.nanmedian(w)
        ok=(~np.isnan(w))&(w<med*1.35)&(w>med*0.45)
        off=np.where(ok,(hi-lo)/2,0.0)
        C=C+N*smooth(off,6)[:,None]*0.9
        C=resample(C[::4].tolist()+[C[-1].tolist()])
    N=normals(C);ts=np.arange(0,maxhw,0.25)
    lo=np.full(len(C),np.nan);hi=np.full(len(C),np.nan)
    for i,(c,n) in enumerate(zip(C,N)):
        if not inside(*c):continue
        a=inside(c[0]+n[0]*ts,c[1]+n[1]*ts);b=inside(c[0]-n[0]*ts,c[1]-n[1]*ts)
        if a.all() or b.all():continue
        hi[i]=ts[np.argmin(a)];lo[i]=ts[np.argmin(b)]
    w=lo+hi;med=np.nanmedian(w)
    # reject spans broken by hardware or crossings, using a local median
    loc=np.array([np.nanmedian(w[max(0,i-25):i+26]) for i in range(len(w))])
    bad=np.isnan(w)|(np.abs(w-loc)>0.12*loc)
    idx=np.arange(len(w))
    lo[bad]=np.interp(idx[bad],idx[~bad],lo[~bad]);hi[bad]=np.interp(idx[bad],idx[~bad],hi[~bad])
    return C,smooth(lo,2),smooth(hi,2)
cent={}
for k,P in strands.items():
    C=resample(P)
    if len(C)>20: C,lo,hi=refine(C)
    else:
        lo=np.full(len(C),15.);hi=np.full(len(C),15.)
    w=lo+hi
    s=np.r_[0,np.cumsum(np.linalg.norm(np.diff(C,axis=0),axis=1))]
    cent[k]=(C,w,s,lo);print(k,len(C),'len',round(s[-1]),'w med',round(float(np.median(w)),1))
# per-pixel assignment
ys,xs=np.nonzero(A>0.01)
P=np.c_[xs,ys].astype(np.float32)
allC=np.vstack([cent[k][0] for k in cent]).astype(np.float32)
allN=np.vstack([normals(cent[k][0]) for k in cent]).astype(np.float32)
allW=np.concatenate([cent[k][1] for k in cent]).astype(np.float32)
allS=np.concatenate([cent[k][2] for k in cent]).astype(np.float32)
allLo=np.concatenate([cent[k][3] for k in cent]).astype(np.float32)
allK=np.concatenate([np.full(len(cent[k][0]),i) for i,k in enumerate(cent)])
best=np.zeros(len(P),int)
for i in range(0,len(P),3000):
    d=((P[i:i+3000,None,:]-allC[None])**2).sum(-1);best[i:i+3000]=d.argmin(1)
D=P-allC[best];off=(D*allN[best]).sum(1)
u=np.clip((off+allLo[best])/allW[best],0,1)
v=allS[best]+0  # arc px
out=np.zeros((H,W,4),np.uint8)
out[ys,xs,0]=np.round(u*255)
vi=np.round(v*16).astype(np.int32)  # 1/16 px precision
out[ys,xs,1]=(vi>>8)&255;out[ys,xs,2]=vi&255
out[ys,xs,3]=np.round(A[ys,xs]*255)
# width channel stored separately: encode local width in a second image
Image.fromarray(out).save('handles_uv.png')
wimg=np.zeros((H,W),np.uint8);wimg[ys,xs]=np.clip(np.round(allW[best]),0,255);Image.fromarray(wimg).save('handles_w.png')
json.dump({k:{'pts':np.round(cent[k][0][::8],1).tolist()} for k in cent},open('centerlines.json','w'))
# debug viz
vis=np.zeros((H,W,3),np.uint8)
vis[ys,xs,0]=(u*255).astype(np.uint8);vis[ys,xs,1]=((np.floor(v/12)%2)*200).astype(np.uint8)
for k in cent:
    for c in cent[k][0][::2]:
        x,y=int(c[0]),int(c[1])
        if 0<=x<W and 0<=y<H: vis[y,x]=(255,255,0)
Image.fromarray(vis).save('uv_debug.png')
