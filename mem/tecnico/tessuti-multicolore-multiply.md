---
name: Tessuti multi-colore (matrice B/N + multiply)
description: Una texture grayscale seamless funge da matrice; le varianti colore vengono generate runtime via blend multiply (canvas), senza PNG aggiuntivi.
type: feature
---

## Modello dati
- `fabrics.texture_url` = texture **scala di grigi seamless** (la "matrice")
- Tabella `fabric_colors` (FK → fabrics, ON DELETE CASCADE):
  - `name`, `hex`, `thumbnail_url`, `is_active`, `sort_order`

## Render
- Helper: `src/lib/textureMultiply.ts` → `getMultipliedTexture(url, hex, opts)`
- Formula: `out_rgb = (gray/255) * tint_rgb`, con normalizzazione opzionale della luminanza media a ~0.65 per evitare colori troppo scuri
- Cache in-memory `${url}|${hex}|${size}` (max 32 entry)
- **Solo runtime**: nessun PNG colorato salvato in storage

## Admin UX
- `/admin/fabrics` → editor tessuto: dopo il primo salvataggio appare `FabricColorsEditor`
- CRUD inline con swatch live (canvas multiply 56×56) + color picker hex
- Toggle `is_active` per nascondere colori dal configuratore

## Configuratore (step Tessuto)
- Stesso step Tessuto (no nuovo step)
- Se il tessuto selezionato ha colori attivi → mostra swatch e applica multiply al render

## Prezzi
- I colori NON modificano il prezzo (regola: prezzo = solo modello + tessuto base)
