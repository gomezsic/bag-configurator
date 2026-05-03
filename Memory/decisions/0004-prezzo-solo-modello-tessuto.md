---
name: ADR-0004
description: Price is a function of bag model and fabric type only. Handles, colors, embroideries are free.
type: decision
updated: 2026-04-12
status: ACCEPTED
supersedes: null
---

# ADR 0004 — Price = f(bag_model, fabric_type)

## Context

Initial UX experiments tried per-handle and per-embroidery upcharges. Result: pricing felt arbitrary, support load went up (customers asking why an identical-looking bag cost more), and Shopify variant explosion was unmanageable.

## Decision

**Price depends only on `(bag_model, fabric_type)`.** All other customizations (handle style, handle color, fabric color within a fabric type, embroidery, cord) are **included** at no upcharge.

## Implementation

- `pricing_rules` table holds the matrix.
- Shopify product variants mirror the same matrix (one variant per `(model, fabric_type)`).
- The configurator never displays a sub-total per option; only a single price that updates when model or fabric type changes.

## Consequences

- ✅ Simple mental model for customers.
- ✅ Manageable Shopify variant count.
- ✅ Configurator code does not need a pricing engine — just a lookup.
- ⚠️ If we ever introduce premium-only handles or embroideries, this ADR will need to be superseded.
