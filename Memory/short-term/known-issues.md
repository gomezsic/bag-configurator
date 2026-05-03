---
name: known-issues
description: Open bugs, technical debt, performance hotspots, security gaps.
type: short-term
updated: 2026-05-03
status: VERIFIED
priority: high
---

# Known Issues

## Security

| ID | Severity | Issue | Plan |
|---|---|---|---|
| SEC-1 | high | `/admin/*` routes are not auth-gated | Add `user_roles` table + `has_role()` SECURITY DEFINER + route guard + tighten write RLS |
| SEC-2 | medium | Catalog write RLS policies are permissive | Limit to `has_role(auth.uid(), 'admin')` on INSERT/UPDATE/DELETE |

## Performance

| ID | Severity | Issue | Plan |
|---|---|---|---|
| PERF-1 | medium | First-render frame budget ~120 ms (handle stripe pass dominates) | Move to Web Worker; LRU-cache tiled textures |
| PERF-2 | low | Texture re-tile on every render even when zone+fabric unchanged | Memoize by `(fabric_id, zone_id, scale)` |

## Tech debt

| ID | File | Issue |
|---|---|---|
| DEBT-1 | `src/lib/assetPack.ts` | ~950 LOC; split into parser/validator/uploader |
| DEBT-2 | `src/engine/layerComposer.ts` | implicit z-index defaults; consider extracting a `LayerOrderResolver` |

## Visual fidelity

| ID | Issue | Plan |
|---|---|---|
| VIS-1 | Output is "limited"; lacks subsurface/normal-map cues | Roadmap: add normal maps, evaluate WebGL once needed (not this sprint) |
| VIS-2 | Mask seams occasionally show 1-px stepping under aggressive scaling | Verify feathering is applied after resampling, not before |

## Onboarding UX

| ID | Issue | Plan |
|---|---|---|
| UX-1 | ZIP authoring is opaque to non-technical operators | Provide a downloadable template ZIP + a video walk-through; consider an in-app authoring tool later |
