/**
 * enhance-texture
 *
 * Riceve una texture seamless già pre-processata in client (data URL PNG) e
 * chiede a Lovable AI (Gemini Image) di levigarla ulteriormente, mantenendo
 * il colore e il pattern del tessuto ma riducendo le tracce di cuciture e
 * variazioni di luminosità residua.
 *
 * Input  : { imageDataUrl: string, hint?: string }
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
    const { imageDataUrl, hint } = await req.json();
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

    // Preset prompts per material type. Hint può essere una keyword
    // ("neoprene-scuba", "neoprene-tech", "neoprene-knit") oppure testo libero.
    const presets: Record<string, string> = {
      // ⭐ Default per neoprene 3D mesh (foto riferimento utente):
      // base CHIARA neutra grayscale + buchi ovali scuri con ombra interna,
      // così che multiply * colore faccia emergere il rilievo 3D.
      'neoprene-scuba': [
        'Generate a SINGLE SEAMLESS TILE texture, not a product photo and not a mockup. The tile will be multiplied by user colors later, so the output MUST be a neutral grayscale height/shading matrix.',
        '',
        'MATERIAL TARGET:',
        '- Technical scuba/crepe neoprene with 3D spacer-mesh effect, like an engineered athletic mesh surface.',
        '- It must read as soft neoprene relief, not plastic, not leather, not perforated metal, not dirty fabric.',
        '',
        'COLOR / MULTIPLY REQUIREMENTS (ABSOLUTE):',
        '- Output ONLY neutral grayscale. NO red, NO warm tint, NO blue tint, NO colored pixels.',
        '- Background surface: light neutral grey around #eeeeee so multiply coloring remains vivid.',
        '- Recessed oval holes: dark neutral grey around #3f3f3f to reveal depth after multiply.',
        '- Raised knit ridges: #cfcfcf to #f2f2f2 only. Keep luminance even and printable.',
        '',
        'GEOMETRY (ABSOLUTE, MATHEMATICAL REGULARITY):',
        '- A perfectly periodic engineered grid of identical vertical rounded oval recesses.',
        '- Every oval has exactly the same width, height, spacing, orientation, darkness and edge highlight.',
        '- Use a regular staggered lattice or regular columns; no random placement, no organic variation.',
        '- Hole pitch must be constant both horizontally and vertically. About 14-18 holes across the tile.',
        '- The micro-knit texture must be subtle and uniform, never forming larger blotches or bands.',
        '',
        'SEAMLESSNESS (ABSOLUTE):',
        '- The tile must repeat perfectly on all four edges with no visible vertical or horizontal seam.',
        '- When repeated 3x3 there must be no cross line, no border line, no doubled columns, no gaps, no phase jump.',
        '- Features near the right edge continue at the left edge at the exact same Y coordinate. Features near the bottom continue at the top with the exact same X phase.',
        '',
        'FORBIDDEN ARTIFACTS:',
        '- No vignette, no global gradient, no lighting falloff, no shadows at the tile border.',
        '- No stains, dirt, speckles, random noise clumps, dark blobs, cloudy patches, scratches, wrinkles or diagonal waves.',
        '- No text, no labels, no perspective, no depth of field, no crop border, no photographic frame.',
        '',
        'OUTPUT: square 1:1, flat top-down orthographic texture swatch, sharp focus, even soft studio lighting, clean repeat-ready grayscale material matrix.',
      ].join('\n'),
      'neoprene-mesh-3d': [
        'Generate a photorealistic 3D spacer mesh neoprene swatch with regular vertical oval holes, dark hole interiors, raised knit ridges, neutral light grey base (#ececec), seamless tileable.',
      ].join(' '),
      'neoprene-tech': [
        'Transform this into a photorealistic technical neoprene fabric (sub/sport wetsuit style), top-down macro, studio lighting.',
        'Almost smooth surface with a very fine uniform micro-grain. No dots, no holes, no knit pattern.',
        'Neutral light grey (~#ececec), perfectly uniform brightness, seamless and tileable, square swatch. Fully desaturated grayscale.',
      ].join(' '),
      'neoprene-knit': [
        'Transform this into a photorealistic fine-knit jersey neoprene fabric, top-down macro.',
        'Very tight regular knit weave with tiny uniform loops. No polka dots, no holes.',
        'Neutral light grey (~#ececec), uniform brightness, seamless tileable square swatch. Fully desaturated grayscale.',
      ].join(' '),
    };

    const presetPrompt = hint && presets[hint] ? presets[hint] : null;

    const prompt = presetPrompt
      ? presetPrompt
      : [
          'Make this fabric texture perfectly seamless and tile-able with no visible seams when repeated 3x3.',
          'Keep the exact same color, weave pattern, fiber direction and material character.',
          'Remove any residual lighting gradient or vignetting so brightness is uniform across the whole image.',
          'Smooth out any visible cross-shaped seam in the middle and edge discontinuities.',
          'The output must be a square fabric swatch ready to be tiled.',
          hint ? `Additional hint from user: ${hint}` : '',
        ]
          .filter(Boolean)
          .join(' ');

    // Per i preset di GENERAZIONE da zero (es. neoprene-*) NON passiamo
    // l'immagine sorgente, altrimenti Gemini scatta in IMAGE_RECITATION
    // (filtro safety che blocca quando crede di copiare l'input).
    // Per il fallback "enhance" generico passiamo l'immagine come riferimento.
    const isGenerationPreset = !!presetPrompt;

    const userContent: unknown[] = [{ type: 'text', text: prompt }];
    if (!isGenerationPreset) {
      userContent.push({ type: 'image_url', image_url: { url: imageDataUrl } });
    }

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
            temperature: 0.15,
            max_tokens: 8192,
            messages: [{ role: 'user', content: userContent }],
          }),
        }
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Generazione AI troppo lenta: riprova o usa la base procedurale.' }),
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
          ? 'Il modello ha bloccato la generazione per safety. Riprova o cambia preset.'
          : 'AI non ha restituito un\'immagine. Riprova.';
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
    console.error('enhance-texture error', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
