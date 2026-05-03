---
name: 08-admin-backend
description: /admin pages, capabilities, and the unified upload flow.
type: long-term
updated: 2026-05-03
status: VERIFIED
priority: medium
---

# 08 — Admin Backend

Routes mounted under `/admin` (see `src/App.tsx`). All admin pages are React, using shadcn components and `react-query` for data fetching.

## Pages (current)

| Route | Page | Purpose |
|---|---|---|
| `/admin` | `AdminDashboard` | Index, stats, shortcuts |
| `/admin/models` | `AdminModels` | CRUD on bag models |
| `/admin/fabrics` | `AdminFabrics` | Fabrics + colors editor |
| `/admin/handle-styles` | `AdminHandleStyles` | **Unified** handle styles + textures (recently merged) |
| `/admin/handle-editor` | `AdminHandleEditorIndex` | Pick a view to edit |
| `/admin/handle-editor/:viewId` | `AdminHandleEditor` | Per-view skeleton/path editor |
| `/admin/texture-lab` | `AdminTextureLab` | AI texture generation (calls `seamless-from-photo`, `enhance-texture`) |
| `/admin/upload` | `AdminUpload` | **Asset Pack ZIP onboarding (single source of truth)** |

Legacy redirects for backward compatibility:

- `/admin/handles` → handles redirect
- `/admin/handle-presets` → handle-styles
- `/admin/handle-textures` → handle-styles

## Upload flow (the canonical path)

`/admin/upload` is the **only** way to onboard or update a bag model. Do not add alternative pages or per-asset uploads. See ADR 0003.

The page:

1. Accepts a ZIP drag-drop.
2. Parses with `jszip` (`src/lib/assetPack.ts`).
3. Shows a validation report (per view: dim check, manifest check, mask alignment).
4. On confirm, uploads PNGs to Storage and upserts catalog rows.
5. Renders a success summary with model slug + asset counts.

## Mask Tool (`/mask-tool`)

Internal helper that:

- Accepts a handle reference image.
- Auto-segments the skeleton via tangent analysis.
- Lets the operator tweak waypoints.
- Uploads the resulting handle path JSON directly to Supabase.

Useful when prepping inputs for the Asset Pack ZIP.

## Auth gating (current state)

> **STATUS: KNOWN ISSUE** — admin routes are not yet behind auth. See `short-term/known-issues.md`. Plan: add `user_roles` table with `admin` role, route guard via `has_role(auth.uid(), 'admin')`, and tighten RLS on write paths. See `skills/create-rls-policy.md`.
