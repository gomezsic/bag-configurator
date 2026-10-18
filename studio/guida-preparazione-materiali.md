# Guida alla preparazione dei materiali per il configuratore QG Bags

Questa guida spiega cosa preparare per ogni borsa, tessuto e manico. Il configuratore poi li combina da solo nel browser. Il pilota si fa sulla **Travel Bag**, vista frontale di 3/4, perché esiste già la foto neutra del configuratore attuale.

## 1. Come funziona la composizione

Per ogni pixel della borsa il configuratore fa tre cose:

1. Prende il colore del tessuto scelto, steso secondo la forma di quella parte (corpo, fianco, manico).
2. Lo moltiplica per la luce della foto neutra: ombre, pieghe e cuciture restano quelle vere.
3. Sopra mette i metalli (moschettoni, anelli, cursore della zip), che non si colorano mai.

Per questo la foto neutra conta più di tutto il resto: deve essere chiara, uniforme e con ombre morbide.

## 2. Foto della borsa (una per ogni borsa e vista)

| Cosa | Come |
|---|---|
| Borsa | Realizzata in tessuto **chiaro neutro** (bianco/grigio chiaro, senza trama marcata), con **manici bianchi o panna lisci**. Come la Travel Bag "BASE" di oggi. |
| Luce | Diffusa, da softbox grandi o da luce bianca ampia, con la luce principale da in alto a sinistra. Niente riflessi bruciati e niente zone nere. |
| Camera | Su cavalletto, con la stessa inquadratura per tutte le borse della stessa vista. Obiettivo 50–85 mm per non deformare. |
| File | PNG 16 bit o TIFF, sRGB, lato lungo **almeno 3000 px**. Niente compressione JPEG. |
| Viste | Per il pilota 1 vista (3/4 frontale). Poi si possono aggiungere frontale, retro e laterale, ognuna con il proprio set. |

## 3. Livelli da scontornare (un PSD per ogni vista)

Tutti i livelli stanno **sulla stessa tela, allineati al pixel** con la foto. Ogni livello è una maschera piena (bianco = parte, trasparente = resto), senza bordi sfumati più di 1–2 px.

| Nome livello | Contenuto |
|---|---|
| `foto` | La foto neutra completa, non toccata. |
| `corpo` | Il corpo principale che riceve il tessuto. |
| `fianco_sx`, `fianco_dx` | I fianchi o le testate, se il tessuto ci corre in un'altra direzione (sulla Travel Bag sono i due cerchi laterali). |
| `fondo` | Se è di un materiale diverso. |
| `zip_nastro` | Il nastro della zip (si colora). |
| `metalli` | Moschettoni, anelli, cursore: ritagliati **con il loro colore**, perché vanno sopra a tutto. |
| `manico_1_davanti`, `manico_1_dietro`, `manico_2_davanti`, ... | **Ogni tratto di manico separato.** Va separato dove il manico passa dietro a qualcosa o cambia lato: la parte cucita sul corpo, l'arco, la parte dietro. |
| `tracolla_...` | Come i manici, un livello per tratto. |
| `ricamo` | Il rettangolo dove può andare il testo. |
| `ombra_terra` | L'ombra sul fondo bianco, da sola. |

Se un tratto di manico si piega su sé stesso o si attorciglia, va spezzato in due livelli nel punto della piega.

## 4. Tessuti del corpo (uno per ogni tessuto)

Usate il **tessuto reale nel suo colore** quando esiste: un velluto blu notte ricolorato non sarà mai bello come quello vero. La ricolorazione serve solo per colori che non avete in mano.

| Cosa | Come |
|---|---|
| Campione | Almeno 30 × 30 cm, steso piano e ben tirato, senza pieghe. |
| Luce | Diffusa e uniforme, due luci a 45° oppure cielo coperto. Nessun riflesso. |
| Camera | **Perfettamente parallela** al tessuto, dall'alto, con un **righello** in un angolo per la scala. |
| Seconda foto (facoltativa ma consigliata) | Stessa posizione, con **una sola luce radente** da sinistra. Serve a far vedere il rilievo: i fori del neoprene, il pelo del velluto, la trama del Tramè. |
| File | TIFF o PNG, sRGB, almeno 4000 px. |
| Per ricolorare | Fotografate la versione più chiara del tessuto. Il colore si applica come "Mappa sfumatura" di Photoshop, e quella parte la faccio io. |

Il ritaglio quadrato e la ripetizione senza giunture (tile seamless) li preparo io. Se volete farli voi: in Photoshop si usa *Filtro → Altro → Sposta* di metà larghezza e metà altezza, poi si ritoccano le giunture con il pennello correttivo. Esportate a 2048 × 2048 px e scrivete quanti cm misura il lato.

## 5. Nastri dei manici (uno per ogni manico)

| Cosa | Come |
|---|---|
| Campione | Un tratto **dritto** di nastro di almeno 25 cm, steso piano. |
| Orientamento | Righe **verticali**, nastro verticale nell'inquadratura, bordi paralleli ai lati della foto. |
| Luce e camera | Come per i tessuti: diffusa e parallela. |
| Ritaglio | Esattamente da bordo a bordo del nastro, senza sfondo ai lati. |
| File | PNG, larghezza del nastro ≥ 400 px, altezza almeno 4 volte la larghezza. |
| Dati | Codice del manico (es. 56) e larghezza reale in mm. |

Va bene anche una semplice scansione piana del nastro.

## 6. Come il manico segue le curve

Il nastro dritto non viene deformato a mano. Per ogni tratto di manico nella foto (i livelli `manico_...`) traccio una **linea centrale** con pochi punti, lungo il centro del manico, una volta per borsa. Da quella linea il configuratore costruisce una striscia sottile:

- lungo la linea misura la distanza percorsa, e lì scorre la lunghezza della tua texture;
- attraverso la striscia, da bordo a bordo, c'è la larghezza della texture.

Le righe verticali quindi restano sempre parallele ai bordi del manico e seguono ogni curva, come in un nastro vero. La texture viene poi moltiplicata per la luce del manico bianco della foto neutra (pieghe, ombre, cuciture) e ritagliata dalla tua maschera, così i bordi restano quelli reali. Puoi vederlo nel prototipo: [Configuratore fotografico QG Bags](https://claude.ai/artifact/LXFdVHeQfieG23XY38NYMx), con l'opzione "Mostra la mappa UV".

La linea centrale si traccia in un piccolo editor che costruisco io. Di conseguenza, aggiungere un manico nuovo vuol dire caricare la sua texture dritta, senza toccare le borse.

## 7. Per il pilota (Travel Bag) mi servono

1. Il PSD della vista 3/4 con i livelli del punto 3 (la foto BASE attuale va bene se c'è in alta risoluzione).
2. Tre tessuti con le foto del punto 4: un neoprene, un velluto e un Tramè.
3. Tre manici con le foto del punto 5, per esempio 56, 10 e 14.

Mettete tutto in una cartella `pilota-travel-bag` dentro la cartella del progetto.
