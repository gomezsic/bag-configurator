---
name: 03-database
description: Postgres schema, table-by-table reference, RLS posture, migration practices.
type: long-term
updated: 2026-05-03
status: VERIFIED
priority: high
---

# 03 — Database

Hosted Postgres on Supabase via Lovable Cloud. Single `public` schema. All tables have RLS enabled.

## Tables (verified via `information_schema`)

| Table | Purpose |
|---|---|
| `bag_models` | Bag SKUs (City, Tote, …). Catalog. |
| `bag_views` | Per-model views (front/back/side/top) with base PNG references. |
| `mask_zones` | Maskable regions per view; holds mask URL + transform params. |
| `fabrics` | Fabric catalog (pattern/material). |
| `fabric_colors` | Color variants for each fabric. |
| `handles` | Handle catalog. |
| `handle_colors` | Color variants for handles. |
| `handle_geometries` | Per-view handle skeleton (polyline + width). |
| `handle_pattern_presets` | Global named stripe presets (color sequences). |
| `handle_side_parts` | Extra handle segments with own paths (left/right straps). |
| `cord_collection` | Cord catalog. |
| `cord_handle_compatibility` | Which cords fit which handles. |
| `embroideries` | Embroidery catalog. |
| `embroidery_placements` | Where each embroidery can sit per view. |
| `compatibility_rules` | Allowed (model, fabric, handle, …) combinations. |
| `layer_order_rules` | Per-view z-index overrides. |
| `pricing_rules` | Price = f(bag_model, fabric_type). See ADR 0004. |
| `configurations` | User-saved configurations (handed to Shopify cart). |

> **STATUS: VERIFIED** — table list pulled live from `information_schema.tables` on 2026-05-03.

## Naming conventions

- `snake_case` everywhere.
- Foreign keys: `<entity>_id`.
- Boolean flags: `is_<state>` or `has_<thing>`.
- Timestamps: `created_at`, `updated_at` (TIMESTAMPTZ default `now()`).

## RLS posture

- RLS is **ON** on every table.
- Catalog tables (`bag_models`, `fabrics`, `handles`, …) currently have **public read** policies — this is intentional (the configurator reads catalog without auth).
- Write policies are currently permissive on the admin side. **Known issue**: admin gating is not yet enforced server-side. See `short-term/known-issues.md`.

## Roles

Roles **must** live in a dedicated `user_roles` table with `app_role` enum. Use `has_role(uuid, app_role)` `SECURITY DEFINER` function inside policies. **Never** put roles on a profile/users row. See `RULES.md` and `skills/create-rls-policy.md`.

## Migrations

- Files: `supabase/migrations/<timestamp>_<slug>.sql`.
- 25 migrations on record (see `ls supabase/migrations`).
- Apply via `supabase--migration` tool. Direct DDL outside migrations is forbidden except for read-only inspection.
- Never include `ALTER DATABASE postgres ...` statements.
- Validation logic that depends on `now()` (e.g. expiry) **must** use a trigger, never a CHECK constraint (CHECK must be immutable; using `now()` breaks restore).

## Storage

Public bucket holds PNGs (bases, masks, overlays, textures). Path convention is enforced by the asset pack uploader; see `long-term/05-asset-pipeline.md`.

## Realtime

Not currently enabled. If/when needed, add the table to `supabase_realtime` publication and adjust RLS for realtime read.
