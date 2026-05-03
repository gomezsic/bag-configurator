---
name: 07-shopify-integration
description: How the configurator hands off to Shopify checkout via Line Item Properties.
type: long-term
updated: 2026-05-03
status: NEEDS_REVIEW
priority: medium
---

# 07 — Shopify Integration

> **STATUS: NEEDS_REVIEW** — Shopify code path is documented at the contract level but the live integration hooks (storefront API token, product mapping) should be verified before any change to the handoff. The contract below is stable.

## Contract

The configurator is **decoupled** from Shopify. Shopify owns:

- Product catalog (one Shopify product per bag model)
- Cart, checkout, payment, fulfillment
- Customer account

The configurator owns:

- All customization choices
- The rendered preview PNG
- The persisted `configurations` row

Handoff happens by adding a Shopify product to cart with **Line Item Properties**:

| Property | Value |
|---|---|
| `_configuration_id` | UUID of `configurations` row (Supabase) |
| `_preview_url` | Public URL of the rendered preview PNG |
| `_model_slug` | e.g. `city` |
| `_summary` | Human-readable summary string |

`_`-prefixed keys are hidden from customer view in Shopify but visible to the merchant on the order.

## Flow

```
1. User completes step 6 (Conferma)
2. Client POSTs configuration to Supabase → configurations row
3. Client uploads rendered preview PNG to Storage → public URL
4. Client calls Shopify Storefront API: cart create with line item properties
5. Customer is redirected to Shopify checkout URL
```

## Pricing

Price comes from Shopify's product variant (the variant is selected based on `(bag_model, fabric_type)`). The configurator never charges the customer directly. See ADR 0004.

## Failure modes

- Shopify variant missing for `(model, fabric)` combo → user sees an "Out of stock / unavailable" message, configuration is still persisted in Supabase for support.
- Preview upload fails → fallback to a placeholder URL; merchant still gets the configuration_id.

## What lives where

| Concern | System |
|---|---|
| Customer email, address, payment | Shopify |
| Configuration choices | Supabase `configurations` |
| Preview image | Supabase Storage (public bucket) |
| Order ↔ configuration link | Shopify line item properties |
