UPDATE public.bag_views SET
  overlay_shadows_url    = 'https://bwrbfatfypcxzqnpuwhv.supabase.co/storage/v1/object/public/admin-assets/slots/City/front-1777225334313/overlay_shadows-1777229150.png',
  overlay_highlights_url = 'https://bwrbfatfypcxzqnpuwhv.supabase.co/storage/v1/object/public/admin-assets/slots/City/front-1777225334313/overlay_highlights-1777229150.png',
  overlay_details_url    = 'https://bwrbfatfypcxzqnpuwhv.supabase.co/storage/v1/object/public/admin-assets/slots/City/front-1777225334313/overlay_details-1777229150.png',
  updated_at = now()
WHERE id = '9248f4bd-ad28-4ea1-a437-00815eb623b4';

UPDATE public.handle_geometries SET
  shadow_url = 'https://bwrbfatfypcxzqnpuwhv.supabase.co/storage/v1/object/public/admin-assets/slots/City/front-1777225334313/handle_shadow_soft-1777229171.png',
  updated_at = now()
WHERE id = 'a90dcab4-7bf4-4ccd-96ab-7e3f8b8bb1c6';

UPDATE public.mask_zones SET
  texture_repeat_mode = 'mirror',
  texture_scale = 0.5,
  shading_strength = 1.0,
  updated_at = now()
WHERE bag_view_id = '9248f4bd-ad28-4ea1-a437-00815eb623b4';