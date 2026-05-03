---
name: deploy-edge-function
description: Add or modify a Supabase edge function, including AI Gateway usage.
type: skill
updated: 2026-05-03
status: VERIFIED
trigger: User asks to add or change an edge function (AI texture, geometry, webhook).
risk: STANDARD_FEATURE (HIGH_RISK_DATA if it writes to DB)
---

# Skill: Deploy an edge function

## Skeleton

`supabase/functions/<name>/index.ts`:

```ts
// deno-lint-ignore-file
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    // ... logic ...
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

## AI Gateway call (preferred — no user-supplied keys)

```ts
const apiKey = Deno.env.get("LOVABLE_API_KEY");
const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [{ role: "user", content: "..." }],
  }),
});
```

For image generation, use `google/gemini-3.1-flash-image-preview`.

## verify_jwt

If the function must be callable by anonymous clients (configurator path), set in `supabase/config.toml`:

```toml
[functions.<name>]
verify_jwt = false
```

Most Lovable-managed functions deploy with `verify_jwt = false` by default — only add the block if a function-specific override is needed.

## Calling from the SPA

```ts
const { data, error } = await supabase.functions.invoke("<name>", { body: { ... } });
```

## Deploy

Saving the file triggers `supabase--deploy_edge_functions` automatically. Logs via `supabase--edge_function_logs`. Manual smoke test via `supabase--curl_edge_functions`.

## Secrets

Before adding a function that needs a new secret: `secrets--fetch_secrets` to check, then `secrets--add_secret` to request from the user. Never commit secrets.
