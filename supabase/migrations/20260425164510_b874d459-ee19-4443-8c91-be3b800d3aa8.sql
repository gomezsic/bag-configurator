-- 1. Drop legacy mapper table (data lost as confirmed)
DROP TABLE IF EXISTS public.handle_color_mappings CASCADE;

-- 2. Clean up handles table (remove legacy mapper columns)
ALTER TABLE public.handles
  DROP COLUMN IF EXISTS mapping_id,
  DROP COLUMN IF EXISTS stripe_count,
  DROP COLUMN IF EXISTS pattern_scale;

-- 3. Update handle_colors: drop texture_url, add pattern_preset_id (FK added later)
ALTER TABLE public.handle_colors
  DROP COLUMN IF EXISTS texture_url,
  ADD COLUMN IF NOT EXISTS pattern_preset_id uuid;

-- 4. New table: handle_geometries (one per bag_view)
CREATE TABLE public.handle_geometries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_view_id uuid NOT NULL UNIQUE REFERENCES public.bag_views(id) ON DELETE CASCADE,
  mask_url text,
  shadow_url text,
  highlight_url text,
  details_url text,
  hardware_url text,
  path_json jsonb NOT NULL DEFAULT '{"paths":[]}'::jsonb,
  default_width numeric NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.handle_geometries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read handle_geometries"   ON public.handle_geometries FOR SELECT USING (true);
CREATE POLICY "Public insert handle_geometries" ON public.handle_geometries FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update handle_geometries" ON public.handle_geometries FOR UPDATE USING (true);
CREATE POLICY "Public delete handle_geometries" ON public.handle_geometries FOR DELETE USING (true);

CREATE TRIGGER update_handle_geometries_updated_at
  BEFORE UPDATE ON public.handle_geometries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. New table: handle_pattern_presets (global, reusable)
CREATE TABLE public.handle_pattern_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  stripe_count integer NOT NULL DEFAULT 3 CHECK (stripe_count BETWEEN 1 AND 12),
  preset_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.handle_pattern_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read handle_pattern_presets"   ON public.handle_pattern_presets FOR SELECT USING (true);
CREATE POLICY "Public insert handle_pattern_presets" ON public.handle_pattern_presets FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update handle_pattern_presets" ON public.handle_pattern_presets FOR UPDATE USING (true);
CREATE POLICY "Public delete handle_pattern_presets" ON public.handle_pattern_presets FOR DELETE USING (true);

CREATE TRIGGER update_handle_pattern_presets_updated_at
  BEFORE UPDATE ON public.handle_pattern_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Add FK from handle_colors.pattern_preset_id (nullable, ON DELETE SET NULL)
ALTER TABLE public.handle_colors
  ADD CONSTRAINT handle_colors_pattern_preset_id_fkey
  FOREIGN KEY (pattern_preset_id) REFERENCES public.handle_pattern_presets(id) ON DELETE SET NULL;