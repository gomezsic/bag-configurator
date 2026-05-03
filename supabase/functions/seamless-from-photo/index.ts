/**
 * seamless-from-photo
 *
 * Trasforma una foto reale di tessuto in un tile seamless 1024x1024 usando
 * Gemini Image (Nano Banana 2). Equivalente del flusso "Extract Pattern from
 * Image" di Patterned.ai: il modello vede la foto, ne preserva materia, fibra
 * e colore, e produce un tile che si ripete senza cuciture.
 *
 * A differenza di enhance-texture (che riceve una texture già seamless e la
 * leviga), qui partiamo dalla FOTO ORIGINALE e chiediamo l'estrazione del
 * pattern ripetibile. Passiamo l'immagine come riferimento — è esattamente
 * quello che vogliamo: il modello deve mantenere quella materia.
 *
 * Input  : { imageDataUrl: string, materialHint?: string }
 * Output : { imageDataUrl: string }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageDataUrl, materialHint } = await req.json();
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return new Response(
        JSON.stringify({ error: 'imageDataUrl mancante' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI gateway non configurato' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const materialLine = materialHint
      ? `The source photo shows: ${materialHint}. Preserve that exact material identity.`
      : 'Preserve the exact material identity visible in the source photo (fiber type, weave, grain, micro-relief, color).';

    // Prompt per "pattern extraction" alla Patterned.ai. Chiave:
    // - dichiariamo esplicitamente che è un fabric scan da rendere seamless
    // - vietiamo invenzioni (no pallini, no geometrie, no stilizzazione)
    // - chiediamo flat top-down, illuminazione neutra uniforme
    // - chiediamo continuità ai 4 bordi
    const prompt = [
      'You are a textile pattern extraction tool. Take the attached photo of a real fabric and produce a SINGLE SEAMLESS REPEAT TILE of that exact fabric.',
      '',
      materialLine,
      '',
      'CRITICAL RULES:',
      '- Output a square 1:1 tile that repeats perfectly when tiled in a 3x3 grid: no visible vertical seam, no horizontal seam, no cross line in the middle, no doubled features at the borders.',
      '- The features near the right edge must continue at the left edge at the exact same Y; the bottom must continue at the top at the exact same X (toroidal continuity).',
      '- Keep the original fabric’s realistic photographic look: real fibers, real weave, real micro-relief, real color. Do NOT stylize, do NOT vectorize, do NOT replace with polka dots, stripes, geometric shapes, or any synthetic pattern.',
      '- Flatten the lighting so brightness is uniform across the tile (no vignette, no gradient, no soft shadow at borders).',
      '- Top-down orthographic view, sharp focus, flat studio lighting, no perspective, no depth of field, no crop frame.',
      '- The tile must look like the same fabric you see in the photo, just cleaned up and made tileable. Same material, same color, same scale of detail.',
      '',
      'FORBIDDEN:',
      '- No text, no labels, no watermark, no logo, no border, no frame.',
      '- No invented patterns, no stylization, no painterly look, no illustration, no abstract art.',
      '- No people, no hands, no products, no mockups, no scenes — only the fabric swatch.',
    ].join('\n');

    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 70000);
    let aiResp: Response;
    try {
      aiResp = await fetch(
        'https://ai.gateway.lovable.dev/v1/chat/completions',
        {
          method: 'POST',
          signal: aiController.signal,
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3.1-flash-image-preview',
            modalities: ['image', 'text'],
            temperature: 0.2,
            max_tokens: 8192,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: imageDataUrl } },
                ],
              },
            ],
          }),
        }
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Generazione AI troppo lenta: riprova.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw e;
    } finally {
      clearTimeout(aiTimeout);
    }

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error('AI gateway error', aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite richieste AI raggiunto, riprova tra poco.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Crediti AI esauriti. Aggiungili nelle impostazioni workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'AI gateway error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await aiResp.json();
    const url: string | undefined =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const finishReason: string | undefined =
      data?.choices?.[0]?.native_finish_reason ?? data?.choices?.[0]?.finish_reason;

    if (!url) {
      console.error('AI response missing image', JSON.stringify(data).slice(0, 800));
      const friendly =
        finishReason === 'IMAGE_RECITATION'
          ? 'Il modello ha bloccato la generazione (recitation). Riprova: ogni run è diverso.'
          : finishReason === 'SAFETY'
          ? 'Il modello ha bloccato la generazione per safety. Riprova.'
          : "AI non ha restituito un'immagine. Riprova.";
      return new Response(
        JSON.stringify({ error: friendly, finish_reason: finishReason }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ imageDataUrl: url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('seamless-from-photo error', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
