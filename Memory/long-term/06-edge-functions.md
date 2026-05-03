---
name: 06-edge-functions
description: Deno edge functions, AI gateway usage, secrets, deployment.
type: long-term
updated: 2026-05-03
status: VERIFIED
priority: medium
---

# 06 — Edge Functions

Source: `supabase/functions/<name>/index.ts`. Deno runtime, auto-deployed by Lovable on save.

## Inventory

| Function | Purpose | AI? |
|---|---|---|
| `seamless-from-photo` | Generate a tileable seamless texture from a user photo | Yes (Gemini 3 Flash Image preview) |
| `enhance-texture` | Improve quality / resolution of an existing texture | Yes (Gemini) |
| `analyze-handle-geometry` | Extract handle skeleton + width from an image | Yes (Gemini structured output) |

## AI access pattern

All AI calls go through **Lovable AI Gateway**. No raw provider keys in functions.

- Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions` (OpenAI-compatible).
- Auth: `Authorization: Bearer ${Deno.env.get("LOVABLE_API_KEY")}` (auto-provisioned).
- Models actually used:
  - `google/gemini-3.1-flash-image-preview` for image gen/edit
  - `google/gemini-2.5-flash` for structured analysis (handle geometry)

Fallbacks and model upgrades documented per-function inside its `index.ts` header comment.

## CORS

Each function exposes:

```ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
// handle OPTIONS at top of handler
```

## verify_jwt

Default is `false` for these functions (configured in `supabase/config.toml` per-function block when needed). They are callable by anonymous clients because the configurator runs without auth.

## Secrets

Listed via `secrets--fetch_secrets`. `LOVABLE_API_KEY` is always present; other secrets must be requested via `secrets--add_secret` before use.

## Deployment

- On save, `supabase--deploy_edge_functions` runs automatically.
- Logs: `supabase--edge_function_logs`.
- Test: `supabase--test_edge_functions` or `supabase--curl_edge_functions`.

## Skill

See `skills/deploy-edge-function.md` for the full procedure to add a new one.
