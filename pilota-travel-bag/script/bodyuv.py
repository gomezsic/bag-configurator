import numpy as np, json
from PIL import Image, ImageFilter
fab=np.array(Image.open('fabric710.png'))[:,:,3].astype(np.float32)/255
hm=np.array(Image.open('a_masks.png'))[:,:,0].astype(np.float32)/255
H,W=fab.shape
def cr(P,n=400):
    P=np.array(P,float);Q=np.vstack([P[0]*2-P[1],P,P[-1]*2-P[-2]]);out=[]
    for i in range(1,len(Q)-2):
        p0,p1,p2,p3=Q[i-1],Q[i],Q[i+1],Q[i+2]
        for t in np.linspace(0,1,50,endpoint=False):
            out.append(0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3))
    out.append(P[-1]);out=np.array(out)
    d=np.r_[0,np.cumsum(np.linalg.norm(np.diff(out,axis=0),axis=1))];s=np.linspace(0,d[-1],n)
    return np.c_[np.interp(s,d,out[:,0]),np.interp(s,d,out[:,1])]
# boundary curves (image px), t: bottom->top, s: left->right
Lc=cr([(345,958),(338,880),(325,780),(305,670),(275,590),(236,548)])
Rc=cr([(986,824),(997,750),(1000,660),(990,570),(962,500),(926,470)])
Bc=cr([(345,958),(500,930),(650,898),(800,866),(986,824)])
Tc=cr([(236,548),(400,530),(560,512),(740,490),(926,470)])
n=Lc.shape[0]
S,T=1400,1000
s=np.linspace(-0.06,1.06,S)[None,:,None];t=np.linspace(-0.3,1.08,T)[:,None,None]
idx_s=np.round(np.clip(np.linspace(-0.06,1.06,S),0,1)*(n-1)).astype(int);idx_t=np.round(np.clip(np.linspace(-0.3,1.08,T),0,1)*(n-1)).astype(int)
tl=np.linspace(-0.3,1.08,T);sl=np.linspace(-0.06,1.06,S)
def ext(C,par,idx):
    out=C[idx].copy();d0=(C[1]-C[0])*(n-1);d1=(C[-1]-C[-2])*(n-1)
    lo=par<0;hi=par>1
    out[lo]=C[0]+d0*par[lo][:,None];out[hi]=C[-1]+d1*(par[hi]-1)[:,None];return out
L=ext(Lc,tl,idx_t)[:,None,:];R=ext(Rc,tl,idx_t)[:,None,:];B=ext(Bc,sl,idx_s)[None,:,:];Tp=ext(Tc,sl,idx_s)[None,:,:]
P00,P10,P01,P11=Lc[0],Rc[0],Lc[-1],Rc[-1]
P=(1-s)*L+s*R+(1-t)*B+t*Tp-((1-s)*(1-t)*P00+s*(1-t)*P10+(1-s)*t*P01+s*t*P11)
xs=np.round(P[...,0]).astype(int);ys=np.round(P[...,1]).astype(int)
ok=(xs>=0)&(xs<W)&(ys>=0)&(ys<H)
SS=np.broadcast_to(s[...,0],(T,S));TT=np.broadcast_to(t[...,0],(T,S))
su=np.full((H,W),np.nan);tv=np.full((H,W),np.nan)
su[ys[ok],xs[ok]]=SS[ok];tv[ys[ok],xs[ok]]=TT[ok]
# fill small holes / extend beyond boundary by nearest (iterative dilation)
def fill(a,iters=40):
    a=a.copy()
    for _ in range(iters):
        m=np.isnan(a)
        if not m.any():break
        acc=np.zeros_like(a);cnt=np.zeros_like(a)
        for dy,dx in [(-1,0),(1,0),(0,-1),(0,1)]:
            sh=np.roll(np.roll(a,dy,0),dx,1);v=~np.isnan(sh);acc[v&m]+=sh[v&m];cnt[v&m]+=1
        a[m&(cnt>0)]=acc[m&(cnt>0)]/cnt[m&(cnt>0)]
    return a
