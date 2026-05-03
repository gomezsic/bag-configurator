---
name: upload-asset-pack
description: Upload or update a bag model's assets via the canonical ZIP at /admin/upload.
type: skill
updated: 2026-05-03
status: VERIFIED
trigger: User wants to upload textures/masks/handle paths for a model.
risk: STANDARD_FEATURE
---

# Skill: Upload an Asset Pack

## When to use

Any time assets for a bag model change: new view, retouched mask, updated handle skeleton, new global stripe preset.

## Hard rule

**The ZIP is the only entry point.** Do not add per-file uploads or per-asset admin UIs. See ADR 0003.

## Steps

1. Build the ZIP per `long-term/05-asset-pipeline.md`.
2. Open `/admin/upload`.
3. Drop the ZIP — wait for the validation report.
4. If validation fails, fix the ZIP locally and re-drop. The upsert is idempotent so re-running is safe.
5. On success, the page shows updated counts (views, zones, presets).

## Idempotency contract

Re-uploading the same pack:

- Updates rows keyed on `(model_slug, view_name, zone_name)` and `(preset_name)`.
- Replaces Storage objects at the same path.
- Does **not** create duplicates.

## Validation checklist (what the parser checks)

- [ ] `manifest.json` parses
- [ ] All PNGs of a view share width × height
- [ ] All zones in the manifest have a corresponding mask PNG
- [ ] No orphan PNGs (every PNG referenced by manifest)
- [ ] Handle paths (if present) lie within the view's image rect
- [ ] Stripe preset arrays sum to 1.0 (within ε)

## Recovery

If the upsert errors mid-way, the parser rolls back the model row (best-effort). Storage objects already uploaded may remain — re-run the same ZIP to reconcile.
