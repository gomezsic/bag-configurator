UPDATE public.mask_zones
SET shading_strength = 0.55,
    updated_at = now()
WHERE bag_view_id = '54b23ef2-6076-4522-adc0-f6ad0169a7ab'
  AND zone_category = 'fabric';