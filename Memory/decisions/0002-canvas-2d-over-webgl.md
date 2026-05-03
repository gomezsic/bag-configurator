---
name: ADR-0002
description: Why the rendering engine uses Canvas 2D instead of WebGL.
type: decision
updated: 2026-04-12
status: ACCEPTED
supersedes: null
---

# ADR 0002 — Canvas 2D over WebGL

## Context

The configurator renders 4 views per bag with multiple textured zones, masks, handle stripes, embroidery, shadows, and details. Output must be deterministic, exportable as PNG (for Shopify preview), and authored by a small team.

## Decision

Use **HTML5 Canvas 2D** for the entire pipeline.

## Why not WebGL

- 2D compositing with masks and `globalCompositeOperation` covers our current needs.
- WebGL adds shader authoring overhead and a steep ramp for the team.
- Visual goals so far do not require lighting/normal maps.

## When to revisit

Revisit (likely as ADR-0006) when:

- We need normal-map / subsurface effects to reach photoreal fidelity (see `short-term/known-issues.md` VIS-1).
- Frame budget regresses below 60 ms even after Web Worker move (PERF-1).

## Consequences

- ✅ Simpler code, easier to debug, deterministic output.
- ✅ All engineers can read the engine.
- ⚠️ Performance ceiling on long handle stripe passes (mitigated by Worker plan).
- ⚠️ No GPU-accelerated effects.
