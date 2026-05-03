---
name: GLOSSARY
description: Domain terms specific to this bag configurator project.
type: glossary
updated: 2026-05-03
status: VERIFIED
priority: medium
---

# GLOSSARY

| Term | Meaning |
|---|---|
| **Bag model** | A physical bag SKU (e.g. "City", "Tote"). Row in `bag_models`. |
| **View** | A camera angle of a bag model: `front`, `back`, `side`, `top`. Row in `bag_views`. Each view has its own asset set. |
| **Zone** | A region of a view that can be filled with a fabric. Row in `mask_zones`. Each zone has its own mask PNG and transform. |
| **Mask** | A grayscale PNG where white = zone pixels, black = ignore. Used to clip textures. |
| **Feathering** | 1–3 px Gaussian blur applied to mask edges to avoid pixel-stepped seams. |
| **Asset pack** | A canonical ZIP containing all PNGs + manifest JSON to onboard or update one bag model. |
| **Manifest** | `manifest.json` inside an asset pack. Lists views, zones, layer order, handle paths. |
| **Handle path** | Polyline (skeleton) describing a handle's shape. Used to render stripes/patterns along the handle. |
| **Handle preset** | A named pattern (stripe widths + colors) applicable to any handle. Global table `handle_pattern_presets`. |
| **U/V** | Parametric coords along a handle. **U** = position along the handle length (0→1). **V** = position across the handle width. Stripe color = f(U) ONLY; never f(V). |
| **Side part** | A separate handle segment with its own path (e.g. left/right strap), in `handle_side_parts`. |
| **Embroidery** | A decorative overlay placed on a zone. Rows in `embroideries` and `embroidery_placements`. |
| **Compatibility rule** | A row in `compatibility_rules` constraining which fabrics/handles can be combined for a given model. |
| **Layer order rule** | A per-view override of the default z-index sequence. Stored in `layer_order_rules`. |
| **Configuration** | A user's saved combination of choices. Row in `configurations`. Persisted before handoff to Shopify. |
| **Line Item Property** | Shopify cart attribute that carries the configuration ID and a preview URL into checkout. |
| **Seamless texture** | A tileable fabric image. Generated either by upload or by `seamless-from-photo` edge function via Gemini. |
| **Mask Tool** | Internal admin route `/mask-tool` that auto-segments handle skeletons via tangent analysis. |
| **Asset Pack ZIP canonico** | The single-source-of-truth ZIP format. Onboards a bag model in one upload. See ADR 0003. |
