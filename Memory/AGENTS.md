---
name: AGENTS
description: Entry point and router for the project's LLM wiki. Always read this file first.
type: router
updated: 2026-05-03
status: VERIFIED
priority: critical
---

# AGENTS.md — Project Memory Router

> **Read order on every new session**: this file → `PERSONA.md` → `RULES.md` → topical files referenced below.

This is a **2D bag configurator** (custom Supabase backend) decoupled from a Shopify storefront that handles checkout. The codebase is a Vite + React 18 + TypeScript SPA with edge functions for AI-assisted asset generation.

## How to use this wiki

The wiki under `/Memory/` is the agent's persistent brain. Each file has a YAML front matter with:

- `name` — identifier
- `description` — one-line summary used for relevance matching
- `type` — `router | identity | rules | long-term | short-term | skill | decision | glossary`
- `updated` — ISO date of last meaningful change
- `status` — `VERIFIED | DRAFT | NEEDS_REVIEW | OBSOLETE`

**Discovery rule**: before answering any non-trivial question, scan front matter `description` fields of files in this directory and load the relevant ones into context. Do NOT load the entire wiki blindly.

## File map

### Identity & rules (always loaded)

| File | Purpose |
|---|---|
| [PERSONA.md](./PERSONA.md) | Agent identity, language, tone, communication style |
| [RULES.md](./RULES.md) | Coding rules, safety rules, stop conditions |
| [PERMISSIONS.md](./PERMISSIONS.md) | What the agent can/cannot touch without confirmation |
| [GLOSSARY.md](./GLOSSARY.md) | Domain terms (zones, U/V, handle stripes, asset pack…) |

### Long-term memory (architecture — load on relevance)

| File | When to load |
|---|---|
| [long-term/01-overview.md](./long-term/01-overview.md) | "What is this project?" |
| [long-term/02-architecture.md](./long-term/02-architecture.md) | Stack, deploy, runtime questions |
| [long-term/03-database.md](./long-term/03-database.md) | Tables, RLS, migrations, schema changes |
| [long-term/04-rendering-engine.md](./long-term/04-rendering-engine.md) | Canvas pipeline, z-index, masks, feathering |
| [long-term/05-asset-pipeline.md](./long-term/05-asset-pipeline.md) | ZIP upload, manifest, naming convention |
| [long-term/06-edge-functions.md](./long-term/06-edge-functions.md) | seamless-from-photo, gemini, AI gateway |
| [long-term/07-shopify-integration.md](./long-term/07-shopify-integration.md) | Cart, line item properties, checkout handoff |
| [long-term/08-admin-backend.md](./long-term/08-admin-backend.md) | /admin pages, mask-tool, upload flow |

### Short-term memory (current state — load every session)

| File | Refresh cadence |
|---|---|
| [short-term/current-sprint.md](./short-term/current-sprint.md) | Per sprint |
| [short-term/recent-changes.md](./short-term/recent-changes.md) | Append-only, last 20 entries |
| [short-term/known-issues.md](./short-term/known-issues.md) | When bugs are filed/closed |

### Skills (procedures — load on intent match)

| Skill | Triggers when user asks to… |
|---|---|
| [skills/add-new-bag-model.md](./skills/add-new-bag-model.md) | …add/onboard a new bag model |
| [skills/upload-asset-pack.md](./skills/upload-asset-pack.md) | …upload textures, masks, ZIP packs |
| [skills/debug-handle-stripes.md](./skills/debug-handle-stripes.md) | …fix striped/patterned handles |
| [skills/create-rls-policy.md](./skills/create-rls-policy.md) | …secure a table, add policies |
| [skills/deploy-edge-function.md](./skills/deploy-edge-function.md) | …add or modify an edge function |

### Decisions (ADRs — append-only, never delete)

| ADR | Topic |
|---|---|
| [decisions/0001-supabase-over-firebase.md](./decisions/0001-supabase-over-firebase.md) | Backend choice |
| [decisions/0002-canvas-2d-over-webgl.md](./decisions/0002-canvas-2d-over-webgl.md) | Rendering tech |
| [decisions/0003-zip-asset-pack-canonico.md](./decisions/0003-zip-asset-pack-canonico.md) | Asset onboarding |
| [decisions/0004-prezzo-solo-modello-tessuto.md](./decisions/0004-prezzo-solo-modello-tessuto.md) | Pricing model |

## Update protocol

When the agent makes a meaningful change to the codebase, it MUST:

1. Append a one-line entry to `short-term/recent-changes.md`.
2. If the change touches architecture, update the corresponding `long-term/*.md` file and bump its `updated` date.
3. If the change introduces a non-obvious decision, create a new ADR under `decisions/` (never edit existing ADRs — supersede them).
4. If a documented rule was learned the hard way (e.g. a regression), add it to `RULES.md` or the relevant skill.

## Anti-hallucination

If a file states something the agent cannot verify in the current code, it MUST be marked `STATUS: NEEDS_REVIEW` and the agent must inspect the code before acting on that information.
