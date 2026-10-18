# Guida al settaggio del configuratore QG Bags

Questa guida spiega come si inserisce una borsa nuova, un tessuto nuovo e un manico nuovo. Sostituisce la vecchia `guida-preparazione-materiali.md`: dove le due guide non coincidono, vale questa.

Ogni borsa si prepara **una volta sola**. Dopo, tutti i tessuti e tutti i manici si applicano da soli.

---

## 1. Il processo in breve

| Fase | Chi | Cosa | Quante volte |
|---|---|---|---|
| A. Foto del modello | Giacomo | Foto della borsa neutra (tessuto chiaro, manici bianchi) | Una per borsa e vista |
| B. Scontorni | Giacomo | Un PSD con un livello per ogni pezzo | Una per borsa e vista |
| C. Mappe e ombre | Claude | Mappe della forma, ombre, proposta dei percorsi dei manici | Una per borsa e vista |
| D. Settaggio nello Studio | Giacomo | Correggi i percorsi dei manici e il verso del tessuto, poi salvi | Una per borsa e vista |
| E. Tessuti | Giacomo → Claude | Una scansione neutra per famiglia più un codice colore per ogni variante | Una per famiglia |
| F. Manici | Giacomo → Claude | Una scansione dritta per manico; Claude legge le bande e tu le controlli nello Studio | Una per manico |
| G. Abbinamenti | Giacomo | Per ogni tessuto, i manici ammessi e il colore della zip | Una per tessuto |

