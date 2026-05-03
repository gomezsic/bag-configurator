/**
 * Rendering Engine Types
 * 
 * These types represent the rendering-specific data structures used by the
 * canvas composition pipeline. They map closely to the database schema but
 * are optimized for the rendering context.
 * 
 * ASSET SPEC (v1):
 * - All assets for a view share identical canvas dimensions (e.g. 1762×1770)
 * - PNG 32-bit RGBA, transparent background
 * - Masks: white (#FFFFFF) on transparent, feather 1-3px, no hardware/metal
 * - Overlays: grayscale on transparent
 * - No resizing, cropping, rotation or displacement between files
 */

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light';
export type RepeatMode = 'repeat' | 'clamp' | 'mirror';
export type ZoneCategory = 'fabric' | 'handle' | 'embroidery' | 'overlay';

/**
 * Layer types for the composition pipeline.
 * 
 * For the bauletto 3/4 reference:
 *   base              → base_image.png (silhouette/neutral)
 *   fabric            → fabric_front, fabric_side, fabric_bottom, fabric_top
 *   handle            → handle_left, handle_right, handle_strap, handle_loops
 *   embroidery        → positioned embroidery artwork
 *   overlay_shadows   → overlay_shadows.png  (blend: multiply)
 *   overlay_highlights→ overlay_highlights.png (blend: screen)
 *   overlay_details   → overlay_details.png   (blend: normal)
 */
export type LayerType =
  | 'base'
  | 'fabric'
  | 'fabric_overlay'
  | 'handle'
  | 'handle_overlay'
  | 'embroidery'
  | 'overlay_shadows'
  | 'overlay_highlights'
  | 'overlay_details'
  | 'overlay_zones' // mask_zones di categoria 'overlay' (cerniera, hardware decorativi)
  | 'global_overlay'; // kept for backward compat

/** Overlay descriptor stored on the view */
export interface ViewOverlay {
  type: 'shadows' | 'highlights' | 'details';
  url: string;
  blendMode: BlendMode;
  opacity: number;
}

/** Transform parameters for applying a texture to a mask zone */
export interface TextureTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number; // degrees
  repeatMode: RepeatMode;
  scaleCorrectionFactor: number;
}

/** A single mask zone with all rendering parameters */
export interface RenderMaskZone {
  id: string;
  zoneType: string;
  zoneCategory: ZoneCategory;
  label: string | null;
  maskImageUrl: string | null;
  localOverlayUrl: string | null;
  zIndex: number;
  blendMode: BlendMode;
  /**
   * How strongly the base image's shading shows through this zone (0-1+).
   * Used as the layer's globalAlpha when compositing the textured zone.
   * 1 = full shading from base, 0 = flat texture color.
   */
  shadingStrength: number;
  /**
   * Optional hex color used to tint overlay zones (e.g. zipper).
   * When set, the mask PNG is recolored: alpha is preserved, RGB replaced.
   */
  tintColor: string | null;
  /**
   * Optional per-zone texture override. When set, this URL replaces the
   * fabric texture selected by the user for this zone only. Useful for
   * giving sides/top a different fabric from the front.
   */
  textureUrl: string | null;
  transform: TextureTransform;
}

/**
 * Side part di un manico (es. fettuccina laterale vicino agli anelli).
 * Stesso preset di colori del manico principale, ma path/mask/overlay propri.
 */
export interface RenderHandleSidePart {
  id: string;
  partId: string; // 'side_left', 'side_right', ecc.
  /** HandlePathDocument — tipato come unknown per evitare cicli. */
  pathDocument: unknown;
  maskUrl: string | null;
  shadowUrl: string | null;
  highlightUrl: string | null;
  /** Rotazione locale opzionale (gradi), riservata per future ottimizzazioni di alignment. */
  rotation: number;
}

/**
 * Geometria fissa del manico per una vista (path centerline + assets PNG).
 * Vedi src/engine/handlePath.ts per il formato di pathDocument.
 */
export interface RenderHandleGeometry {
  // Tipato come unknown per evitare ciclo: caricato come HandlePathDocument lato consumer
  pathDocument: unknown;
  maskUrl: string | null;
  shadowUrl: string | null;
  highlightUrl: string | null;
  detailsUrl: string | null;
  hardwareUrl: string | null;
  /** Fettuccine laterali che usano lo stesso preset del manico principale. */
  sideParts: RenderHandleSidePart[];
}

