/**
 * generate-bag-masks
 *
 * Analizza la foto della borsa con Claude claude-opus-4-7 (vision + tool use)
 * e restituisce polygon paths per le zone di tessuto:
 *   - fabric_front   : fronte principale
 *   - fabric_sides   : fianchi/gusset laterali (se visibili)
 *   - fabric_top     : pannello superiore (se visibile)
 *   - fabric_back    : retro (se visibile nella vista)
 *
 * Il frontend riceve i polygon e li rasterizza in PNG mask lato browser,
 * poi carica su Storage e crea le mask_zones nel DB.
 *
 * Input  : POST { bagViewId: string }
 * Output : { zones: GeneratedZone[] }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Point { x: number; y: number }

interface GeneratedZone {
  zone_type: string;
  label: string;
  polygon: Point[];
}

const SYSTEM_PROMPT = `You are a computer vision specialist for a luxury bag configurator.
Given a product photo of a bag, your task is to precisely identify the VISIBLE FABRIC ZONES
and return their outlines as closed polygon paths in canvas pixel coordinates.

ZONES TO IDENTIFY (only include zones that are actually visible in this photo):
- fabric_front  : The main front face panel of the bag (largest visible fabric area)
- fabric_sides  : Side/gusset panels visible on the left or right edges
- fabric_top    : The top panel or gusset (if visible from this angle)
- fabric_back   : The back panel (only if visible, e.g. in a 3/4 or back view)

POLYGON RULES:
- Each polygon must be a closed outline tracing the EXACT boundary of that fabric zone
- Use 8–20 points per polygon — enough to capture curves and corners accurately
- Coordinates are ABSOLUTE PIXELS in the canvas specified (origin at top-left)
- Points must be ordered consistently (clockwise or counter-clockwise)
- Polygons must NOT overlap each other
- Stay INSIDE the visible fabric edges — do not include handles, hardware, or background
- If a zone is not clearly visible or is too small to matter, omit it
- ONLY identify fabric/textile zones — do not include handles, zippers, metal hardware, or straps as zones

Return results ONLY via the submit_bag_zones tool.`;

const ZONES_TOOL = {
  name: "submit_bag_zones",
  description: "Submit the identified fabric zone polygons for the bag image.",
  input_schema: {
    type: "object",
    properties: {
      zones: {
        type: "array",
        description: "Array of identified fabric zones with their polygon outlines.",
        items: {
          type: "object",
          properties: {
            zone_type: {
              type: "string",
              enum: ["fabric_front", "fabric_sides", "fabric_top", "fabric_back"],
              description: "The type identifier for this fabric zone.",
            },
            label: {
              type: "string",
              description: "Human-readable label in Italian, e.g. 'Fronte principale', 'Fianco sinistro'.",
            },
            polygon: {
              type: "array",
              description: "Ordered polygon points in canvas pixel coordinates.",
              minItems: 3,
              items: {
                type: "object",
                properties: {
                  x: { type: "number", description: "X coordinate in pixels from left edge." },
                  y: { type: "number", description: "Y coordinate in pixels from top edge." },
                },
                required: ["x", "y"],
                additionalProperties: false,
              },
            },
          },
          required: ["zone_type", "label", "polygon"],
          additionalProperties: false,
        },
      },
    },
    required: ["zones"],
  },
};

async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Impossibile scaricare immagine: ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const data = btoa(bin);
  const mediaType = (r.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  return { data, mediaType };
}

function clampPolygon(points: Point[], w: number, h: number): Point[] {
  return points.map(p => ({
    x: Math.max(0, Math.min(w, Math.round(p.x))),
    y: Math.max(0, Math.min(h, Math.round(p.y))),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bagViewId } = await req.json() as { bagViewId: string };
    if (!bagViewId) throw new Error("bagViewId mancante");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY non configurata");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Fetch bag_view
    const { data: view, error: viewErr } = await supabase
      .from("bag_views")
      .select("id, canvas_width, canvas_height, base_image_url, view_type")
      .eq("id", bagViewId)
      .maybeSingle();
    if (viewErr) throw viewErr;
    if (!view) throw new Error("View non trovata");
    if (!view.base_image_url) throw new Error("Carica prima la base image della vista.");

    const canvasW: number = view.canvas_width;
    const canvasH: number = view.canvas_height;

    // 2. Download image → base64
    const { data: imgData, mediaType } = await fetchImageAsBase64(view.base_image_url);

    // 3. Call Claude claude-opus-4-7 with vision + tool use
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [ZONES_TOOL],
        tool_choice: { type: "tool", name: "submit_bag_zones" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: imgData,
                },
              },
              {
                type: "text",
                text: `Canvas: ${canvasW}×${canvasH}px. View type: ${view.view_type}.
Identify all visible fabric zones and return their precise polygon outlines in pixel coordinates.
Remember: coordinates must be absolute pixels within a ${canvasW}×${canvasH} canvas.`,
              },
            ],
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude API error", claudeRes.status, errText);
      if (claudeRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit Claude API. Riprova tra poco." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Claude API error ${claudeRes.status}: ${errText.slice(0, 300)}`);
    }

    const claudeData = await claudeRes.json();
    const toolUse = claudeData.content?.find(
      (c: { type: string }) => c.type === "tool_use",
    ) as { type: string; name: string; input: { zones: GeneratedZone[] } } | undefined;

    if (!toolUse || toolUse.name !== "submit_bag_zones") {
      throw new Error("Claude non ha restituito le zone attese");
    }

    // 4. Sanitize polygon points within canvas bounds
    const zones: GeneratedZone[] = (toolUse.input.zones ?? [])
      .filter((z) => z.polygon && z.polygon.length >= 3)
      .map((z) => ({
        zone_type: z.zone_type,
        label: z.label,
        polygon: clampPolygon(z.polygon, canvasW, canvasH),
      }));

    return new Response(
      JSON.stringify({
        ok: true,
        canvasWidth: canvasW,
        canvasHeight: canvasH,
        zones,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-bag-masks failed", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
