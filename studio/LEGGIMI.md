# Studio configuratore (prototipi)

Lavoro di settaggio e prototipi del nuovo configuratore fotografico QG Bags. Non tocca l'app in `src/`.

- `guida-preparazione-materiali.md`: come preparare foto, scontorni, tessuti e nastri.
- `pilota-travel-bag/`: pilota della Travel Bag 3/4 (tessuto con ombre, manici a righe). `travel-bag-pilota.html` si apre da solo nel browser; `script/` rigenera mappe e pagina (`LEGGIMI.md` interno).
- `studio-manici/`: Studio per tracciare linea centrale e bordi di ogni tratto di manico.
  - `studio-manici.html`: la pagina completa (online: https://claude.ai/artifact/PaVnf94enksvaffx2AuwZd).
  - `studio_template.html` + `studio_build.py`: sorgente e build (incorpora le immagini da `pilota-travel-bag`).
  - `studio_seed.json`: proposta automatica di partenza dei tratti.
  - `nastri-campione.json`: bande (colore, % larghezza) dei nastri 18, 20, 22, 26, 26X, 64X, ENG, ricavate con `bands.py`.

Formato di un tratto: `pts: [[x, y, sinistra, destra, scorrimento_sx, scorrimento_dx], ...]` in pixel della foto 1174×1179; i bordi sono `centro ∓ normale·larghezza + tangente·scorrimento`.
