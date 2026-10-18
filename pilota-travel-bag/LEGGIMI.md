# Pilota Travel Bag (vista 3/4)

- `travel-bag-pilota.html`: pagina di prova, autonoma, con tutti gli asset incorporati.
- `assets/a_uv.png`: mappa UV dei manici. R = posizione attraverso il nastro (0–255), G e B = posizione lungo il nastro in 1/16 di px (16 bit).
- `assets/a_masks.png`: maschere. R = manici, G = corpo/tessuto, B = zip.
- `assets/centerlines.json`: le linee centrali dei manici, già rifinite sullo scontorno.
- `script/stmap.py`: dai punti grezzi delle linee centrali e dallo scontorno dei manici calcola la mappa UV.
- `script/prep.py`: prepara base, maschere e tile. Il tile del pilota è ricavato dal livello dylan-710; con le scansioni vere va sostituito.
- Sorgenti: i file inviati da Giacomo il 2026-10-18 (Travel_neutra, handle-39, zip-y026__fc1680, dylan-710__00becc).
- `assets/a_bodyA.png`, `a_bodyB.png` (v2): coordinate del tessuto sul corpo a 16 bit (A: R,G = orizzontale; B: R,G = verticale). A.B = ombra dei manici sul corpo, B.B = luce sulla rotondità.
- `script/bodyuv.py` (v2): divide il corpo in fronte+alto avvolto sul cilindro (patch di Coons tra 4 curve, angolo arcsin) e testata (ellisse). Le curve sono stimate a occhio sulla foto; con gli scontorni dei pezzi di Giacomo vanno sostituite.