# cap region: left of seam curve
yy,xx=np.mgrid[0:H,0:W]
seamx=np.interp(yy,Lc[::-1,1],Lc[::-1,0],left=Lc[-1,0],right=Lc[0,0])
cap=(xx<seamx)&(fab>0.01)
wrap=(fab>0.01)&~cap
su=fill(su);tv=fill(tv)
su=np.where(np.isnan(su),0,su);tv=np.where(np.isnan(tv),0.5,tv)
lo,hi=np.sin(np.radians(-62)),np.sin(np.radians(80))
tc=np.clip(tv,0,1);phi=np.arcsin(np.clip(lo+(hi-lo)*tc,-1,1))
k0=(hi-lo)/np.cos(np.radians(-62));k1=(hi-lo)/np.cos(np.radians(80))
phi=np.where(tv<0,np.radians(-62)+tv*k0,np.where(tv>1,np.radians(80)+(tv-1)*k1,phi))
Rpx=205.;Lpx=720.
U=su*Lpx; V=(phi+np.pi/2)*Rpx*1.25
# shading for wrap: light from upper front, falloff at silhouettes, darker near seams
phiL=np.radians(28)
shw=0.50+0.55*np.clip(np.cos(phi-phiL),0,1)**0.8
shw*=1-0.18*np.exp(-(su/0.035)**2)-0.12*np.exp(-((1-su)/0.05)**2)
# cap ellipse
c=np.array([243.,752.]);ax=np.array([np.sin(np.radians(4)),np.cos(np.radians(4))]);ay=np.array([ax[1],-ax[0]])
a_,b_=100.,208.
dx=xx-c[0];dy=yy-c[1]
ex=(dx*ay[0]+dy*ay[1])/a_;ey=(dx*ax[0]+dy*ax[1])/b_
r=np.sqrt(ex**2+ey**2)
Uc=ex*Rpx+3000;Vc=ey*Rpx+3000   # cut on a different grain: rotate 90 deg vs wrap
shc=(0.74+0.20*np.sqrt(np.clip(1-r**2,0,1)))*(0.95-0.12*ey)
U=np.where(cap,Uc,U);V=np.where(cap,Vc,V);SH=np.where(cap,shc,shw)
# handle contact shadow on body
hb=Image.fromarray((hm*255).astype(np.uint8)).transform((W,H),Image.AFFINE,(1,0,-4,0,1,-7)).filter(ImageFilter.GaussianBlur(7))
ao=np.clip(np.array(hb).astype(np.float32)/255*1.3-hm,0,1)
ui=np.clip(np.round(U*16),0,65535).astype(np.int64);vi=np.clip(np.round(V*16),0,65535).astype(np.int64)
m=fab>0.01
A=np.zeros((H,W,3),np.uint8);Bimg=np.zeros((H,W,3),np.uint8)
A[...,0]=np.where(m,ui>>8,0);A[...,1]=np.where(m,ui&255,0);A[...,2]=np.round(ao*255)
Bimg[...,0]=np.where(m,vi>>8,0);Bimg[...,1]=np.where(m,vi&255,0);Bimg[...,2]=np.where(m,np.clip(SH*160,0,255),0)
Image.fromarray(A).save('a_bodyA.png',optimize=True);Image.fromarray(Bimg).save('a_bodyB.png',optimize=True)
# debug
vis=np.zeros((H,W,3),np.uint8)
gu=(np.floor(U/40)%2);gv=(np.floor(V/40)%2)
vis[...,0]=np.where(m,(gu*160+60)*SH,0).clip(0,255);vis[...,1]=np.where(m,(gv*160+60)*SH,0).clip(0,255);vis[...,2]=np.where(cap,200,0)
Image.fromarray(vis).save('body_debug.png')
print('cap px',cap.sum(),'wrap px',wrap.sum())
