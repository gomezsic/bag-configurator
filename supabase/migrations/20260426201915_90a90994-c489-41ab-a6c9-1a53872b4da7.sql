ALTER TABLE public.fabric_colors
  ADD COLUMN IF NOT EXISTS derived_fabric_id uuid REFERENCES public.fabrics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fabric_colors_derived_fabric_id
  ON public.fabric_colors(derived_fabric_id);

COMMENT ON COLUMN public.fabric_colors.derived_fabric_id IS
  'Tessuto autonomo generato a partire da questo colore (matrice B/N moltiplicata per hex). Usato dal configuratore come scelta indipendente nello step Tessuto.';
