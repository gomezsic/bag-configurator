# Costruisce la pagina "Prova come cliente" partendo dal template dello Studio (stesso motore di resa)
import json,base64,re,os
S='/tmp/claude-0/-home-claude-bag-configurator/08319b9b-a249-5997-a6b1-64ffe41cb483/scratchpad'
P=S+'/prova/';D=S+'/cliente/db/'
t=open(P+'studio_template_v3.html').read()
J=lambda f:json.load(open(D+f))
perc=J('percorsi/travel-bag-3q.json');tess=J('tessuto/travel-bag-3q-mattina.json');mat=J('abbinamenti/matrice.json')['righe']
man={}
for f in os.listdir(D+'manici'):
    d=json.load(open(D+'manici/'+f));man[d['id']]=d
def one(a,b,n=1):
    global t
    assert t.count(a)==n,(t.count(a),a[:70]);t=t.replace(a,b)
# --- HTML: nuova testata e scena, il vecchio pannello resta nascosto (serve al motore)
i0=t.index('<div class="wrap">');i1=t.index('<script>')
old=t[i0:i1]
s0=old.index('<div class="scroller" id="scroller">');s1=old.index('<div class="row" style="margin-top:8px">',s0)
stage=old[s0:s1];legacy=old[:s0]+old[s1:]
legacy=re.sub(r'<header>.*?</header>','',legacy,flags=re.S)
NAV='''<nav class="nav" aria-label="Pagine del configuratore"><a href="https://claude.ai/artifact/BCqynnj7v8aBQ93SGzBctk" target="_blank" rel="noopener">Inizio</a><a href="https://claude.ai/artifact/Sd4DdXc8hdsXZpyQJzZmVg" target="_blank" rel="noopener">1 · Archivio</a><a href="https://claude.ai/artifact/PaVnf94enksvaffx2AuwZd" target="_blank" rel="noopener">2 · Studio</a><span class="here">3 · Prova cliente</span></nav>'''
NEW='''<div class="wrap">
  <header>
    '''+NAV+'''
    <div class="eyebrow">QG Bags · prova come cliente · non è il negozio</div>
    <h1>Crea la tua Travel Bag</h1>
    <p class="muted" style="margin-top:8px">Scegli il tessuto, poi uno dei manici che abbiniamo a quel tessuto. Zip e colore del ricamo li decidiamo noi per ogni manico.</p>
  </header>
  <div class="shop">
    <div>'''+stage.replace('class="scroller"','class="scroller cl-scroller"')+'''</div>
    <div class="panel cl">
      <section><h3><span class="n">1</span> Tessuto</h3><div id="cfabs"></div><div class="pick" id="cfname"></div></section>
      <section><h3><span class="n">2</span> Manico</h3><div class="hands" id="chands"></div><div class="pick" id="chname"></div></section>
      <section class="sum"><h3>Riepilogo</h3>
        <dl>
          <dt>Modello</dt><dd>Travel Bag</dd>
          <dt>Tessuto</dt><dd id="sfab"></dd>
          <dt>Manico</dt><dd id="shand"></dd>
          <dt>Zip</dt><dd id="szip"></dd>
          <dt>Ricamo</dt><dd class="muted">In arrivo: misure e font da ricevere</dd>
          <dt>Prezzo</dt><dd class="muted">Da definire</dd>
        </dl>
        <button class="buy" type="button" disabled>Aggiungi al carrello</button>
        <p class="note">Pagina di prova: il carrello si collega quando arriva Shopify.</p>
      </section>
    </div>
  </div>
  <div hidden aria-hidden="true">'''+legacy+'''</div>
'''
t=t[:i0]+NEW+t[i1:]
CSS='''
.nav{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.nav a,.nav span{font:500 .72rem/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;padding:7px 11px;border-radius:999px;text-decoration:none;border:1px solid var(--line);color:var(--muted)}
.nav a:hover,.nav a:focus-visible{color:var(--fg);border-color:var(--fg)}
.nav .here{background:var(--accent);border-color:var(--accent);color:var(--surface)}
.shop{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:22px;align-items:start}
@media (max-width:900px){.shop{grid-template-columns:1fr}}
.cl-scroller{max-height:none;overflow:hidden}
.cl section h3{display:flex;align-items:center;gap:8px}
.cl .n{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--accent);color:var(--surface);font-size:.7rem;letter-spacing:0}
.fam{font:500 .82rem var(--body);color:var(--muted);margin:10px 0 6px}
.fam:first-child{margin-top:0}
.cl .sw{width:40px;height:40px;border-radius:50%}
.pick{font-size:.92rem;margin-top:8px;font-weight:600;min-height:1.4em}
.hands{display:flex;flex-direction:column;gap:6px}
.hand{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);padding:6px 8px;cursor:pointer;font:500 .9rem var(--body);text-align:left}
.hand[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft)}
.hand .rib{width:90px;height:18px;border-radius:2px;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
.hand small{display:block;color:var(--muted);font-weight:400;font-size:.78rem}
.sum dl{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0;font-size:.92rem}
.sum dt{color:var(--muted)}.sum dd{margin:0;min-width:0}
.buy{margin-top:12px;width:100%;padding:12px;border-radius:6px;border:0;background:var(--accent);color:var(--surface);font:600 1rem var(--body);opacity:.5;cursor:not-allowed}
.note{font-size:.8rem;color:var(--muted);margin-top:6px}
'''
one('</style>',CSS+'</style>')
one('<title>Studio QG Bags</title>','<title>Prova come cliente</title>')
# --- dati salvati nello Studio e nell'Archivio, copiati al momento della costruzione
one('let segs=seed0(),order=Object.keys(segs);','const SAVED='+json.dumps({'order':perc['order'],'segments':perc['segments']})+';let segs=densify(norm(JSON.parse(JSON.stringify(SAVED.segments)))),order=SAVED.order.filter(k=>segs[k]);')
FAB_ID={}
fabs=json.loads(re.search(r'const FABRICS=(\[.*?\]\]);',t).group(1))
for n,h,k in fabs:
    FAB_ID[n]=('neo_' if k=='neo' else 'trame_')+n.split(' ',1)[1].lower().replace(' ','_')
