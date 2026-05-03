# Project Memory

## Core
App custom Supabase per il configuratore 2D disaccoppiata da Shopify (che gestisce l'ecommerce).
Prezzi: determinati SOLO da modello borsa e tipo di tessuto (manici, colori, ricami non influiscono).
Rendering: Canvas HTML5 2D, maschere con feathering (1-3px), Z-index rigoroso (Base>Tessuto>Manici>Ricamo>Dettagli).
Asset vincolanti: Tutti i PNG di una vista devono avere identiche dimensioni e allineamento pixel-perfect.
UI: 6 step (Modello, Tessuto, Manici, Ricamo, Riepilogo, Conferma) con stato sincronizzato real-time.
Manici a strisce: bande LONGITUDINALI continue (colore = funzione di U solo, costante in V), mai blocchi/scacchiera/tile lungo la lunghezza.
Import borsa: SOLO via Admin → Carica File (/admin/upload) tramite ZIP unico. No upload separati per preset/handle_path.

## Memories
- [Sistema Disaccoppiato](mem://architettura/sistema-disaccoppiato) — Architecture overview splitting custom Supabase configurator and Shopify checkout
- [Backend Admin](mem://architettura/backend-admin) — Admin area functionalities for managing models, assets, and compatibility
- [Asset Pack ZIP canonico](mem://architettura/asset-pack-zip-canonico) — Standard ZIP unico (nomi canonici body/handle/side, alias legacy, handle_presets globali, upsert idempotente)
- [Flusso Shopify](mem://integrazione/flusso-shopify) — User journey from configurator to Shopify cart via Line Item Properties
- [Prezzi e Compatibilità](mem://logica/prezzi-e-compatibilita) — Pricing logic based strictly on bag model and fabric type
- [Flusso Configuratore](mem://interfaccia/flusso-configuratore) — The 6-step user interface flow and central state management
- [Filosofia Grafica](mem://rendering/filosofia-grafica) — 2D HTML5 Canvas engine composing products via dynamic masked textures and overlays
- [Pipeline Livelli](mem://rendering/pipeline-livelli) — Strict Z-index layer order and blend modes, including fixed structural details
- [Specifiche Asset](mem://tecnico/specifiche-asset) — Strict requirements for pixel-perfect, identically sized PNG asset validation
- [Struttura Zone](mem://tecnico/struttura-zone) — Division of bag models into specific fabric zones with independent transform parameters
- [Specifiche City](mem://modelli/city-specifiche) — Assets and zone structures specifically for the 'City' model bag
- [Curvature Manici](mem://rendering/gestione-curvature-manici) — Nearest-neighbor skeleton segmentation and feathering for curved handle patterns
- [Mask Tool](mem://strumenti/mask-tool) — Internal /mask-tool automating skeleton analysis, tangent auto-segmentation, and Supabase uploads
- [Strisce Manico Longitudinali](mem://rendering/strisce-manico-longitudinali) — Mandatory rule: handle stripes are continuous longitudinal bands, color = f(U) only, never tiled along V
- [Tessuti multi-colore](mem://tecnico/tessuti-multicolore-multiply) — Una texture B/N seamless + N colori applicati runtime via blend multiply (canvas), tabella fabric_colors
