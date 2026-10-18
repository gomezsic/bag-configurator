import base64
t=open('template.html').read()
def du(f,m): return 'data:'+m+';base64,'+base64.b64encode(open(f,'rb').read()).decode()
for k,f,m in [('BASE','a_base.jpg','image/jpeg'),('UV','a_uv.png','image/png'),('MASKS','a_masks.png','image/png'),('TILE','a_tile256.png','image/png'),('ORIG','a_orig39.png','image/png'),('BODYA','a_bodyA.png','image/png'),('BODYB','a_bodyB.png','image/png'),('NEO','neo_tile512.png','image/png')]:
    t=t.replace('__'+k+'__',du(f,m))
open('out/travel-bag-pilota.html','w').write(t);print(len(t))
