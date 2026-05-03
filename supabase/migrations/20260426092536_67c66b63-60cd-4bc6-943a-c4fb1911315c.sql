ALTER TABLE public.handle_colors
ADD COLUMN IF NOT EXISTS texture_url text,
ADD COLUMN IF NOT EXISTS texture_scale numeric NOT NULL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS texture_rotation numeric NOT NULL DEFAULT 0;