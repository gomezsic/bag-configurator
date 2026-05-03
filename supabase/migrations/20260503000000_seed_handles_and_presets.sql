-- Seed: catalogo manici, preset pattern e corde di default.
-- Idempotente: usa INSERT ... ON CONFLICT DO NOTHING.

-- 1. Tipi di manico
INSERT INTO public.handles (id, name, slug, is_active, sort_order) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Toscana',  'toscana',  true, 0),
  ('11111111-0000-0000-0000-000000000002', 'Porto',    'porto',    true, 1),
  ('11111111-0000-0000-0000-000000000003', 'Venezia',  'venezia',  true, 2)
ON CONFLICT (id) DO NOTHING;

-- 2. Preset pattern (struttura JSON allineata a HandlePatternPreset)
INSERT INTO public.handle_pattern_presets (id, name, preset_json, sort_order) VALUES
  (
    '22222222-0000-0000-0000-000000000001',
    'Bicolor classico',
    '{
      "name": "Bicolor classico",
      "stripeCount": 2,
      "stripes": [
        {"color": "#e2188f", "width": 0.5},
        {"color": "#f1eadb", "width": 0.5}
      ],
      "spacing": [0],
      "edgeMarginLeft": 0,
      "edgeMarginRight": 0,
      "grainEnabled": false,
      "grainOpacity": 0.18,
      "grainTextureUrl": null
    }'::jsonb,
    0
  ),
  (
    '22222222-0000-0000-0000-000000000002',
    'Tricolor sportivo',
    '{
      "name": "Tricolor sportivo",
      "stripeCount": 3,
      "stripes": [
        {"color": "#e2188f", "width": 0.333},
        {"color": "#f1eadb", "width": 0.334},
        {"color": "#1a1a2e", "width": 0.333}
      ],
      "spacing": [0, 0],
      "edgeMarginLeft": 0,
      "edgeMarginRight": 0,
      "grainEnabled": false,
      "grainOpacity": 0.18,
      "grainTextureUrl": null
    }'::jsonb,
    1
  ),
  (
    '22222222-0000-0000-0000-000000000003',
    'Multicolor 5 strisce',
    '{
      "name": "Multicolor 5 strisce",
      "stripeCount": 5,
      "stripes": [
        {"color": "#e2188f", "width": 0.2},
        {"color": "#f1eadb", "width": 0.2},
        {"color": "#1a1a2e", "width": 0.2},
        {"color": "#f1eadb", "width": 0.2},
        {"color": "#e2188f", "width": 0.2}
      ],
      "spacing": [0, 0, 0, 0],
      "edgeMarginLeft": 0,
      "edgeMarginRight": 0,
      "grainEnabled": false,
      "grainOpacity": 0.18,
      "grainTextureUrl": null
    }'::jsonb,
    2
  ),
  (
    '22222222-0000-0000-0000-000000000004',
    'Tinta unita nero',
    '{
      "name": "Tinta unita nero",
      "stripeCount": 1,
      "stripes": [
        {"color": "#1a1a1a", "width": 1.0}
      ],
      "spacing": [],
      "edgeMarginLeft": 0,
      "edgeMarginRight": 0,
      "grainEnabled": true,
      "grainOpacity": 0.12,
      "grainTextureUrl": null
    }'::jsonb,
    3
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Corde del catalogo (una per preset)
INSERT INTO public.cord_collection (id, name, style_type, pattern_preset_id, is_active, sort_order) VALUES
  ('33333333-0000-0000-0000-000000000001', 'Bicolor classico',    'pattern_preset', '22222222-0000-0000-0000-000000000001', true, 0),
  ('33333333-0000-0000-0000-000000000002', 'Tricolor sportivo',   'pattern_preset', '22222222-0000-0000-0000-000000000002', true, 1),
  ('33333333-0000-0000-0000-000000000003', 'Multicolor 5 strisce','pattern_preset', '22222222-0000-0000-0000-000000000003', true, 2),
  ('33333333-0000-0000-0000-000000000004', 'Tinta unita nero',    'pattern_preset', '22222222-0000-0000-0000-000000000004', true, 3)
ON CONFLICT (id) DO NOTHING;

-- 4. Compatibilità corde ↔ manici (tutte le corde su tutti i manici)
INSERT INTO public.cord_handle_compatibility (cord_id, handle_id) VALUES
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003'),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003'),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003'),
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000003')
ON CONFLICT (cord_id, handle_id) DO NOTHING;
