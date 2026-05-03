UPDATE public.handle_side_parts
SET mask_url = (
  SELECT mask_url FROM public.handle_side_parts
  WHERE handle_geometry_id = 'a90dcab4-7bf4-4ccd-96ab-7e3f8b8bb1c6'
    AND part_id = 'side_loop_left'
)
WHERE handle_geometry_id = 'a90dcab4-7bf4-4ccd-96ab-7e3f8b8bb1c6'
  AND part_id = 'side_loop_right'
  AND mask_url IS NULL;