Lo Studio è qui: [Studio QG Bags](https://claude.ai/artifact/PaVnf94enksvaffx2AuwZd) (https://claude.ai/artifact/PaVnf94enksvaffx2AuwZd). È l'unico strumento di lavoro: dentro si regolano i percorsi dei manici, le ricette dei manici, i tessuti e la zip, con l'anteprima della borsa dal vivo.

---

## 2. Gli standard fissi (uguali per tutto)

| Cosa | Formato | Dimensione | Risoluzione |
|---|---|---|---|
| Foto della borsa | PNG, sRGB, 8 o 16 bit | **Tela 2400 × 2400 px**, sfondo bianco, borsa che occupa circa l'80% | Non conta, conta la tela |
| Scontorni | PSD con livelli, **stessa tela 2400 × 2400 px** della foto | Uguale alla foto | Uguale alla foto |
| Tessuto | PNG o TIFF, sRGB, 8 bit | **Quadrato di 20 × 20 cm = 2362 × 2362 px** | **300 dpi** |
| Manico | PNG o TIFF, sRGB, 8 bit | **Tratto dritto di 25 cm**, ritagliato da bordo a bordo del nastro | **300 dpi** |

Tessuti e manici vanno sempre a **300 dpi**, così la scala resta la stessa ovunque: 1 cm vale sempre 118 px.

La tela di 2400 px resta uguale per tutte le borse e per tutte le viste. Nel configuratore la mostro più piccola, ma la conservo grande per gli schermi ad alta definizione.

---

## 3. Fase A: la foto del modello

1. Usa la borsa realizzata in **tessuto chiaro e neutro** (bianco o grigio chiaro, senza trama marcata), con **manici bianchi o panna lisci** e zip chiara.
2. Usa una luce **diffusa**, con la principale da in alto a sinistra: niente riflessi bruciati e niente zone nere.
3. Metti la macchina su cavalletto, con un obiettivo da 50–85 mm. Usa la **stessa inquadratura** per tutte le borse della stessa vista.
4. Porta la foto sulla tela 2400 × 2400 px, con la borsa centrata.
5. Salva in PNG o TIFF, **mai in JPEG**: la compressione rovina le sfumature delle ombre.

### Come rendere la foto "neutra" in Photoshop

Lo scopo è che resti solo la luce (ombre, pieghe, cuciture), senza colore.

1. **Duplica** il livello della foto e chiamalo `foto`.
2. **Togli il colore** dal tessuto, dai manici e dalla zip: *Immagine → Regolazioni → Tonalità/Saturazione*, con saturazione **−100**. Non toccare i metalli: restano color bronzo.
3. **Livelli** (*Immagine → Regolazioni → Livelli*):
   - il punto più chiaro del tessuto deve stare tra **230 e 240**, mai a 255, altrimenti si perde la trama;
   - le ombre più scure non devono scendere sotto **20**, altrimenti diventano buchi neri.
4. **Controlla con il pannello Info**: passa il mouse sulle zone più chiare e più scure e verifica che i valori stiano tra 20 e 240.
5. **Non** aumentare la nitidezza e **non** aggiungere contrasto. Il resto lo faccio io.

---

## 4. Fase B: gli scontorni

Un unico PSD, sulla stessa tela della foto. Ogni livello è un pezzo **pieno**: bianco o colore pieno dove c'è il pezzo, trasparente altrove.

### Come scontornare, passo per passo

1. Seleziona il pezzo con lo **Strumento penna**, il metodo più preciso, oppure con *Seleziona → Soggetto* seguito da un ritocco a mano.
2. Ammorbidisci il bordo di **0,5–1 px** al massimo (*Seleziona → Modifica → Sfuma*). Niente bordi sfumati più larghi.
3. Crea un livello nuovo con il nome giusto (tabella sotto) e riempi la selezione (*Modifica → Riempi*, bianco).
4. Scontorna **solo la parte visibile** di ogni pezzo. Se un manico copre il corpo, il corpo sotto il manico non va incluso.
5. Se un tratto di manico **si piega su sé stesso o si attorciglia**, spezzalo in due livelli nel punto della piega.
6. Ripeti per ogni pezzo. Alla fine salva il PSD con tutti i livelli.

### Livelli richiesti

| Nome livello | Contenuto |
|---|---|
| `foto` | La foto neutra della fase A |
| `corpo_fronte`, `corpo_sopra`, `corpo_retro` | Le facce del corpo dove il tessuto corre in direzioni diverse |
| `fianco_sx`, `fianco_dx` | I fianchi o le testate (sulla Travel sono i due cerchi laterali) |
| `fondo` | Solo se è di un materiale diverso |
| `manico_davanti`, `manico_dietro`, `tracolla`, `linguetta_sx`, `linguetta_dx` | **Ogni tratto di manico separato**, spezzato dove passa dietro a qualcosa o cambia lato |
| `zip` | Il nastro della zip |
| `metalli` | Moschettoni, anelli e cursori, **con il loro colore bronzo vero** (vanno sopra a tutto e non si colorano mai) |
| `ricamo` | Il rettangolo dove può andare la scritta |
| `ombra_terra` | L'ombra sul fondo bianco, da sola |

Il verso del tessuto **non** va disegnato nel PSD: lo imposti tu nello Studio (fase D).

### Dove mettere i file

`configuratore/borse/<nome-borsa>/<vista>/` (ad esempio `configuratore/borse/travel/3-4/travel-3-4.psd`).

---

## 5. Fase C: il mio lavoro

Con foto e scontorni io preparo:

- le **mappe della forma** di ogni pezzo, per far seguire al tessuto le curve della borsa;
- le **ombre**: quelle vere della foto più l'ombreggiatura che dà rotondità e profondità;
- l'**ombra di contatto** sotto manici e linguette;
- la **proposta dei percorsi** dei manici, da correggere nello Studio.

Tu non devi toccare livelli, saturazioni o mappe.

---

## 6. Fase D: il settaggio nello Studio

Apri lo [Studio](https://claude.ai/artifact/PaVnf94enksvaffx2AuwZd) e scegli la borsa.

### Com'è fatto lo Studio

- **A sinistra** c'è la borsa con l'anteprima dal vivo. Sopra la borsa ci sono le guide dei manici: punti tondi per il centro, quadratini per i bordi, linee tratteggiate per i bordi interpolati, una freccia per il verso. Sotto la borsa c'è lo **Zoom** (100–300%) per i dettagli.
- **A destra**, dall'alto in basso, ci sono questi pannelli:
  - **Tratti**: l'elenco dei tratti di manico della borsa (manico davanti, manico dietro, tracolla, linguette).
  - **Tratto selezionato**: Davanti/Dietro, Rovescio, Inverti verso, Ruota righe 90°, + Punto dopo, − Elimina punto.
  - **Tessuto**: i tessuti da provare sulla borsa.
  - **Zip**: i colori della zip.
  - **Manico**: i manici da provare.
  - **Ricetta del manico**: l'editor delle bande del manico scelto.
  - **Vista**: Mostra le guide (togli la spunta per vedere la borsa pulita), Ritaglia con lo scontorno, Mostra la mappa delle righe (vista tecnica di controllo).
  - **Salvataggio**: Salva percorsi, Copia dati, Proposta automatica (riporta i percorsi alla proposta iniziale).
- **In basso** sotto ogni pannello c'è una riga di stato: dice se le modifiche sono salvate e a che ora.

### Percorsi dei manici

1. Seleziona un tratto dall'elenco a destra.
2. Trascina i **punti tondi** lungo il centro del nastro: i bordi restano fermi. Con **Alt** sposti centro e bordi insieme.
3. Trascina i **quadratini** sui bordi veri del nastro, in qualsiasi direzione. I bordi sono curve morbide che passano esattamente per ogni quadratino.
4. Per la precisione: clicca un punto o un quadratino e usa le **frecce della tastiera** (1 px per pressione, con **Maiusc** 5 px).
5. Usa **+ Punto dopo** dove la curva è stretta (per esempio vicino agli attacchi in basso).
6. **Ruota righe 90°** serve per le linguette, dove le righe corrono nel senso opposto.
7. Usa **Dietro** per i tratti che passano dietro alla borsa e **Rovescio** se il nastro mostra il lato opposto.
8. Controlla cambiando manico: le righe devono stare dritte e parallele ai bordi.
9. Usa **− Elimina punto** per togliere un punto selezionato e **Inverti verso** per invertire la direzione del tratto.
10. **Salva percorsi**. Il salvataggio parte anche da solo dopo ogni modifica.

I percorsi valgono per **tutti** i manici: si fanno una volta per borsa e vista.

### Tessuto e zip

Nel pannello **Tessuto** scegli un tessuto e lo vedi subito sulla borsa, in scala reale. Oggi ci sono i 6 neoprene e il Dylan 710. Nel pannello **Zip** scegli il colore della zip.

### Verso del tessuto (in arrivo)

Lo costruisco appena arrivano gli scontorni della Travel, dentro la sezione Tessuto. Per ogni pezzo (fronte, sopra, fianchi) disegnerai:

- **una freccia**: il verso della trama principale, che sulle parti piatte basta da sola;
- **due linee guida curve**, facoltative: sulle parti curve fanno piegare la trama seguendo la borsa;
- **un cursore per la scala** della trama.

Siccome tutti i tessuti arrivano con la trama nello stesso verso, questo lavoro si fa una volta per borsa e vale per tutti i tessuti.

### Campionario dei tessuti (in arrivo)

Nella stessa sezione ci sarà il campionario: per ogni famiglia la trama e l'elenco dei colori con nome e codice, modificabili e salvati come le ricette dei manici.

---

## 7. Fase E: i tessuti

### Quale versione mi serve

| Tipo di tessuto | Cosa mi passi | Come lo coloro |
|---|---|---|
| Stessa trama in tanti colori (**neoprene, Tramè, Frozen**, velluto tinta unita) | **Una** scansione **neutra** per famiglia più l'elenco dei colori | Moltiplicazione: trama neutra × codice colore |
| Stampati, mélange, velluti con riflessi di colore | La scansione di **ogni** variante già colorata | Nessuna colorazione, uso il tessuto com'è |

### Come preparare la scansione neutra

1. Scansiona il tessuto **piano e ben tirato**, senza pieghe, a **300 dpi** (con lo scanner piano o con una foto perfettamente parallela al tessuto, luce diffusa e uniforme, nessun riflesso), con la trama principale **sempre nello stesso verso** (righe della trama verticali).
2. Usa la variante **più chiara** che hai.
3. Ritaglia un quadrato di **20 × 20 cm (2362 × 2362 px)**.
4. Togli il colore: *Tonalità/Saturazione*, saturazione **−100**.
5. **Livelli**: la superficie del filo intorno a **200–215** (circa 80% di grigio). I fori e le zone profonde restano scuri come sono.
6. Salva come `tessuti/<famiglia>/<famiglia>-neutro.png`.
7. *Facoltativo ma utile:* una seconda foto nella stessa posizione con **una sola luce radente** da sinistra. Fa vedere il rilievo: i fori del neoprene, il pelo del velluto, la trama del Tramè.

Il quadrato ripetibile senza giunture lo preparo io.

### I colori delle varianti

Per ogni variante mi basta il **nome** e il **codice colore**. Se non hai il codice, mandami una foto dei campioni con luce diffusa, come il campionario del neoprene, e lo ricavo io.

### Esempio: il neoprene

Dal campionario che mi hai mandato ho ricavato il colore del filo di ogni variante:

| Variante | Codice colore |
|---|---|
| Tortora | `#827268` |
| Burgundy | `#680f27` |
| Petrolio | `#1180b0` |
| Army | `#747465` |
| Blu royal | `#1056e5` |
| Blu scuro | `#263b74` |

La tua trama neutra (`neoprene-neutro-originale.jpg`, 1024 px a 600 dpi, cioè 4,3 cm di lato) l'ho trasformata in una trama ripetibile senza giunture, 3,99 × 4,33 cm: [neoprene-trama-ripetibile.png](/mnt/project-files/configuratore/tessuti/neoprene/neoprene-trama-ripetibile.png). I 6 colori sono già sulla Travel nello [Studio](https://claude.ai/artifact/PaVnf94enksvaffx2AuwZd), in scala reale. La prova di colorazione sul campionario è in [prova-colorazione-neoprene.png](/mnt/project-files/configuratore/tessuti/neoprene/prova-colorazione-neoprene.png).

Va bene anche una scansione come questa, a 600 dpi e più piccola di 20 cm, purché contenga almeno 8–10 ripetizioni del motivo.

I codici sono un punto di partenza letto da una foto: li confrontiamo a vista con i tessuti veri.

---

## 8. Fase F: i manici

1. Scansiona un **tratto dritto di 25 cm** a **300 dpi**, con il nastro **verticale** e i bordi paralleli ai lati dell'immagine.
2. Ritaglia **esattamente da bordo a bordo** del nastro, senza sfondo ai lati.
3. Salva come `manici/manico-<codice>.png` (ad esempio `manico-56.png`).
4. Scrivi nel messaggio il **codice** del manico. Va bene anche una semplice scansione piana del nastro.

Il numero di righe, i colori e le larghezze delle bande li leggo io dalla scansione. Tu li controlli nello Studio, sotto **Ricetta del manico**:

- clicchi una banda per cambiarne il colore (su Chrome anche con il contagocce);
- trascini le linee tra le bande per cambiarne la larghezza;
- con **Dividi banda** e **Togli banda** cambi il numero di righe;
- con **+ Nuovo** crei un manico e gli dai il codice;
- premi **Salva manici**.

Le bande possono avere qualsiasi larghezza, anche righe interne strette e larghe sullo stesso nastro. Tutti i manici hanno la stessa larghezza totale, quindi usano tutti gli stessi percorsi.

---

## 9. Fase G: gli abbinamenti

Per ogni colore di tessuto indichi:

- i **manici ammessi** (circa 4);
- il **colore della zip**, deciso da voi. Il ricamo prende sempre il colore della zip.

In più, le **combinazioni preferite** da proporre in home.

---

## 10. Riepilogo per una borsa nuova

1. Foto neutra su tela 2400 × 2400 px (fase A).
2. PSD con gli scontorni sulla stessa tela (fase B) in `configuratore/borse/<borsa>/<vista>/`.
3. Mi scrivi che è pronta: preparo mappe, ombre e percorsi (fase C).
4. Correggi e salvi nello Studio (fase D).
5. Fatto: tutti i tessuti e i manici già inseriti funzionano anche su questa borsa.

## 11. Riepilogo per un tessuto nuovo

1. Scansione neutra 20 × 20 cm a 300 dpi, desaturata, filo a 200–215 (fase E).
2. Elenco delle varianti con nome e codice colore, oppure una foto dei campioni.
3. Io preparo la trama ripetibile e la metto nello Studio. Tu controlli i colori a vista.

## 12. Riepilogo per un manico nuovo

1. Scansione dritta di 25 cm a 300 dpi, da bordo a bordo (fase F), più il codice.
2. Io leggo bande, colori e larghezze e lo metto nello Studio.
3. Tu controlli la ricetta e premi **Salva manici**.

---

## 13. Cosa non fare

- Non salvare foto o scansioni in **JPEG** quando puoi usare PNG o TIFF.
- Non portare il bianco del tessuto a **255** e le ombre sotto **20**.
- Non aggiungere **nitidezza** o **contrasto** alla foto neutra.
- Non sfumare i bordi degli scontorni più di **1 px**.
- Non cambiare **tela** o **inquadratura** tra le borse della stessa vista.
- Non scansionare i tessuti con la trama in **versi diversi**.
- Non ricolorare i **metalli**: vanno con il loro colore vero.

---

## 14. Dove si trova tutto

| Cosa | Dove |
|---|---|
| Studio (percorsi, manici, tessuti, zip) | https://claude.ai/artifact/PaVnf94enksvaffx2AuwZd |
| Questa guida | `configuratore/GUIDA-SETTAGGIO.md` (anche in PDF e Word) |
| Borse: foto e PSD | `configuratore/borse/<borsa>/<vista>/` |
| Tessuti | `configuratore/tessuti/<famiglia>/` |
| Manici | `configuratore/manici/` |
| File di lavoro dello Studio (sorgente, bande dei manici) | `configuratore/studio-manici/` |
| Mappe, script e immagini della Travel | `configuratore/pilota-travel-bag/` |

I percorsi e le ricette che salvi nello Studio restano nello Studio stesso: li ritrovi riaprendo il link.
