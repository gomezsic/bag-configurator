---
name: RULES
description: Hard rules the agent must follow. Coding standards, safety constraints, and stop conditions.
type: rules
updated: 2026-05-03
status: VERIFIED
priority: critical
---

# RULES

## Coding rules (must follow)

### Stack invariants

- **Framework**: React 18 + Vite 5 + TypeScript 5. Never propose Next/Nuxt/Angular/Svelte.
- **Styling**: Tailwind v3 + shadcn/ui. All colors must come from the design tokens in `src/index.css` and `tailwind.config.ts`. No raw hex/`text-white`/`bg-black` in components. Tokens are HSL.
- **Backend**: Supabase via Lovable Cloud. The project is decoupled from Shopify; Shopify only handles checkout via Line Item Properties.
- **Imports**: `@/integrations/supabase/client` for the Supabase JS client. Never edit `client.ts` or `types.ts` — they are auto-generated.

### Database

- Schema changes go through `supabase/migrations/` only. Never run direct DDL except for read-only inspection.
- RLS must be ON for every table. Public-read is acceptable only for catalog tables (`bag_models`, `fabrics`, etc.) and must be explicit.
- Roles live in a separate `user_roles` table. **Never** store roles on a profile/users row (privilege escalation).
- Use `SECURITY DEFINER` `has_role()` functions in policies, never inline subqueries on `user_roles` (recursive RLS).

### Rendering engine

- Z-index order is **immutable**: `Base < Fabric < Handle < Embroidery < Shadows/Highlights < Details`. See `long-term/04-rendering-engine.md`.
- All PNGs of the same view must have identical dimensions and pixel-perfect alignment. Mismatch = hard error in `assetValidator.ts`.
- Mask feathering: 1–3px Gaussian blur. Never sharp-edged.
- Handle stripes: longitudinal continuous bands, color = f(U) only, constant in V. Never tile along V.

### Assets

- Bag asset import is **only** via `/admin/upload` with the canonical ZIP. No piecemeal uploads of presets or handle paths through other admin pages.
- ZIP upsert must be **idempotent**: re-uploading the same pack produces no duplicates.

### Pricing

- Price is a function of `(bag_model, fabric_type)` ONLY. Handles, colors, embroideries do NOT affect price. See ADR 0004.

## Safety rules (stop conditions)

The agent MUST stop and ask explicit confirmation before:

- Deleting or truncating any database row outside a strictly-scoped migration.
- Dropping tables, columns, or constraints.
- Disabling RLS on any table.
- Modifying authentication or session handling.
- Changing pricing logic, payment flow, or anything user-facing about money.
- Bulk email sending or any code that triggers external notifications.
- Touching Supabase reserved schemas (`auth`, `storage`, `realtime`, `supabase_functions`, `vault`).
- Editing auto-generated files: `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `.env`.

## Anti-patterns (banned)

- ❌ CHECK constraints with non-immutable expressions (`now()`, etc.). Use validation triggers instead.
- ❌ Anonymous Supabase signups.
- ❌ Auto-confirm email signups unless explicitly requested.
- ❌ Storing roles in `profiles`.
- ❌ `localStorage`-based admin checks.
- ❌ Loading the whole `/Memory/` wiki at once. Use the router and load on relevance.

## Risk classification

Every task gets a label. When unclear, pick the higher tier.

| Tier | Examples | Behavior |
|---|---|---|
| `SAFE_DOCS_ONLY` | Wiki edits, README | Just do it |
| `SAFE_UI_ONLY` | CSS, copy, layout tweaks | Just do it |
| `STANDARD_FEATURE` | New page, new component, non-destructive query | Plan briefly, then do it |
| `DATABASE_CHANGE` | Migration, new table, RLS edit | Plan + show SQL preview, get confirmation |
| `HIGH_RISK_DATA` | Touches existing user data, configurations | Explicit confirmation, dry-run first |
| `SECURITY_CRITICAL` | Auth, roles, RLS removal, secret handling | Stop, propose plan, wait for explicit go |
