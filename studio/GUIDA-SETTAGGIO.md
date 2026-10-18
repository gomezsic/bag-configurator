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

Lo Studio è qui: [Studio Manici QG Bags](https://claude.ai/artifact/PaVnf94enksvaffx2AuwZd).

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
5. Ripeti per ogni pezzo. Alla fine esporta il PSD con tutti i livelli.

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

### Percorsi dei manici

1. Seleziona un tratto dall'elenco a destra.
2. Trascina i **punti tondi** lungo il centro del nastro: i bordi restano fermi. Con **Alt** sposti centro e bordi insieme.
3. Trascina i **quadratini** sui bordi veri del nastro, in qualsiasi direzione.
4. Usa **+ Punto dopo** dove la curva è stretta (per esempio vicino agli attacchi in basso).
5. **Ruota righe 90°** serve per le linguette, dove le righe corrono nel senso opposto.
6. Usa **Dietro** per i tratti che passano dietro alla borsa e **Rovescio** se il nastro mostra il lato opposto.
7. Controlla cambiando manico campione: le righe devono stare dritte e parallele ai bordi.
8. **Salva percorsi**. Il salvataggio parte anche da solo dopo ogni modifica.

I percorsi valgono per **tutti** i manici: si fanno una volta per borsa e vista.

### Verso del tessuto (in arrivo)

Lo costruisco appena arrivano gli scontorni della Travel. Per ogni pezzo disegnerai una freccia (il verso della trama) e, sulle parti curve, due linee guida. In più c'è un cursore per la scala della trama.

---

## 7. Fase E: i tessuti

### Quale versione mi serve

| Tipo di tessuto | Cosa mi passi | Come lo coloro |
|---|---|---|
| Stessa trama in tanti colori (**neoprene, Tramè, Frozen**, velluto tinta unita) | **Una** scansione **neutra** per famiglia più l'elenco dei colori | Moltiplicazione: trama neutra × codice colore |
| Stampati, mélange, velluti con riflessi di colore | La scansione di **ogni** variante già colorata | Nessuna colorazione, uso il tessuto com'è |

### Come preparare la scansione neutra

1. Scansiona il tessuto **piano e ben tirato**, a **300 dpi**, con la trama principale **sempre nello stesso verso** (righe della trama verticali).
2. Usa la variante **più chiara** che hai.
3. Ritaglia un quadrato di **20 × 20 cm (2362 × 2362 px)**.
4. Togli il colore: *Tonalità/Saturazione*, saturazione **−100**.
5. **Livelli**: la superficie del filo intorno a **200–215** (circa 80% di grigio). I fori e le zone profonde restano scuri come sono.
6. Salva come `tessuti/<famiglia>/<famiglia>-neutro.png`.

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

La tua trama neutra (`neoprene-neutro-originale.jpg`, 1024 px a 600 dpi, cioè 4,3 cm di lato) l'ho trasformata in una trama ripetibile senza giunture, 3,99 × 4,33 cm: [neoprene-trama-ripetibile.png](/mnt/project-files/configuratore/tessuti/neoprene/neoprene-trama-ripetibile.png). I 6 colori sono già sulla Travel nella [pilota](https://claude.ai/artifact/KMuu3Z8KrdEKPykFVzRP7j), in scala reale. La prova di colorazione sul campionario è in [prova-colorazione-neoprene.png](/mnt/project-files/configuratore/tessuti/neoprene/prova-colorazione-neoprene.png).

Va bene anche una scansione come questa, a 600 dpi e più piccola di 20 cm, purché contenga almeno 8–10 ripetizioni del motivo.

I codici sono un punto di partenza letto da una foto: li confrontiamo a vista con i tessuti veri.

---

## 8. Fase F: i manici

1. Scansiona un **tratto dritto di 25 cm** a **300 dpi**, con il nastro **verticale** e i bordi paralleli ai lati dell'immagine.
2. Ritaglia **esattamente da bordo a bordo** del nastro, senza sfondo ai lati.
3. Salva come `manici/manico-<codice>.png` (ad esempio `manico-56.png`).

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
