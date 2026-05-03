---
name: debug-handle-stripes
description: Diagnose and fix striped/patterned handle rendering issues.
type: skill
updated: 2026-05-03
status: VERIFIED
trigger: User reports stripes wrong, blocky, tiled, off-direction, or mis-colored.
risk: STANDARD_FEATURE
---

# Skill: Debug handle stripes

## The invariant

Stripes are **longitudinal continuous bands**. Color is a function of **U only** (position along the handle length). They are **constant in V** (across the width).

If the output shows blocks, checkers, or tiles along the length, the implementation has regressed against this rule.

## Quick triage

| Symptom | Likely cause | Where to look |
|---|---|---|
| Stripes appear as squares/blocks | Painter is tiling along V | `handleStripeRenderer.ts` — confirm V is not used in color lookup |
| Stripes run perpendicular to length | U/V swapped | `handlePath.ts` — verify tangent direction |
| Color sequence wrong | Preset not resolved correctly | `handlePreset.ts` — confirm stripes array order and widths sum |
| Stepped edges | Feathering missing | Apply 1–3 px blur at handle edge mask |
| Stripe widths wrong | Preset widths not normalized | Widths must sum to 1.0 |

## Verification procedure

1. Open `/engine-demo`, pick a model with handles.
2. Apply a high-contrast 2-color preset (e.g. black/white 50/50).
3. Confirm visually: bands run **along** the handle, full-width, color changes only as you move along the length.
4. Try a 4-stripe preset to confirm sequencing.

## Gotchas

- Skeleton with very tight curves may produce non-monotonic U if segmentation is bad. Use `/mask-tool` to re-extract the path.
- Side parts (`handle_side_parts`) have their own paths — debug per-segment.
