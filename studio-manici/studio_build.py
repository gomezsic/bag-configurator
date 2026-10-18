import base64,json
t=open('studio_template.html').read()
def du(f,m): return 'data:'+m+';base64,'+base64.b64encode(open(f,'rb').read()).decode()
for k,f,m in [('BASE','a_base.jpg','image/jpeg'),('MASKS','a_masks.png','image/png'),('TILE','a_tile256.png','image/png'),('BODYA','a_bodyA.png','image/png'),('BODYB','a_bodyB.png','image/png'),('NEO','neo_tile512.png','image/png')]:
    t=t.replace('__'+k+'__',du(f,m))
t=t.replace('__SEED__',json.dumps(json.load(open('studio_seed.json')),separators=(',',':')))
open('out/studio-manici.html','w').write(t);print(len(t))
