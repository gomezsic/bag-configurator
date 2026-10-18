# Configuratore fotografico QG Bags

Strumenti e materiali del nuovo configuratore: le borse vengono "vestite" con tessuti e manici a righe partendo da una foto neutra, con ombre e curve vere.

La vecchia app Lovable è archiviata nel ramo `archivio-lovable`.

- `GUIDA-SETTAGGIO.md`: come si inseriscono borse, tessuti e manici, con gli standard fissi. La stessa guida è anche in PDF e Word, pronta da stampare.
- `studio-manici/`: lo Studio, dove si regolano i percorsi dei manici, le ricette dei manici, i tessuti e la zip (online: https://claude.ai/artifact/PaVnf94enksvaffx2AuwZd).
  - `studio-manici.html`: la pagina completa.
  - `studio_template.html` + `studio_build.py`: il sorgente e la build, che incorpora le immagini da `pilota-travel-bag/`.
  - `studio_seed.json`: la proposta automatica di partenza dei tratti.
  - `nastri-campione.json`: le bande (colore e % di larghezza) dei manici ricavate dalle scansioni con `bands.py`.
  - `neo_tile512.png`: la trama del neoprene ripetibile.
- `archivio/archivio.html`: l'Archivio con i moduli guidati di modelli, tessuti, manici, abbinamenti, collezioni e ricamo (online: https://claude.ai/artifact/Sd4DdXc8hdsXZpyQJzZmVg). I dati stanno nel database dell'artifact (raccolte `modelli`, `tessuti`, `manici`, `collezioni`, documenti `abbinamenti/matrice` e `impostazioni/ricamo`).
- `pilota-travel-bag/`: le mappe, le immagini e gli script della Travel Bag 3/4 (`script/`: `stmap.py`, `bodyuv.py`, `prep.py`, `build.py`).
- `tessuti/neoprene/`: la trama neutra originale, quella ripetibile e la prova di colorazione.

Formato di un tratto di manico: `pts: [[x, y, sinistra, destra, scorrimento_sx, scorrimento_dx], ...]`, in pixel della foto 1174×1179. I bordi sono curve che passano per `centro ∓ normale·larghezza + tangente·scorrimento`.
