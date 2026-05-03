/**
 * analyze-handle-geometry
 *
 * Analizza la foto della borsa + (opzionalmente) le maschere dei manici
 * e usa Gemini 2.5 Pro multimodale per generare i path_json delle centerline:
 *   - manico principale (handle_geometries.path_json)
 *   - side_loop_left  (handle_side_parts.path_json)
 *   - side_loop_right (handle_side_parts.path_json)
 *
 * Salva i risultati direttamente nel DB e restituisce un riepilogo.
 *
 * Input (POST JSON):
 *   { bagViewId: string }
 *
 * Output:
 *   { ok: true, mainPoints: number, sideLoops: { left: number, right: number } }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AnalyzeRequest {
  bagViewId: string;
}

interface PointOut {
  x: number;
  y: number;
  width: number;
}

interface GeminiGeometryResult {
  main_handle: { points: PointOut[] };
  side_loop_left: { points: PointOut[] };
  side_loop_right: { points: PointOut[] };
}

const SYSTEM_PROMPT = `Sei un assistente di vision computing per un configuratore 2D di borse.
Dato l'immagine di una borsa duffle (frontale, sfondo trasparente o bianco) devi
identificare con precisione le CENTERLINE dei manici e restituirle come array
di punti ordinati in coordinate pixel del canvas.

Devi identificare 3 elementi:
1. main_handle: il manico principale ad arco superiore (la maniglia che si tiene in mano).
   Tipicamente parte dal lato sinistro alto del corpo, sale formando un arco e
   ridiscende sul lato destro alto. Usa 6-10 punti che seguano la centerline.
2. side_loop_left: la fettuccia laterale sinistra (passante che collega il manico
   principale al corpo). Tipicamente verticale leggermente inclinata, parte dal
   bordo basso del corpo (~60-70% altezza) e sale fino alla base del manico
   principale (~25-35% altezza). 4-6 punti.
3. side_loop_right: speculare a side_loop_left, sul lato destro.

REGOLE STRETTE:
- Coordinate in PIXEL ASSOLUTI rispetto al canvas indicato (origine top-left).
- "width" = larghezza locale del nastro in pixel (perpendicolare alla tangente).
  Per i manici principali tipicamente 35-55px su canvas 1170. Per i side_loop
  tipicamente 25-40px.
- Punti ORDINATI lungo la direzione naturale (sx→dx per il main, basso→alto per i loop).
- Se NON vedi un elemento (es. nessuna fettuccia laterale), restituisci un array
  di punti vuoto SOLO per quello specifico, ma sempre con la chiave presente.
- NON inventare elementi: meglio array vuoto che punti casuali.
- I punti devono cadere ESATTAMENTE sulla mediana visiva del nastro nella foto.

Restituisci ESCLUSIVAMENTE attraverso il tool 'submit_handle_geometry'.`;

const GEOMETRY_TOOL = {
  type: "function",
  function: {
    name: "submit_handle_geometry",
    description:
      "Restituisce le centerline identificate per manico principale e side loops.",
    parameters: {
      type: "object",
      properties: {
        main_handle: {
          type: "object",
          properties: {
            points: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                  width: { type: "number" },
                },
                required: ["x", "y", "width"],
                additionalProperties: false,
              },
            },
          },
          required: ["points"],
          additionalProperties: false,
        },
        side_loop_left: {
          type: "object",
          properties: {
            points: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                  width: { type: "number" },
                },
                required: ["x", "y", "width"],
                additionalProperties: false,
              },
            },
          },
          required: ["points"],
          additionalProperties: false,
        },
        side_loop_right: {
          type: "object",
          properties: {
            points: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                  width: { type: "number" },
                },
                required: ["x", "y", "width"],
                additionalProperties: false,
              },
            },
          },
          required: ["points"],
          additionalProperties: false,
        },
      },
      required: ["main_handle", "side_loop_left", "side_loop_right"],
      additionalProperties: false,
    },
  },
};

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Impossibile scaricare immagine: ${url} (${r.status})`);
  const buf = new Uint8Array(await r.arrayBuffer());
  // base64 encode
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const b64 = btoa(bin);
  const mime = r.headers.get("content-type") || "image/png";
  return `data:${mime};base64,${b64}`;
}

function clampPoint(p: PointOut, w: number, h: number): PointOut {
  return {
    x: Math.max(0, Math.min(w, Math.round(p.x))),
    y: Math.max(0, Math.min(h, Math.round(p.y))),
    width: Math.max(2, Math.round(p.width)),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bagViewId } = (await req.json()) as AnalyzeRequest;
    if (!bagViewId) throw new Error("bagViewId mancante");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY non configurata");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Fetch view + geometry esistente
    const { data: view, error: viewErr } = await supabase
      .from("bag_views")
      .select("id, canvas_width, canvas_height, base_image_url")
      .eq("id", bagViewId)
      .maybeSingle();
    if (viewErr) throw viewErr;
    if (!view) throw new Error("View non trovata");
    if (!view.base_image_url) {
      throw new Error(
        "La view non ha un base_image_url: caricare prima la foto della borsa.",
      );
    }

    const canvasW = view.canvas_width;
    const canvasH = view.canvas_height;

    // 2. Costruisci messaggio multimodale
    const baseImageDataUrl = await fetchImageAsDataUrl(view.base_image_url);

    const userText = `Canvas: ${canvasW}x${canvasH}px.
Analizza la borsa nell'immagine e identifica le centerline di:
1) manico principale (arco superiore)
2) fettuccia laterale sinistra (side_loop_left)
3) fettuccia laterale destra (side_loop_right)

Restituisci coordinate ASSOLUTE in pixel rispetto a un canvas ${canvasW}x${canvasH}.
Usa il tool submit_handle_geometry.`;

    // 3. Chiamata Lovable AI Gateway con tool calling
    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                {
                  type: "image_url",
                  image_url: { url: baseImageDataUrl },
                },
              ],
            },
          ],
          tools: [GEOMETRY_TOOL],
          tool_choice: {
            type: "function",
            function: { name: "submit_handle_geometry" },
          },
        }),
      },
    );

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Gemini error", aiRes.status, t);
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit. Riprova tra poco." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Crediti AI esauriti. Aggiungi crediti dalle impostazioni Lovable Cloud.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Gemini error ${aiRes.status}: ${t}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "submit_handle_geometry") {
      throw new Error("Gemini non ha restituito la geometria attesa");
    }
    const args: GeminiGeometryResult = JSON.parse(toolCall.function.arguments);

    // 4. Sanitizza punti dentro al canvas
    const main = (args.main_handle?.points ?? []).map((p) =>
      clampPoint(p, canvasW, canvasH),
    );
    const left = (args.side_loop_left?.points ?? []).map((p) =>
      clampPoint(p, canvasW, canvasH),
    );
    const right = (args.side_loop_right?.points ?? []).map((p) =>
      clampPoint(p, canvasW, canvasH),
    );

    // 5. Aggiorna handle_geometries (manico principale)
    let geom = (
      await supabase
        .from("handle_geometries")
        .select("id")
        .eq("bag_view_id", bagViewId)
        .maybeSingle()
    ).data;
    if (!geom) {
      const ins = await supabase
        .from("handle_geometries")
        .insert({
          bag_view_id: bagViewId,
          path_json: {
            paths: [{ id: "main", closed: false, points: main }],
          },
        })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      geom = ins.data;
    } else {
      const upd = await supabase
        .from("handle_geometries")
        .update({
          path_json: {
            paths: [{ id: "main", closed: false, points: main }],
          },
        })
        .eq("id", geom.id);
      if (upd.error) throw upd.error;
    }

    // 6. Aggiorna handle_side_parts (left + right)
    async function upsertSidePart(partId: string, pts: PointOut[], sortOrder: number) {
      const existing = (
        await supabase
          .from("handle_side_parts")
          .select("id")
          .eq("handle_geometry_id", geom!.id)
          .eq("part_id", partId)
          .maybeSingle()
      ).data;
      const path_json = {
        paths: [{ id: partId, closed: false, points: pts }],
      };
      if (existing) {
        const upd = await supabase
          .from("handle_side_parts")
          .update({ path_json })
          .eq("id", existing.id);
        if (upd.error) throw upd.error;
      } else {
        const ins = await supabase.from("handle_side_parts").insert({
          handle_geometry_id: geom!.id,
          part_id: partId,
          path_json,
          sort_order: sortOrder,
        });
        if (ins.error) throw ins.error;
      }
    }
    await upsertSidePart("side_loop_left", left, 0);
    await upsertSidePart("side_loop_right", right, 1);

    return new Response(
      JSON.stringify({
        ok: true,
        canvas: { width: canvasW, height: canvasH },
        mainPoints: main.length,
        sideLoops: { left: left.length, right: right.length },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("analyze-handle-geometry failed", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
