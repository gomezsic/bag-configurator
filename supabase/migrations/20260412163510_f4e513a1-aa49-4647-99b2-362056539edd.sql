
-- BAG MODELS
CREATE TABLE public.bag_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  shopify_product_id TEXT,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BAG VIEWS
CREATE TABLE public.bag_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bag_model_id UUID NOT NULL REFERENCES public.bag_models(id) ON DELETE CASCADE,
  view_type TEXT NOT NULL CHECK (view_type IN ('front', 'three_quarter', 'back', 'side')),
  base_image_url TEXT,
  overlay_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bag_model_id, view_type)
);

-- MASK ZONES
CREATE TABLE public.mask_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bag_view_id UUID NOT NULL REFERENCES public.bag_views(id) ON DELETE CASCADE,
  zone_type TEXT NOT NULL CHECK (zone_type IN (
    'fabric_1', 'fabric_2', 'fabric_3', 'fabric_4',
    'handle_1', 'handle_2', 'handle_3', 'handle_4',
    'embroidery'
  )),
  mask_image_url TEXT,
  z_index INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bag_view_id, zone_type)
);

-- FABRICS
CREATE TABLE public.fabrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  texture_url TEXT,
  thumbnail_url TEXT,
  price_modifier DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HANDLES
CREATE TABLE public.handles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HANDLE COLORS
CREATE TABLE public.handle_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  handle_id UUID NOT NULL REFERENCES public.handles(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  color_hex TEXT NOT NULL DEFAULT '#000000',
  texture_url TEXT,
  thumbnail_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- EMBROIDERIES
CREATE TABLE public.embroideries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT,
  thumbnail_url TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COMPATIBILITY RULES
CREATE TABLE public.compatibility_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'fabric_model', 'handle_model', 'fabric_handle', 'embroidery_model', 'embroidery_fabric'
  )),
  entity_a_id UUID NOT NULL,
  entity_b_id UUID NOT NULL,
  is_allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rule_type, entity_a_id, entity_b_id)
);

-- PRICING RULES
CREATE TABLE public.pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bag_model_id UUID NOT NULL REFERENCES public.bag_models(id) ON DELETE CASCADE,
  fabric_id UUID NOT NULL REFERENCES public.fabrics(id) ON DELETE CASCADE,
  final_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bag_model_id, fabric_id)
);

-- CONFIGURATIONS
CREATE TABLE public.configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  bag_model_id UUID NOT NULL REFERENCES public.bag_models(id),
  fabric_id UUID NOT NULL REFERENCES public.fabrics(id),
  handle_id UUID NOT NULL REFERENCES public.handles(id),
  handle_color_id UUID NOT NULL REFERENCES public.handle_colors(id),
  embroidery_id UUID REFERENCES public.embroideries(id),
  final_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  preview_url TEXT,
  shopify_product_id TEXT,
  shopify_variant_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'purchased')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

-- INDEXES
CREATE INDEX idx_bag_views_model ON public.bag_views(bag_model_id);
CREATE INDEX idx_mask_zones_view ON public.mask_zones(bag_view_id);
CREATE INDEX idx_handle_colors_handle ON public.handle_colors(handle_id);
CREATE INDEX idx_compatibility_type ON public.compatibility_rules(rule_type);
CREATE INDEX idx_compatibility_entities ON public.compatibility_rules(entity_a_id, entity_b_id);
CREATE INDEX idx_pricing_model ON public.pricing_rules(bag_model_id);
CREATE INDEX idx_pricing_fabric ON public.pricing_rules(fabric_id);
CREATE INDEX idx_configurations_session ON public.configurations(session_id);
CREATE INDEX idx_configurations_status ON public.configurations(status);

-- ENABLE RLS
ALTER TABLE public.bag_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bag_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mask_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handle_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embroideries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compatibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ for catalog tables
CREATE POLICY "Public read bag_models" ON public.bag_models FOR SELECT USING (true);
CREATE POLICY "Public read bag_views" ON public.bag_views FOR SELECT USING (true);
CREATE POLICY "Public read mask_zones" ON public.mask_zones FOR SELECT USING (true);
CREATE POLICY "Public read fabrics" ON public.fabrics FOR SELECT USING (true);
CREATE POLICY "Public read handles" ON public.handles FOR SELECT USING (true);
CREATE POLICY "Public read handle_colors" ON public.handle_colors FOR SELECT USING (true);
CREATE POLICY "Public read embroideries" ON public.embroideries FOR SELECT USING (true);
CREATE POLICY "Public read compatibility_rules" ON public.compatibility_rules FOR SELECT USING (true);
CREATE POLICY "Public read pricing_rules" ON public.pricing_rules FOR SELECT USING (true);

-- CONFIGURATIONS: session-based, no auth required
CREATE POLICY "Public insert configurations" ON public.configurations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read configurations" ON public.configurations FOR SELECT USING (true);
CREATE POLICY "Public update configurations" ON public.configurations FOR UPDATE USING (true);

-- UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_bag_models_updated_at BEFORE UPDATE ON public.bag_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bag_views_updated_at BEFORE UPDATE ON public.bag_views FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mask_zones_updated_at BEFORE UPDATE ON public.mask_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fabrics_updated_at BEFORE UPDATE ON public.fabrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_handles_updated_at BEFORE UPDATE ON public.handles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_handle_colors_updated_at BEFORE UPDATE ON public.handle_colors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_embroideries_updated_at BEFORE UPDATE ON public.embroideries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_compatibility_rules_updated_at BEFORE UPDATE ON public.compatibility_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_configurations_updated_at BEFORE UPDATE ON public.configurations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) VALUES ('configurator-assets', 'configurator-assets', true);
CREATE POLICY "Public read configurator assets" ON storage.objects FOR SELECT USING (bucket_id = 'configurator-assets');
CREATE POLICY "Authenticated upload configurator assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'configurator-assets');
CREATE POLICY "Authenticated update configurator assets" ON storage.objects FOR UPDATE USING (bucket_id = 'configurator-assets');
CREATE POLICY "Authenticated delete configurator assets" ON storage.objects FOR DELETE USING (bucket_id = 'configurator-assets');
