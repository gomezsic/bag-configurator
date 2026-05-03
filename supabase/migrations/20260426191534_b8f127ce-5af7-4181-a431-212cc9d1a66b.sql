ALTER TABLE public.mask_zones
ADD COLUMN IF NOT EXISTS tint_color text;

COMMENT ON COLUMN public.mask_zones.tint_color IS
'Optional hex color (e.g. #d8d4cc) used to tint overlay zones such as zippers. When NULL the mask PNG is drawn as-is.';