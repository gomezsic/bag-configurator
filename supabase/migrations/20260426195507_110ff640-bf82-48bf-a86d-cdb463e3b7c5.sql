-- Tabella colori per tessuti (modalità "matrice B/N + tinta multiply")
CREATE TABLE public.fabric_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fabric_id uuid NOT NULL REFERENCES public.fabrics(id) ON DELETE CASCADE,
  name text NOT NULL,
  hex text NOT NULL DEFAULT '#ffffff',
  thumbnail_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fabric_colors_fabric_id ON public.fabric_colors(fabric_id);

ALTER TABLE public.fabric_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fabric_colors"
  ON public.fabric_colors FOR SELECT
  USING (true);

CREATE POLICY "Public insert fabric_colors"
  ON public.fabric_colors FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update fabric_colors"
  ON public.fabric_colors FOR UPDATE
  USING (true);

CREATE POLICY "Public delete fabric_colors"
  ON public.fabric_colors FOR DELETE
  USING (true);

-- Trigger updated_at (riusa la funzione standard se esiste, altrimenti la creo)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_fabric_colors_updated_at
  BEFORE UPDATE ON public.fabric_colors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();