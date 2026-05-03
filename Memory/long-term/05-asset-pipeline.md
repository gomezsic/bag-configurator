---
name: 05-asset-pipeline
description: Canonical ZIP asset pack format, manifest schema, upload flow, idempotent upsert.
type: long-term
updated: 2026-05-03
status: VERIFIED
priority: high
---

# 05 — Asset Pipeline

Single source of truth for onboarding/updating a bag model: the **canonical Asset Pack ZIP** uploaded via `/admin/upload`. No piecemeal alternative is supported.

## Why a single ZIP

- Atomicity: a model either fully onboards or fails — no half-loaded states.
- Idempotency: re-uploading the same pack updates without duplicating.
- Auditability: one file = one snapshot of the model.

See ADR 0003.

## ZIP structure

```
my-model.zip
├── manifest.json              # the contract
├── views/
│   ├── front/
│   │   ├── body_front.png        # base
│   │   ├── side_<zone>.png       # masks (canonical name: side_<zone> or zone_<name>)
│   │   ├── handle_front.png
│   │   └── details_front.png
│   ├── back/    …
│   ├── side/    …
│   └── top/     …
├── handles/
│   └── handle_<view>_path.json   # optional explicit skeletons
└── handle_presets/
    └── <preset_name>.json        # optional global stripe presets
```

## Canonical naming (and legacy aliases)

| Canonical | Legacy aliases accepted |
|---|---|
| `body_<view>.png` | `base_<view>.png`, `bag_<view>.png` |
| `side_<zone>.png` | `mask_<zone>.png`, `zone_<zone>.png` |
| `handle_<view>.png` | `manico_<view>.png` |

Aliases are normalized at parse time. New packs should use canonical names.

## manifest.json shape (informal)

```jsonc
{
  "model": { "slug": "city", "name": "City", "base_price_cents": 12000 },
  "views": [
    {
      "name": "front",
      "base_image": "views/front/body_front.png",
      "zones": [
        { "name": "main_body", "mask_image": "views/front/side_main_body.png",
          "transform": { "scale": 1, "rotate": 0, "u_offset": 0, "v_offset": 0 } }
      ],
      "handle": { "path": "handles/handle_front_path.json" }
    }
  ],
  "handle_presets": [
    { "name": "navy-cream-stripes", "stripes": [ ["#0a1f44", 0.6], ["#f0e8d8", 0.4] ] }
  ]
}
```

## Upload flow (`src/lib/assetPack.ts` + `/admin/upload`)

```
1. User drops ZIP into /admin/upload
2. Client unzips with jszip
3. Validate: PNG dims match per view; manifest schema valid; alias normalization
4. For each PNG: upload to Storage (public bucket), get URL
5. Upsert into bag_models, bag_views, mask_zones, handle_geometries, handle_pattern_presets
   — all keyed on (model_slug, view_name, zone_name) so re-uploads are idempotent
6. Run validator (assetValidator) one more time server-side; on failure rollback the model row
```

## Validation rules

- All PNGs of a view must have **identical width/height and alignment**.
- Masks must be 8-bit grayscale (single channel) or RGB with R=G=B.
- `manifest.json` must reference every PNG present and vice-versa (no orphans).

## Common failures

| Symptom | Cause |
|---|---|
| "dimensions mismatch in view X" | one PNG was re-exported with different canvas size |
| "missing zone mask" | manifest names a zone with no corresponding PNG |
| "handle path out of bounds" | skeleton coords beyond the view's image rectangle |

## Tech debt

`src/lib/assetPack.ts` is ~950 LOC. Candidate for split into `parser.ts` + `validator.ts` + `uploader.ts`. See `short-term/known-issues.md`.
