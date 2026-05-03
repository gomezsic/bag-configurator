
-- Collezione globale di "corde/stili manico" riutilizzabili tra modelli
CREATE TABLE public.cord_collection (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  style_type TEXT NOT NULL CHECK (style_type IN ('texture', 'pattern_preset')),
  texture_url TEXT,
  texture_scale NUMERIC NOT NULL DEFAULT 1.0,
  texture_rotation NUMERIC NOT NULL DEFAULT 0,
  pattern_preset_id UUID REFERENCES public.handle_pattern_presets(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cord_collection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read cord_collection" ON public.cord_collection FOR SELECT USING (true);
CREATE POLICY "Public insert cord_collection" ON public.cord_collection FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update cord_collection" ON public.cord_collection FOR UPDATE USING (true);
CREATE POLICY "Public delete cord_collection" ON public.cord_collection FOR DELETE USING (true);

CREATE TRIGGER update_cord_collection_updated_at
BEFORE UPDATE ON public.cord_collection
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mappatura corda <-> tipo manico (molti-a-molti)
CREATE TABLE public.cord_handle_compatibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cord_id UUID NOT NULL REFERENCES public.cord_collection(id) ON DELETE CASCADE,
  handle_id UUID NOT NULL REFERENCES public.handles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (cord_id, handle_id)
);

ALTER TABLE public.cord_handle_compatibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read cord_compat" ON public.cord_handle_compatibility FOR SELECT USING (true);
CREATE POLICY "Public insert cord_compat" ON public.cord_handle_compatibility FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete cord_compat" ON public.cord_handle_compatibility FOR DELETE USING (true);

CREATE INDEX idx_cord_compat_handle ON public.cord_handle_compatibility(handle_id);
CREATE INDEX idx_cord_compat_cord ON public.cord_handle_compatibility(cord_id);

-- Migrazione dati: sposta gli handle_colors esistenti dentro cord_collection
-- mantenendo il legame col tipo manico
DO $$
DECLARE
  rec RECORD;
  new_cord_id UUID;
BEGIN
  FOR rec IN
    SELECT id, handle_id, color_name, thumbnail_url, texture_url,
           texture_scale, texture_rotation, pattern_preset_id, is_active, sort_order
    FROM public.handle_colors
  LOOP
    INSERT INTO public.cord_collection (
      name, thumbnail_url, style_type, texture_url, texture_scale,
      texture_rotation, pattern_preset_id, is_active, sort_order
    ) VALUES (
      rec.color_name,
      rec.thumbnail_url,
      CASE WHEN rec.texture_url IS NOT NULL THEN 'texture' ELSE 'pattern_preset' END,
      rec.texture_url,
      COALESCE(rec.texture_scale, 1.0),
      COALESCE(rec.texture_rotation, 0),
      rec.pattern_preset_id,
      rec.is_active,
      rec.sort_order
    ) RETURNING id INTO new_cord_id;

    INSERT INTO public.cord_handle_compatibility (cord_id, handle_id)
    VALUES (new_cord_id, rec.handle_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
