---
name: 02-architecture
description: Tech stack, runtime topology, deploy targets, and where each piece lives.
type: long-term
updated: 2026-05-03
status: VERIFIED
priority: high
---

# 02 — Architecture

## Stack

| Layer | Tech | Version |
|---|---|---|
| Framework | React | 18.3 |
| Build tool | Vite | 5 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 3 |
| UI primitives | shadcn/ui (Radix) | latest |
| Routing | react-router-dom | 6.30 |
| Data fetching | @tanstack/react-query | 5.83 |
| Forms | react-hook-form + zod | 7.61 / 3.25 |
| Backend | Supabase (Postgres + Auth + Storage + Edge Fns) | via Lovable Cloud |
| Edge runtime | Deno | (Supabase managed) |
| AI | Lovable AI Gateway (Gemini 2.5 / 3.x preview) | gateway-managed |
| Canvas helpers | native HTML5 Canvas 2D + jszip | — |
| Test | Vitest + Testing Library | latest |

## Runtime topology

```
Browser (SPA)
  ├── Public pages       → render configurator
  ├── /admin/*           → catalog management
  └── @supabase/supabase-js
        │
        ├── Postgres (RLS-gated)        ← read/write catalog + configurations
        ├── Storage (public bucket)     ← PNG assets, masks, generated textures
        └── Edge Functions
              ├── seamless-from-photo   → Gemini image gen (Lovable AI Gateway)
              ├── enhance-texture       → Gemini image enhance
              └── analyze-handle-geometry → Gemini structured analysis

Shopify Storefront
  └── Cart (Line Item Properties: configuration_id, preview_url)
```

## Where things live

| Concern | Path |
|---|---|
| Routing entry | `src/App.tsx` |
| Public configurator | `src/pages/Index.tsx` |
| Engine demo | `src/pages/EngineDemo.tsx` |
| Admin shell | `src/pages/admin/AdminLayout.tsx` |
| Admin pages | `src/pages/admin/*` |
| Rendering core | `src/engine/` |
| Supabase client | `src/integrations/supabase/client.ts` (auto-gen, **do not edit**) |
| Generated DB types | `src/integrations/supabase/types.ts` (auto-gen, **do not edit**) |
| Migrations | `supabase/migrations/*.sql` |
| Edge functions | `supabase/functions/*/index.ts` |
| Design tokens | `src/index.css`, `tailwind.config.ts` |

## Routes (current)

```
/                       Public configurator
/engine-demo            Engine playground
/admin                  Admin dashboard
/admin/models           Bag models CRUD
/admin/fabrics          Fabrics + colors
/admin/handle-styles    Unified handle styles + textures
/admin/handle-editor    Per-view handle path editor
/admin/handle-editor/:viewId
/admin/texture-lab      AI texture generation
/admin/upload           Asset Pack ZIP onboarding (single source of truth)
*                       NotFound
```

Some legacy routes (`/admin/handles`, `/admin/handle-presets`, `/admin/handle-textures`) redirect to the unified pages.

## Build & deploy

- **Dev**: `bun dev` (Vite). The dev server reloads automatically.
- **Build**: `bun run build` (run automatically by the Lovable harness).
- **Deploy**: edge functions auto-deploy on save. The SPA is served by Lovable's preview/published infrastructure.

## Environment variables

Auto-injected, read from `.env` (do not edit):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Edge function secrets read via `Deno.env.get(...)`. `LOVABLE_API_KEY` is auto-provisioned for the AI Gateway.
