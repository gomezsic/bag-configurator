---
name: ADR-0001
description: Why we chose Supabase (Lovable Cloud) over Firebase / custom Node backend.
type: decision
updated: 2026-04-12
status: ACCEPTED
supersedes: null
---

# ADR 0001 — Supabase over Firebase / custom Node

## Context

Need a managed backend with: Postgres-style relational data, RLS, file storage, edge functions, and zero-ops auth. Project must be portable and the SPA decoupled from Shopify.

## Decision

Use **Supabase via Lovable Cloud**.

## Why not Firebase

- We need relational queries with joins (compatibility rules, layer order rules, pricing rules). Firestore document model fights this.
- RLS in Postgres is more expressive than Firestore security rules for our admin/role pattern.

## Why not a custom Node backend

- We have one product engineer; a managed BaaS removes ~40% of ops surface (auth, scaling, storage CDN).
- Edge functions cover our small server-side needs (AI calls, webhooks).

## Consequences

- ✅ Free RLS, free storage CDN, generated TS types.
- ✅ Edge functions in Deno; no container ops.
- ⚠️ Lock-in to Supabase APIs; mitigated by keeping all Supabase calls behind `@/integrations/supabase/client` and a thin lib layer.
- ⚠️ Generated `types.ts` and `client.ts` are sacrosanct — never edit.
