-- 1) Tabella handle_color_mappings: maschere riusabili per N° righe
CREATE TABLE public.handle_color_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  stripe_count INTEGER NOT NULL DEFAULT 3,
  texture_url TEXT,
  samples JSONB NOT NULL DEFAULT '[]'::jsonb,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.handle_color_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read handle_color_mappings"
  ON public.handle_color_mappings FOR SELECT USING (true);
CREATE POLICY "Public insert handle_color_mappings"
  ON public.handle_color_mappings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update handle_color_mappings"
  ON public.handle_color_mappings FOR UPDATE USING (true);
CREATE POLICY "Public delete handle_color_mappings"
  ON public.handle_color_mappings FOR DELETE USING (true);

-- Reuse the existing trigger function for updated_at if it exists, else create one
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_handle_color_mappings_updated_at
  BEFORE UPDATE ON public.handle_color_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Estensione handles: stripe_count, mapping_id, thumbnail_url
ALTER TABLE public.handles
  ADD COLUMN IF NOT EXISTS stripe_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mapping_id UUID REFERENCES public.handle_color_mappings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Allow admin CRUD on handles (currently only public read)
CREATE POLICY "Public insert handles"
  ON public.handles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update handles"
  ON public.handles FOR UPDATE USING (true);
CREATE POLICY "Public delete handles"
  ON public.handles FOR DELETE USING (true);

-- 3) Estensione handle_colors: colors JSONB (array di hex per i preset multi-riga)
ALTER TABLE public.handle_colors
  ADD COLUMN IF NOT EXISTS colors JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE POLICY "Public insert handle_colors"
  ON public.handle_colors FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update handle_colors"
  ON public.handle_colors FOR UPDATE USING (true);
CREATE POLICY "Public delete handle_colors"
  ON public.handle_colors FOR DELETE USING (true);

-- 4) Allow admin CRUD on bag_models, bag_views, fabrics, embroideries (currently only read)
CREATE POLICY "Public insert bag_models"
  ON public.bag_models FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update bag_models"
  ON public.bag_models FOR UPDATE USING (true);
CREATE POLICY "Public delete bag_models"
  ON public.bag_models FOR DELETE USING (true);

CREATE POLICY "Public insert bag_views"
  ON public.bag_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update bag_views"
  ON public.bag_views FOR UPDATE USING (true);
CREATE POLICY "Public delete bag_views"
  ON public.bag_views FOR DELETE USING (true);

CREATE POLICY "Public insert fabrics"
  ON public.fabrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update fabrics"
  ON public.fabrics FOR UPDATE USING (true);
CREATE POLICY "Public delete fabrics"
  ON public.fabrics FOR DELETE USING (true);

-- 5) Storage bucket pubblico per asset admin (texture mapping, thumbnails, base images)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('admin-assets', 'admin-assets', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read admin-assets"
  ON storage.objects FOR SELECT USING (bucket_id = 'admin-assets');
CREATE POLICY "Public upload admin-assets"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'admin-assets');
CREATE POLICY "Public update admin-assets"
  ON storage.objects FOR UPDATE USING (bucket_id = 'admin-assets');
CREATE POLICY "Public delete admin-assets"
  ON storage.objects FOR DELETE USING (bucket_id = 'admin-assets');