# Costruisce lo Studio: mappe del corpo dalle maschere di Giacomo (pilota-travel-bag/maschere-giacomo)
import base64,json,os
H=os.path.dirname(os.path.abspath(__file__));A=os.path.join(H,'..','pilota-travel-bag','assets');G=os.path.join(H,'..','pilota-travel-bag','maschere-giacomo')
t=open(os.path.join(H,'studio_template.html')).read()
def du(f,m): return 'data:'+m+';base64,'+base64.b64encode(open(f,'rb').read()).decode()
for k,f,m in [('BASE',f'{A}/a_base.jpg','image/jpeg'),('MASKS',f'{G}/b_masks.png','image/png'),('TILE',f'{A}/a_tile256.png','image/png'),('BODYA',f'{G}/b_bodyA.png','image/png'),('BODYB',f'{G}/b_bodyB.png','image/png'),('NEO',f'{H}/neo_tile512.png','image/png'),('PIECES',f'{G}/b_pieces.png','image/png')]:
    t=t.replace('__'+k+'__',du(f,m))
t=t.replace('__SEED__',json.dumps(json.load(open(os.path.join(H,'studio_seed.json'))),separators=(',',':')))
t=t.replace('__PIECESJSON__',json.dumps(json.load(open(os.path.join(H,'pezzi_tessuto.json'))),ensure_ascii=False))
open(os.path.join(H,'studio-manici.html'),'w').write(t);print(len(t))