/** A view of a bag model with all associated rendering data */
export interface RenderView {
  id: string;
  viewType: string;
  canvasWidth: number;
  canvasHeight: number;
  baseImageUrl: string | null;
  /** @deprecated Use overlays[] instead for new views */
  overlayUrl: string | null;
  /** Typed overlay layers (shadows, highlights, details) */
  overlays: ViewOverlay[];
  maskZones: RenderMaskZone[];
  layerOrder: RenderLayerOrder[];
  embroideryPlacement: RenderEmbroideryPlacement | null;
  /** Geometria manico (path + asset PNG). Null se la vista non ha manico configurato. */
  handleGeometry: RenderHandleGeometry | null;
}

/** Layer ordering rule */
export interface RenderLayerOrder {
  layerType: LayerType;
  zIndex: number;
  blendMode: BlendMode;
  opacity: number;
  isActive: boolean;
}

/** Embroidery placement for a view */
export interface RenderEmbroideryPlacement {
  positionX: number; // percentage
  positionY: number; // percentage
  maxWidth: number;
  maxHeight: number;
  scale: number;
  rotation: number;
}

/** Currently selected materials for rendering */
export interface RenderSelection {
  fabricTextureUrl: string | null;
  fabricPatternScale: number;
  fabricRepeatMode: RepeatMode;
  /** @deprecated Old handle texture mode — now handle is rendered procedurally via `handlePreset`. */
  handleTextureUrl: string | null;
  /** @deprecated Same as above. */
  handlePatternScale: number;
  /**
   * Preset selezionato per il rendering procedurale del manico.
   * Tipato come unknown per evitare cicli: il composer farà il cast a HandlePatternPreset.
   */
  handlePreset: unknown | null;
  embroideryImageUrl: string | null;
  /**
   * Numero di passate multiply applicate all'overlay_shadows globale (default 1).
   * Valori 2-3 amplificano le ombre profonde rendendo la borsa più 3D quando il
   * tessuto applicato è chiaro e l'overlay shadows originale ha poca densità.
   */
  shadowsBoost?: number;
  /**
   * Stesso meccanismo per gli highlights (screen ripetuto). Default 1.
   */
  highlightsBoost?: number;
}

/** Complete render scene — everything needed to draw one frame */
export interface RenderScene {
  view: RenderView;
  selection: RenderSelection;
}

/** Default layer order — updated per asset spec v1 */
export const DEFAULT_LAYER_ORDER: RenderLayerOrder[] = [
  { layerType: 'base', zIndex: 0, blendMode: 'normal', opacity: 1, isActive: true },
  { layerType: 'fabric', zIndex: 10, blendMode: 'normal', opacity: 1, isActive: true },
  { layerType: 'fabric_overlay', zIndex: 20, blendMode: 'multiply', opacity: 1, isActive: true },
  { layerType: 'handle', zIndex: 30, blendMode: 'normal', opacity: 1, isActive: true },
  { layerType: 'handle_overlay', zIndex: 40, blendMode: 'multiply', opacity: 1, isActive: true },
  { layerType: 'embroidery', zIndex: 50, blendMode: 'normal', opacity: 1, isActive: true },
  { layerType: 'overlay_shadows', zIndex: 60, blendMode: 'multiply', opacity: 1, isActive: true },
  { layerType: 'overlay_highlights', zIndex: 70, blendMode: 'screen', opacity: 0.8, isActive: true },
  { layerType: 'overlay_details', zIndex: 80, blendMode: 'normal', opacity: 1, isActive: true },
];

/**
 * Standard zone types per asset spec.
 * Used for validation and admin UI.
 */
export const STANDARD_FABRIC_ZONES = [
  'fabric_front',
  'fabric_side',
  'fabric_bottom',
  'fabric_top',
] as const;

export const STANDARD_HANDLE_ZONES = [
  'handle_left',
  'handle_right',
  'handle_strap',
  'handle_loops',
] as const;

export const STANDARD_OVERLAYS = [
  'overlay_shadows',
  'overlay_highlights',
  'overlay_details',
] as const;
