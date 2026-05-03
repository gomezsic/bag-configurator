---
name: 01-overview
description: What this project is, who uses it, and what problem it solves. Start here.
type: long-term
updated: 2026-05-03
status: VERIFIED
priority: high
---

# 01 — Project Overview

## What it is

A **2D bag configurator** for a fashion/leather goods brand. Customers pick a bag model, customize fabrics/handles/embroideries through a 6-step wizard, and check out via Shopify. The configurator is custom-built; Shopify only handles the cart and payment.

## Who uses it

| Persona | Surface | Auth |
|---|---|---|
| **End customer** | Public site (Shopify storefront iframe + configurator SPA) | Anonymous |
| **Admin / catalog manager** | `/admin/*` routes | (currently open — see `short-term/known-issues.md`) |

## Top-level flow

```
Customer → Configurator (6 steps) → save Configuration → Shopify cart
                                  ↘ render preview PNG → Line Item Property
```

## 6 wizard steps

1. **Modello** — choose bag model
2. **Tessuto** — choose fabric per zone
3. **Manici** — choose handle style (and pattern preset if applicable)
4. **Ricamo** — optional embroidery
5. **Riepilogo** — review
6. **Conferma** — push to Shopify cart

State is held in a central React store and persisted to `configurations` on submit.

## Pricing rule (load-bearing)

**Price = f(bag_model, fabric_type)** — nothing else. Handles, colors, embroidery do not modify price. See ADR 0004.

## What is NOT here

- No custom checkout, payments, shipping, or tax. All Shopify.
- No customer accounts. All anonymous configurations (Shopify holds the customer record).
- No 3D rendering. Pure 2D Canvas. See ADR 0002.

## Repository top-level

```
src/                    React SPA
  pages/                Routed pages (public + admin)
  components/           UI components (shadcn-based)
  engine/               Rendering core (canvas, masks, layers)
  lib/                  Helpers (assetPack, supabase wrappers)
  integrations/         Auto-generated Supabase client + types
supabase/
  migrations/           SQL migrations
  functions/            Deno edge functions
Memory/                 This wiki (you are here)
```
