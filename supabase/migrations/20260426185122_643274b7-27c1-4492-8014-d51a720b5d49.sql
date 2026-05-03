-- 1) Aggiorna le fettuccine laterali con la mask v2 e path_json valido
UPDATE public.handle_side_parts SET
  mask_url = 'https://bwrbfatfypcxzqnpuwhv.supabase.co/storage/v1/object/public/admin-assets/slots/City/front-1777225334313/side_loops_mask_v2-1777229430.png',
  path_json = jsonb_build_object(
    'name', 'side_loop_left',
    'canvasWidth', 1170,
    'canvasHeight', 1170,
    'paths', jsonb_build_array(jsonb_build_object(
      'id', 'side_loop_left',
      'closed', false,
      'points', jsonb_build_array(
        jsonb_build_object('x', 260, 'y', 720, 'width', 38),
        jsonb_build_object('x', 270, 'y', 600, 'width', 38),
        jsonb_build_object('x', 285, 'y', 480, 'width', 38),
        jsonb_build_object('x', 300, 'y', 420, 'width', 38)
      )
    ))
  ),
  updated_at = now()
WHERE id = '82704465-7bd6-410e-b29f-116b877df1f8';

UPDATE public.handle_side_parts SET
  mask_url = 'https://bwrbfatfypcxzqnpuwhv.supabase.co/storage/v1/object/public/admin-assets/slots/City/front-1777225334313/side_loops_mask_v2-1777229430.png',
  path_json = jsonb_build_object(
    'name', 'side_loop_right',
    'canvasWidth', 1170,
    'canvasHeight', 1170,
    'paths', jsonb_build_array(jsonb_build_object(
      'id', 'side_loop_right',
      'closed', false,
      'points', jsonb_build_array(
        jsonb_build_object('x', 910, 'y', 720, 'width', 38),
        jsonb_build_object('x', 900, 'y', 600, 'width', 38),
        jsonb_build_object('x', 885, 'y', 480, 'width', 38),
        jsonb_build_object('x', 870, 'y', 420, 'width', 38)
      )
    ))
  ),
  updated_at = now()
WHERE id = '78d17439-79b4-4680-9a9c-fd0443a08e64';

-- 2) Aumenta scala texture default neoprene (e tutti i tessuti) e mantieni mirror
UPDATE public.mask_zones SET
  texture_scale = 1.5,
  texture_repeat_mode = 'mirror',
  updated_at = now()
WHERE bag_view_id = '9248f4bd-ad28-4ea1-a437-00815eb623b4';

-- 3) Crea una mask_zone dedicata alla cerniera con overlay PRE-COLORATO panna.
--    Categoria 'fabric' così viene disegnata dal layer 'fabric_overlay'.
INSERT INTO public.mask_zones (
  bag_view_id, zone_type, zone_category, label,
  mask_image_url, local_overlay_url,
  z_index, blend_mode, sort_order,
  texture_scale, texture_offset_x, texture_offset_y, texture_rotation,
  texture_repeat_mode, scale_correction_factor, shading_strength
) VALUES (
  '9248f4bd-ad28-4ea1-a437-00815eb623b4', 'zip', 'fabric', 'Cerniera',
  'https://bwrbfatfypcxzqnpuwhv.supabase.co/storage/v1/object/public/admin-assets/slots/City/front-1777225334313/zip_mask-1777229430.png',
  'https://bwrbfatfypcxzqnpuwhv.supabase.co/storage/v1/object/public/admin-assets/slots/City/front-1777225334313/zip_overlay_panna-1777229453.png',
  5, 'normal', 10,
  1.0, 0, 0, 0,
  'repeat', 1.0, 1.0
);