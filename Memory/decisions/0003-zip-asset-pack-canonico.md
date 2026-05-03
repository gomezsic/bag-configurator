---
name: ADR-0003
description: Asset onboarding via a single canonical ZIP at /admin/upload, not piecemeal uploads.
type: decision
updated: 2026-04-25
status: ACCEPTED
supersedes: null
---

# ADR 0003 — Canonical Asset Pack ZIP

## Context

Earlier admin pages allowed per-asset uploads (a mask here, a preset there, a handle path elsewhere). This produced inconsistent states (mask uploaded but manifest forgotten; handle path replaced but base PNG resized).

## Decision

The **only** way to onboard or update a bag model's assets is the canonical Asset Pack ZIP uploaded via `/admin/upload`.

## Rules

- ZIP includes everything: bases, masks, handle paths, presets, manifest.
- Re-upload is idempotent (upsert keyed on slug/view/zone/preset name).
- Validation happens client-side (jszip parse + dim check) and server-side after upload.
- No alternative upload paths in admin. Legacy admin pages either redirect to the unified pages or have their upload UI removed.

## Consequences

- ✅ Atomic onboarding; no half-loaded states.
- ✅ Simpler mental model for operators.
- ⚠️ Higher friction for tiny edits (must rebuild ZIP).
- ⚠️ ZIP authoring is currently opaque to non-technical users (UX-1 in known-issues). Mitigation roadmap: template ZIP + walkthrough; later, in-app authoring tool.
