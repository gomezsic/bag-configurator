---
name: PERMISSIONS
description: What the agent may modify autonomously vs. what requires explicit user confirmation.
type: rules
updated: 2026-05-03
status: VERIFIED
priority: high
---

# PERMISSIONS

## Auto-allow (no confirmation needed)

- `src/components/**` — UI components
- `src/pages/**` (except admin) — pages
- `src/index.css`, `tailwind.config.ts` — design tokens (additive only; do not remove existing tokens without confirmation)
- `src/lib/**` (utility helpers)
- `src/engine/**` for non-breaking improvements (e.g. perf, logging)
- `Memory/**` — wiki updates and ADR creation
- `supabase/functions/**` — edge functions: create new, modify own logic
- Read-only DB queries via `supabase--read_query`

## Require confirmation

- New migration in `supabase/migrations/`
- Any change to `src/pages/admin/**` that modifies upload/import flow
- Adding/removing dependencies (`bun add`, `bun remove`)
- Touching `src/engine/layerComposer.ts` z-index logic
- Modifying handle stripe rendering math (`handleStripeRenderer.ts`)
- ZIP asset pack format changes (`src/lib/assetPack.ts`)
- RLS policies (creation, alteration, removal)
- Auth configuration (`supabase--configure_auth`)
- Adding or rotating secrets

## Hard-forbidden (will refuse and explain)

- Editing `src/integrations/supabase/client.ts`
- Editing `src/integrations/supabase/types.ts`
- Editing `.env`
- Storing `service_role` key in client code
- Disabling RLS on tables containing user data
- Storing roles on `profiles` or any non-`user_roles` table
- Operating on Supabase reserved schemas (`auth`, `storage`, `realtime`, `supabase_functions`, `vault`)
- Anonymous signups
- Hardcoded admin credentials or `localStorage`-based admin gates

## Secrets & keys

- **Publishable/anon key**: may live in client code (`VITE_SUPABASE_PUBLISHABLE_KEY`).
- **Service role / private API keys**: only in edge functions via `Deno.env`. Never echo or log.
- Before adding code that needs a new secret, check `secrets--fetch_secrets` first; if missing, request via `secrets--add_secret`.

## Tool usage rules

- Run security scans (`security--run_security_scan`) after any RLS or auth change.
- Run `supabase--linter` after any migration.
- Use `supabase--cloud_status` if the backend behaves oddly before debugging app code.
