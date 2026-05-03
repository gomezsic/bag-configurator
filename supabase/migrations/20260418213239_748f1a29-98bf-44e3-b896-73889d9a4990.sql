-- 0) Allarga il check constraint per includere i nuovi layer overlay
ALTER TABLE public.layer_order_rules DROP CONSTRAINT IF EXISTS layer_order_rules_layer_type_check;
ALTER TABLE public.layer_order_rules ADD CONSTRAINT layer_order_rules_layer_type_check
  CHECK (layer_type IN (
    'base', 'fabric', 'fabric_overlay', 'handle', 'handle_overlay',
    'embroidery', 'global_overlay',
    'overlay_shadows', 'overlay_highlights', 'overlay_details'
  ));

-- 1) Pipeline completa per la vista Travel front (solo se la view esiste)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bag_views WHERE id = '54b23ef2-6076-4522-adc0-f6ad0169a7ab') THEN
    INSERT INTO public.layer_order_rules (bag_view_id, layer_type, z_index, blend_mode, opacity, is_active)
    VALUES
      ('54b23ef2-6076-4522-adc0-f6ad0169a7ab', 'base',                0,  'normal',   1.0,  true),
      ('54b23ef2-6076-4522-adc0-f6ad0169a7ab', 'fabric',             10,  'normal',   1.0,  true),
      ('54b23ef2-6076-4522-adc0-f6ad0169a7ab', 'handle',             20,  'normal',   1.0,  true),
      ('54b23ef2-6076-4522-adc0-f6ad0169a7ab', 'embroidery',         30,  'normal',   1.0,  true),
      ('54b23ef2-6076-4522-adc0-f6ad0169a7ab', 'overlay_shadows',    40,  'multiply', 1.0,  true),
      ('54b23ef2-6076-4522-adc0-f6ad0169a7ab', 'overlay_highlights', 50,  'screen',   0.85, true),
      ('54b23ef2-6076-4522-adc0-f6ad0169a7ab', 'overlay_details',    60,  'normal',   1.0,  true);
  END IF;
END $$;

-- 2) fabric_top da multiply → normal e uniforma scale a 1.9 (solo se la view esiste)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bag_views WHERE id = '54b23ef2-6076-4522-adc0-f6ad0169a7ab') THEN
    UPDATE public.mask_zones
    SET blend_mode = 'normal', texture_scale = 1.9
    WHERE bag_view_id = '54b23ef2-6076-4522-adc0-f6ad0169a7ab'
      AND zone_type = 'fabric_top';

    UPDATE public.mask_zones
    SET texture_scale = 1.9
    WHERE bag_view_id = '54b23ef2-6076-4522-adc0-f6ad0169a7ab'
      AND zone_type IN ('fabric_back', 'fabric_front');
  END IF;
END $$;

-- 3) Sblocca RLS su layer_order_rules per insert/update/delete dall'admin
DROP POLICY IF EXISTS "Public insert layer_order_rules" ON public.layer_order_rules;
DROP POLICY IF EXISTS "Public update layer_order_rules" ON public.layer_order_rules;
DROP POLICY IF EXISTS "Public delete layer_order_rules" ON public.layer_order_rules;
CREATE POLICY "Public insert layer_order_rules" ON public.layer_order_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update layer_order_rules" ON public.layer_order_rules FOR UPDATE USING (true);
CREATE POLICY "Public delete layer_order_rules" ON public.layer_order_rules FOR DELETE USING (true);