used=sorted({h for n in FAB_ID.values() for h in mat.get(n,[])},key=lambda x:int(re.sub(r'\D','',x) or 0))
samples=[[man[h]['codice'],[[b['c'],b['w']] for b in man[h]['bande']]] for h in used]
i=t.index('let SAMPLES=[');j=t.index('];',i)+2
t=t[:i]+'let SAMPLES='+json.dumps(samples)+';'+t[j:]
one("sample:2,guides:true","sample:0,guides:false")
pt=tess.get('per_tipo') or {'neo':tess['pezzi'],'trame':tess['pezzi']}
one("PKEYS.forEach(k=>TK[t][k]={rot:0,scale:1,dx:0,dy:0});});","PKEYS.forEach(k=>TK[t][k]=Object.assign({rot:0,scale:1,dx:0,dy:0},(SAVEDT[t]||{})[k]));});")
one("const TIPI=","const SAVEDT="+json.dumps(pt)+";const TIPI=")
# --- pannello cliente
CL='''
// ---------- pagina cliente ----------
const FID='''+json.dumps(FAB_ID)+''',MAT='''+json.dumps({k:mat.get(v,[]) for k,v in FAB_ID.items()})+''',HID='''+json.dumps(used)+''',HDESC='''+json.dumps({h:man[h]['descrizione'] for h in used})+''';
const FAM={neo:'Neoprene',trame:'Tramè'};
const grad=spec=>{const tot=spec.reduce((a,b)=>a+b[1],0);let acc=0;return 'linear-gradient(90deg,'+spec.map(([c,w])=>{const a=acc/tot*100;acc+=w;return c+' '+a.toFixed(1)+'% '+(acc/tot*100).toFixed(1)+'%';}).join(',')+')';};
function cFabs(){const box=$('cfabs');box.innerHTML='';Object.keys(FAM).forEach(fam=>{const h=document.createElement('div');h.className='fam';h.textContent=FAM[fam];box.appendChild(h);const row=document.createElement('div');row.className='chips';
 FABRICS.forEach((f,i)=>{if(f[2]!==fam)return;const b=document.createElement('button');b.type='button';b.className='sw';b.style.background=f[1];b.title=f[0];b.setAttribute('aria-label',f[0]);b.setAttribute('aria-pressed',i===st.fab);b.onclick=()=>{st.fab=i;cPickHand();cRender();};row.appendChild(b);});box.appendChild(row);});}
function allowed(){return (MAT[FABRICS[st.fab][0]]||[]).map(h=>HID.indexOf(h)).filter(i=>i>=0);}
function cPickHand(){const a=allowed();if(a.length&&a.indexOf(st.sample)<0)st.sample=a[0];}
function cRender(){cFabs();const f=FABRICS[st.fab],a=allowed();$('cfname').textContent=f[0];$('sfab').textContent=f[0];
 const box=$('chands');box.innerHTML='';
 if(!a.length){box.innerHTML='<p class="muted">Per questo tessuto non ci sono ancora manici abbinati.</p>';}
 a.forEach(i=>{const [code,spec]=SAMPLES[i];const b=document.createElement('button');b.type='button';b.className='hand';b.setAttribute('aria-pressed',i===st.sample);
  b.innerHTML='<span class="rib" style="background:'+grad(spec)+'"></span><span>Manico '+code+'<small></small></span>';b.querySelector('small').textContent=HDESC[HID[i]]||'';b.onclick=()=>{st.sample=i;cRender();};box.appendChild(b);});
 const h=a.length?SAMPLES[st.sample][0]:'';$('chname').textContent=a.length?(a.length===1?'Un solo manico per questo tessuto':a.length+' manici per questo tessuto'):'';$('shand').textContent=h?'Manico '+h:'—';
 $('szip').textContent='Decisa da QG Bags per il manico (in prova: '+ZIPS[st.zip][0].toLowerCase()+')';sync();}
cPickHand();cRender();
'''
one('// ---------- avvio ----------',CL+'// ---------- avvio ----------')
one("ready=true;sync();});","ready=true;sync();cRender();});")
def du(f):
    m='image/jpeg' if f.endswith('jpg') else 'image/png'
    return 'data:%s;base64,%s'%(m,base64.b64encode(open(P+f,'rb').read()).decode())
for k,f in {'__BASE__':'a_base.jpg','__MASKS__':'c_masks.png','__TILE__':'trame_neutro_512.png','__BODYA__':'e_bodyA.png','__BODYB__':'e_bodyB.png','__NEO__':'neo_tile512.png','__PIECES__':'b_pieces.png'}.items():
    one(k,du(f))
one('__SEED__',open(P+'studio_seed.json').read().strip())
open(S+'/cliente/cliente.html','w').write(t)
print('ok',len(t),used)
