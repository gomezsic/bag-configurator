ALTER TABLE public.mask_zones
  ADD COLUMN IF NOT EXISTS shading_strength numeric NOT NULL DEFAULT 1.0;