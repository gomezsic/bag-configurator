
-- =============================================
-- PHASE 2B: RENDERING ENGINE SCHEMA EVOLUTION
-- =============================================

-- 1. EVOLVE bag_views: add canvas dimensions and asset notes
ALTER TABLE public.bag_views
  ADD COLUMN canvas_width INTEGER NOT NULL DEFAULT 2000,
  ADD COLUMN canvas_height INTEGER NOT NULL DEFAULT 2000,
  ADD COLUMN asset_notes TEXT;

-- 2. EVOLVE mask_zones: remove rigid zone_type constraint, add texture transform params
-- First drop the old constraint and unique
ALTER TABLE public.mask_zones DROP CONSTRAINT IF EXISTS mask_zones_zone_type_check;
ALTER TABLE public.mask_zones DROP CONSTRAINT IF EXISTS mask_zones_bag_view_id_zone_type_key;

-- Add new columns for flexible zone management
ALTER TABLE public.mask_zones
  ADD COLUMN zone_category TEXT NOT NULL DEFAULT 'fabric' CHECK (zone_category IN ('fabric', 'handle', 'embroidery', 'overlay')),
  ADD COLUMN label TEXT,
  ADD COLUMN texture_scale DECIMAL(6,4) NOT NULL DEFAULT 1.0,
  ADD COLUMN texture_offset_x DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN texture_offset_y DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN texture_rotation DECIMAL(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN texture_repeat_mode TEXT NOT NULL DEFAULT 'repeat' CHECK (texture_repeat_mode IN ('repeat', 'clamp', 'mirror')),
  ADD COLUMN scale_correction_factor DECIMAL(6,4) NOT NULL DEFAULT 1.0,
  ADD COLUMN local_overlay_url TEXT,
  ADD COLUMN blend_mode TEXT NOT NULL DEFAULT 'normal' CHECK (blend_mode IN ('normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light'));

-- Re-add a flexible unique constraint (view + zone_type must be unique)
ALTER TABLE public.mask_zones ADD CONSTRAINT mask_zones_view_zone_unique UNIQUE(bag_view_id, zone_type);

-- Remove old rigid check, allow any text for zone_type (e.g. handle_left_outer, handle_right_inner, etc.)
-- zone_type is now freeform text validated by the app

-- 3. EVOLVE fabrics: add global pattern scale and default repeat
ALTER TABLE public.fabrics
  ADD COLUMN pattern_scale DECIMAL(6,4) NOT NULL DEFAULT 1.0,
  ADD COLUMN repeat_mode TEXT NOT NULL DEFAULT 'repeat' CHECK (repeat_mode IN ('repeat', 'clamp', 'mirror'));

-- 4. EVOLVE handles: add default pattern scale
ALTER TABLE public.handles
  ADD COLUMN pattern_scale DECIMAL(6,4) NOT NULL DEFAULT 1.0;

-- 5. NEW TABLE: embroidery_placements (posizionamento ricamo per vista)
CREATE TABLE public.embroidery_placements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bag_view_id UUID NOT NULL REFERENCES public.bag_views(id) ON DELETE CASCADE,
  position_x DECIMAL(6,2) NOT NULL DEFAULT 50,
  position_y DECIMAL(6,2) NOT NULL DEFAULT 50,
  max_width DECIMAL(8,2) NOT NULL DEFAULT 200,
  max_height DECIMAL(8,2) NOT NULL DEFAULT 100,
  scale DECIMAL(6,4) NOT NULL DEFAULT 1.0,
  rotation DECIMAL(6,2) NOT NULL DEFAULT 0,
  safe_area_json JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bag_view_id)
);

-- 6. NEW TABLE: layer_order_rules (ordine layer per vista, configurabile)
CREATE TABLE public.layer_order_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bag_view_id UUID NOT NULL REFERENCES public.bag_views(id) ON DELETE CASCADE,
  layer_type TEXT NOT NULL CHECK (layer_type IN (
    'base', 'fabric', 'fabric_overlay', 'handle', 'handle_overlay', 'embroidery', 'global_overlay'
  )),
  z_index INTEGER NOT NULL DEFAULT 0,
  blend_mode TEXT NOT NULL DEFAULT 'normal' CHECK (blend_mode IN ('normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light')),
  opacity DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bag_view_id, layer_type)
);

-- INDEXES
CREATE INDEX idx_embroidery_placements_view ON public.embroidery_placements(bag_view_id);
CREATE INDEX idx_layer_order_view ON public.layer_order_rules(bag_view_id);
CREATE INDEX idx_mask_zones_category ON public.mask_zones(zone_category);

-- ENABLE RLS on new tables
ALTER TABLE public.embroidery_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layer_order_rules ENABLE ROW LEVEL SECURITY;

-- Public read policies (consistent with existing tables)
CREATE POLICY "Public read embroidery_placements" ON public.embroidery_placements FOR SELECT USING (true);
CREATE POLICY "Public read layer_order_rules" ON public.layer_order_rules FOR SELECT USING (true);

-- TRIGGERS for updated_at
CREATE TRIGGER update_embroidery_placements_updated_at BEFORE UPDATE ON public.embroidery_placements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_layer_order_rules_updated_at BEFORE UPDATE ON public.layer_order_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
