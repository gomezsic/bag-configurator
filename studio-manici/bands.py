import sys,json
from PIL import Image
import numpy as np
res={}
for name,p in json.loads(sys.argv[1]).items():
    im=np.asarray(Image.open(p).convert('RGB')).astype(float)
    h,w,_=im.shape
    col=np.median(im[int(h*.2):int(h*.8)],axis=0)  # w x 3
    bands=[];start=0
    for x in range(1,w+1):
        if x==w or np.abs(col[x]-col[x-1]).max()>40:
            seg=col[start:x]
            if x-start>=2: bands.append([seg.mean(0),x-start])
            elif bands: bands[-1][1]+=x-start
            start=x
    # merge similar neighbours
    out=[]
    for c,n in bands:
        if out and np.abs(out[-1][0]-c).max()<30: 
            t=out[-1][1]+n; out[-1][0]=(out[-1][0]*out[-1][1]+c*n)/t; out[-1][1]=t
        else: out.append([c,n])
    res[name]={"w":w,"h":h,"bands":[['#%02x%02x%02x'%tuple(int(round(v)) for v in c),round(n/w*100,1)] for c,n in out]}
print(json.dumps(res,indent=1))
