UPDATE public.bag_views 
SET base_image_url = 'https://bwrbfatfypcxzqnpuwhv.supabase.co/storage/v1/object/public/admin-assets/models/misc/front/base-neutra-1776549766.png',
    updated_at = now()
WHERE id = '54b23ef2-6076-4522-adc0-f6ad0169a7ab';

UPDATE public.mask_zones
SET shading_strength = 0.85,
    updated_at = now()
WHERE bag_view_id = '54b23ef2-6076-4522-adc0-f6ad0169a7ab'
  AND zone_category = 'fabric';