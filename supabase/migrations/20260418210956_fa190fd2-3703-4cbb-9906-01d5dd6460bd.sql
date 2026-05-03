ALTER TABLE public.bag_views
  ADD COLUMN IF NOT EXISTS overlay_shadows_url text,
  ADD COLUMN IF NOT EXISTS overlay_highlights_url text,
  ADD COLUMN IF NOT EXISTS overlay_details_url text;