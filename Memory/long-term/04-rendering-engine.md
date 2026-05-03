---
name: 04-rendering-engine
description: Canvas 2D pipeline, layer order, masks, feathering, handle stripe math.
type: long-term
updated: 2026-05-03
status: VERIFIED
priority: high
---

# 04 — Rendering Engine

Source: `src/engine/`.

## Files

| File | Role |
|---|---|
| `index.ts` | Public engine API |
| `types.ts` | TS types (Layer, View, RenderSpec, …) |
| `assetLoader.ts` | Loads PNGs from Storage, caches by URL |
| `assetValidator.ts` | Verifies all PNGs of a view share dimensions and alignment |
| `layerComposer.ts` | Core: composes a view by walking the layer list in z-order |
| `textureRenderer.ts` | Tiles a fabric into a zone, applies mask + feathering |
| `handlePath.ts` | Skeleton math (segments, tangents, U-parameter) |
| `handlePreset.ts` | Resolves a preset (stripe widths/colors) into a paint plan |
| `handleStripeRenderer.ts` | Paints longitudinal stripes along a handle |
| `sidePartPathFallback.ts` | Generates a path for side parts when none is supplied |

## Pipeline (per view)

```
1. Load all assets for the view (validated to share dims)
2. Resolve layer order (default + layer_order_rules override)
3. For each layer, in z-order:
     a. Draw base PNG, OR
     b. Tile fabric texture clipped by mask (with feathering), OR
     c. Render handle stripes along skeleton, OR
     d. Stamp embroidery overlay
4. Composite shadows/highlights on top
5. Final detail PNGs (zips, rivets) on the very top
6. Output = single Canvas2D bitmap
```

## Z-index (immutable)

```
Base  <  Fabric  <  Handle  <  Embroidery  <  Shadows/Highlights  <  Details
```

This order is enforced as a default in `layerComposer.ts` and may be overridden per-view via `layer_order_rules`. **Do not reorder without an ADR.**

## Mask handling

- Masks are grayscale PNGs (white = include, black = exclude).
- Applied via `globalCompositeOperation = 'destination-in'` after rendering the textured layer.
- Feathering: 1–3 px blur on the mask edge before applying. Sharp edges = banned.
- All mask PNGs of a view must share dimensions and pixel alignment with the base. Mismatch = `assetValidator` throws.

## Handle stripes (load-bearing rule)

Stripes are **longitudinal continuous bands**:

- Color = f(U), constant in V. (U = along the handle length, V = across the width.)
- Never tile, checker, or block along V.
- Implemented in `handleStripeRenderer.ts` via a nearest-neighbor skeleton segmentation that walks U at high resolution and paints a 1-pixel-wide perpendicular stroke at each step, colored by the preset's stripe table.
- Feathering applied to handle edges to avoid stepped silhouettes.

See `skills/debug-handle-stripes.md` and `decisions/0002-canvas-2d-over-webgl.md`.

## Performance

- Current frame budget: ~120 ms on first render of a view, ~30–50 ms on subsequent renders (asset cache hit).
- Bottleneck: handle stripe pass on long polylines.
- Improvement candidates documented in `short-term/known-issues.md`:
  - Move stripe pass to a Web Worker.
  - LRU cache for tiled textures keyed by `(fabric_id, zone_id, scale)`.
  - Move to WebGL once normal-map support is needed (ADR-grade decision; not now).
