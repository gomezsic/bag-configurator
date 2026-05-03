/**
 * useRenderingData
 * 
 * Fetches all data needed to render a bag configuration from Supabase.
 * Transforms database rows into RenderScene format.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  RenderScene,
  RenderView,
  RenderMaskZone,
  RenderLayerOrder,
  RenderEmbroideryPlacement,
  RenderSelection,
  BlendMode,
  RepeatMode,
  ZoneCategory,
} from '@/engine/types';
import { DEFAULT_LAYER_ORDER } from '@/engine/types';

interface UseRenderingDataParams {
  bagModelId: string | null;
  viewType?: string;
  fabricId: string | null;
  handleId: string | null;
  handleColorId: string | null;
  embroideryId: string | null;
  /**
   * Moltiplicatore opzionale applicato al `fabricPatternScale` letto dal DB.
   * Permette di esporre uno slider "grana texture" nell'UI senza alterare i dati.
   * Default: 1 (nessuna variazione).
   */
  fabricScaleMultiplier?: number;
  /** Numero di passate multiply su overlay_shadows (default 1). */
  shadowsBoost?: number;
  /** Numero di passate screen su overlay_highlights (default 1). */
  highlightsBoost?: number;
}

/** Fetch the view data for a bag model */
function useBagView(bagModelId: string | null, viewType: string = 'front') {
  return useQuery({
    queryKey: ['bag-view', bagModelId, viewType],
    queryFn: async () => {
      if (!bagModelId) return null;

      const { data: view, error } = await supabase
        .from('bag_views')
        .select('*')
        .eq('bag_model_id', bagModelId)
        .eq('view_type', viewType)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return view;
    },
    enabled: !!bagModelId,
  });
}

