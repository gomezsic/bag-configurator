ALTER TABLE public.mask_zones
ADD COLUMN IF NOT EXISTS texture_url text;

COMMENT ON COLUMN public.mask_zones.texture_url IS
'Optional per-zone texture override. When NULL the zone inherits the fabric selected in the configurator. When set, this URL replaces it for the zone only.';