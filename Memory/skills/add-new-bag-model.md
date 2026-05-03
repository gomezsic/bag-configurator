---
name: add-new-bag-model
description: Procedure to onboard a brand-new bag model end-to-end.
type: skill
updated: 2026-05-03
status: VERIFIED
trigger: User asks to add a new bag model, new SKU, new shape.
risk: STANDARD_FEATURE (DATABASE_CHANGE if schema needs extending)
---

# Skill: Add a new bag model

## When to use

The user wants to introduce a new physical bag (e.g. "Tote Mini") to the configurator catalog.

## Inputs required from the user

1. Model slug (kebab-case) and display name
2. Base price in cents (price stays a function of `(model, fabric_type)` — see ADR 0004)
3. The four view PNGs (front/back/side/top) — same dimensions
4. A mask PNG per zone, per view — same dimensions as the base
5. (Optional) handle skeleton JSON per view
6. (Optional) global handle stripe presets to add

## Steps

1. **Author the Asset Pack ZIP** following `long-term/05-asset-pipeline.md` structure. Validate dim consistency locally if possible.
2. **Verify pricing rule** exists in `pricing_rules` for each `(model, fabric_type)` you intend to support. If not, create migration.
3. **Upload via `/admin/upload`** — this is the only supported entry point. Do not add rows manually.
4. **Validate render**: open `/engine-demo`, pick the new model, walk all views; confirm:
   - z-index correct
   - no mask seams
   - handle stripes longitudinal (color = f(U), not f(V))
5. **Compatibility rules**: add rows to `compatibility_rules` for allowed (model, fabric, handle) combos.
6. **Shopify**: ensure a Shopify product exists with variants matching `(model, fabric_type)`. The configurator handoff relies on variant lookup — see `long-term/07-shopify-integration.md`.
7. **Smoke test**: end-to-end run from the public configurator → preview render → cart push.

## Common gotchas

- Mismatched PNG dimensions across views ⇒ validator throws. Re-export at identical canvas size.
- Forgetting to add a `pricing_rules` row ⇒ checkout will fail silently (variant not found).
- Adding a new zone but no mask ⇒ render will leak fabric outside the intended region.

## After completion

- Append a line to `short-term/recent-changes.md`.
- If the model required new schema (rare), update `long-term/03-database.md`.