/** Fetch mask zones for a view */
function useMaskZones(viewId: string | null) {
  return useQuery({
    queryKey: ['mask-zones', viewId],
    queryFn: async () => {
      if (!viewId) return [];

      const { data, error } = await supabase
        .from('mask_zones')
        .select('*')
        .eq('bag_view_id', viewId)
        .order('z_index', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!viewId,
  });
}

/** Fetch layer order rules for a view */
function useLayerOrder(viewId: string | null) {
  return useQuery({
    queryKey: ['layer-order', viewId],
    queryFn: async () => {
      if (!viewId) return [];

      const { data, error } = await supabase
        .from('layer_order_rules')
        .select('*')
        .eq('bag_view_id', viewId)
        .eq('is_active', true)
        .order('z_index', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!viewId,
  });
}

/** Fetch embroidery placement for a view */
function useEmbroideryPlacement(viewId: string | null) {
  return useQuery({
    queryKey: ['embroidery-placement', viewId],
    queryFn: async () => {
      if (!viewId) return null;

      const { data, error } = await supabase
        .from('embroidery_placements')
        .select('*')
        .eq('bag_view_id', viewId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!viewId,
  });
}

/** Fetch fabric texture info */
function useFabricTexture(fabricId: string | null) {
  return useQuery({
    queryKey: ['fabric-texture', fabricId],
    queryFn: async () => {
      if (!fabricId) return null;

      const { data, error } = await supabase
        .from('fabrics')
        .select('texture_url, pattern_scale, repeat_mode')
        .eq('id', fabricId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!fabricId,
  });
}

/** Fetch handle color texture info (legacy, restituisce null) */
function useHandleTexture(handleId: string | null, handleColorId: string | null) {
  return useQuery({
    queryKey: ['handle-texture', handleId, handleColorId],
    queryFn: async () => {
      if (!handleColorId) return null;
      // Vecchio sistema dismesso: il manico è ora renderizzato proceduralmente
      // dal nuovo handle stripe renderer (path + preset). Vedi useHandleGeometry/useHandlePreset.
      return { textureUrl: null as string | null, patternScale: 1 };
    },
    enabled: !!handleColorId,
  });
}

/** Fetch handle geometry (path + asset PNG) per la vista corrente */
function useHandleGeometry(viewId: string | null) {
  return useQuery({
    queryKey: ['handle-geometry-render', viewId],
    queryFn: async () => {
      if (!viewId) return null;
      const { data, error } = await supabase
        .from('handle_geometries')
        .select('id, mask_url, shadow_url, highlight_url, details_url, hardware_url, path_json')
        .eq('bag_view_id', viewId)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!viewId,
  });
}

/** Fetch side parts (fettuccine laterali) collegate alla handle geometry corrente */
function useHandleSideParts(handleGeometryId: string | null) {
  return useQuery({
    queryKey: ['handle-side-parts', handleGeometryId],
    queryFn: async () => {
      if (!handleGeometryId) return [];
      const { data, error } = await supabase
        .from('handle_side_parts')
        .select('id, part_id, mask_url, shadow_url, highlight_url, path_json, rotation')
        .eq('handle_geometry_id', handleGeometryId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!handleGeometryId,
  });
}

/**
 * Fetch della "corda" selezionata dal catalogo globale.
 * `handleColorId` è in realtà l'id di cord_collection.
 * Ritorna { preset, textureUrl }: solo uno dei due sarà valorizzato in base
 * a style_type ('pattern_preset' | 'texture').
 */
function useHandlePreset(handleColorId: string | null) {
  return useQuery({
    queryKey: ['cord-style-for-id', handleColorId],
    queryFn: async () => {
      if (!handleColorId) return null;
      const { data: cord, error: cErr } = await supabase
        .from('cord_collection')
        .select('style_type, texture_url, pattern_preset_id')
        .eq('id', handleColorId)
        .maybeSingle();
      if (cErr) throw cErr;
      if (!cord) return null;
      if (cord.style_type === 'texture') {
        return { preset: null, textureUrl: cord.texture_url };
      }
      if (cord.style_type === 'pattern_preset' && cord.pattern_preset_id) {
        const { data: preset, error: pErr } = await supabase
          .from('handle_pattern_presets')
          .select('preset_json')
          .eq('id', cord.pattern_preset_id)
          .maybeSingle();
        if (pErr) throw pErr;
        return { preset: preset?.preset_json ?? null, textureUrl: null };
      }
      return null;
    },
    enabled: !!handleColorId,
  });
}

/** Fetch embroidery image */
function useEmbroideryImage(embroideryId: string | null) {
  return useQuery({
    queryKey: ['embroidery-image', embroideryId],
    queryFn: async () => {
      if (!embroideryId) return null;

      const { data, error } = await supabase
        .from('embroideries')
        .select('image_url')
        .eq('id', embroideryId)
        .maybeSingle();

      if (error) throw error;
      return data?.image_url ?? null;
    },
    enabled: !!embroideryId,
  });
}

/**
 * Main hook: assembles a complete RenderScene from Supabase data.
 */
export function useRenderingData(params: UseRenderingDataParams) {
  const { bagModelId, viewType = 'front', fabricId, handleId, handleColorId, embroideryId, fabricScaleMultiplier = 1, shadowsBoost = 1, highlightsBoost = 1 } = params;

  const viewQuery = useBagView(bagModelId, viewType);
  const viewId = viewQuery.data?.id ?? null;

  const maskQuery = useMaskZones(viewId);
  const layerQuery = useLayerOrder(viewId);
  const embPlacementQuery = useEmbroideryPlacement(viewId);
  const fabricQuery = useFabricTexture(fabricId);
  const handleQuery = useHandleTexture(handleId, handleColorId);
  const handleGeometryQuery = useHandleGeometry(viewId);
  const handleGeometryId = handleGeometryQuery.data?.id ?? null;
  const handleSidePartsQuery = useHandleSideParts(handleGeometryId);
  const handlePresetQuery = useHandlePreset(handleColorId);
  const embImageQuery = useEmbroideryImage(embroideryId);

  const isLoading =
    viewQuery.isLoading ||
    maskQuery.isLoading ||
    layerQuery.isLoading ||
    embPlacementQuery.isLoading ||
    fabricQuery.isLoading ||
    handleQuery.isLoading ||
    handleGeometryQuery.isLoading ||
    handleSidePartsQuery.isLoading ||
    handlePresetQuery.isLoading ||
    embImageQuery.isLoading;

  const error =
    viewQuery.error || maskQuery.error || layerQuery.error || fabricQuery.error || handleQuery.error;

  // Build the RenderScene
  let scene: RenderScene | null = null;

  if (viewQuery.data && maskQuery.data) {
    const view = viewQuery.data;

    const maskZones: RenderMaskZone[] = (maskQuery.data ?? []).map(z => ({
      id: z.id,
      zoneType: z.zone_type,
      zoneCategory: z.zone_category as ZoneCategory,
      label: z.label,
      maskImageUrl: z.mask_image_url,
      localOverlayUrl: z.local_overlay_url,
      zIndex: z.z_index,
      blendMode: z.blend_mode as BlendMode,
      shadingStrength: (z as { shading_strength?: number }).shading_strength ?? 1,
      tintColor: (z as { tint_color?: string | null }).tint_color ?? null,
      textureUrl: (z as { texture_url?: string | null }).texture_url ?? null,
      transform: {
        scale: z.texture_scale,
        offsetX: z.texture_offset_x,
        offsetY: z.texture_offset_y,
        rotation: z.texture_rotation,
        repeatMode: z.texture_repeat_mode as RepeatMode,
        scaleCorrectionFactor: z.scale_correction_factor,
      },
    }));

    const layerOrder: RenderLayerOrder[] =
      (layerQuery.data?.length ?? 0) > 0
        ? layerQuery.data!.map(l => ({
            layerType: l.layer_type as any,
            zIndex: l.z_index,
            blendMode: l.blend_mode as BlendMode,
            opacity: l.opacity,
            isActive: l.is_active,
          }))
        : DEFAULT_LAYER_ORDER;

    const embroideryPlacement: RenderEmbroideryPlacement | null = embPlacementQuery.data
      ? {
          positionX: embPlacementQuery.data.position_x,
          positionY: embPlacementQuery.data.position_y,
          maxWidth: embPlacementQuery.data.max_width,
          maxHeight: embPlacementQuery.data.max_height,
          scale: embPlacementQuery.data.scale,
          rotation: embPlacementQuery.data.rotation,
        }
      : null;

    // Build typed overlays from the dedicated columns on bag_views.
    // The composer picks them up via layerType 'overlay_shadows', etc.
    const overlays: RenderView['overlays'] = [];
    const vAny = view as unknown as {
      overlay_shadows_url: string | null;
      overlay_highlights_url: string | null;
      overlay_details_url: string | null;
    };
    if (vAny.overlay_shadows_url) {
      overlays.push({ type: 'shadows', url: vAny.overlay_shadows_url, blendMode: 'multiply', opacity: 1 });
    }
    if (vAny.overlay_highlights_url) {
      overlays.push({ type: 'highlights', url: vAny.overlay_highlights_url, blendMode: 'screen', opacity: 0.85 });
    }
    if (vAny.overlay_details_url) {
      overlays.push({ type: 'details', url: vAny.overlay_details_url, blendMode: 'normal', opacity: 1 });
    }

    const handleGeometry = handleGeometryQuery.data
      ? {
          pathDocument: handleGeometryQuery.data.path_json,
          maskUrl: handleGeometryQuery.data.mask_url,
          shadowUrl: handleGeometryQuery.data.shadow_url,
          highlightUrl: handleGeometryQuery.data.highlight_url,
          detailsUrl: handleGeometryQuery.data.details_url,
          hardwareUrl: handleGeometryQuery.data.hardware_url,
          sideParts: (handleSidePartsQuery.data ?? []).map((sp) => ({
            id: sp.id,
            partId: sp.part_id,
            pathDocument: sp.path_json,
            maskUrl: sp.mask_url,
            shadowUrl: sp.shadow_url,
            highlightUrl: sp.highlight_url,
            rotation: Number(sp.rotation ?? 0),
          })),
        }
      : null;

    const renderView: RenderView = {
      id: view.id,
      viewType: view.view_type,
      canvasWidth: view.canvas_width,
      canvasHeight: view.canvas_height,
      baseImageUrl: view.base_image_url,
      overlayUrl: view.overlay_url,
      overlays,
      maskZones,
      layerOrder,
      embroideryPlacement,
      handleGeometry,
    };

    const selection: RenderSelection = {
      fabricTextureUrl: fabricQuery.data?.texture_url ?? null,
      fabricPatternScale: (fabricQuery.data?.pattern_scale ?? 1) * fabricScaleMultiplier,
      fabricRepeatMode: (fabricQuery.data?.repeat_mode as RepeatMode) ?? 'repeat',
      handleTextureUrl: handlePresetQuery.data?.textureUrl ?? null,
      handlePatternScale: 1,
      handlePreset: handlePresetQuery.data?.preset ?? null,
      embroideryImageUrl: embImageQuery.data ?? null,
      shadowsBoost,
      highlightsBoost,
    };

    scene = { view: renderView, selection };
  }

  return { scene, isLoading, error };
}
