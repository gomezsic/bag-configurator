-- Drop existing restrictive check constraint
ALTER TABLE public.bag_views DROP CONSTRAINT IF EXISTS bag_views_view_type_check;

-- Add new check constraint with all the supported view types
ALTER TABLE public.bag_views ADD CONSTRAINT bag_views_view_type_check
  CHECK (view_type = ANY (ARRAY[
    'front'::text,
    'back'::text,
    'side'::text,
    'three_quarter'::text,
    'top'::text,
    'bottom'::text,
    'interior'::text,
    'custom'::text
  ]));

-- Add an optional custom_label field for 'custom' view type
ALTER TABLE public.bag_views ADD COLUMN IF NOT EXISTS custom_label text;