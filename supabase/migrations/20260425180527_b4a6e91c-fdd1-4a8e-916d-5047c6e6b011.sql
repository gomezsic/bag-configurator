-- Tabella per le fettuccine laterali del manico
CREATE TABLE public.handle_side_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  handle_geometry_id UUID NOT NULL REFERENCES public.handle_geometries(id) ON DELETE CASCADE,
  part_id TEXT NOT NULL,                -- es. 'side_left', 'side_right'
  mask_url TEXT,                        -- maschera PNG della fettuccina
  path_json JSONB NOT NULL DEFAULT '{"paths": []}'::jsonb, -- mini-centerline
  shadow_url TEXT,                      -- overlay ombre dedicato (opzionale)
  highlight_url TEXT,                   -- overlay luci dedicato (opzionale)
  rotation NUMERIC NOT NULL DEFAULT 0,  -- rotazione locale in gradi
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (handle_geometry_id, part_id)
);

CREATE INDEX idx_handle_side_parts_geometry ON public.handle_side_parts(handle_geometry_id);

ALTER TABLE public.handle_side_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read handle_side_parts"
  ON public.handle_side_parts FOR SELECT USING (true);

CREATE POLICY "Public insert handle_side_parts"
  ON public.handle_side_parts FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update handle_side_parts"
  ON public.handle_side_parts FOR UPDATE USING (true);

CREATE POLICY "Public delete handle_side_parts"
  ON public.handle_side_parts FOR DELETE USING (true);

CREATE TRIGGER update_handle_side_parts_updated_at
  BEFORE UPDATE ON public.handle_side_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();