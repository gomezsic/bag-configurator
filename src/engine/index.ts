/**
 * Bag Configurator Rendering Engine
 * 
 * Public API for the 2D layer composition engine.
 */

export { composeScene } from './layerComposer';
export { loadImage, loadImages, preloadSceneAssets, clearAssetCache, getCacheStats } from './assetLoader';
export { renderTexturedZone, renderOverlay, renderEmbroidery, renderBaseImage } from './textureRenderer';
export { validateView, validateImageDimensions, validateSceneAssets, validateZoneNames, validateNoOverlap } from './assetValidator';
export { DEFAULT_LAYER_ORDER, STANDARD_FABRIC_ZONES, STANDARD_HANDLE_ZONES, STANDARD_OVERLAYS } from './types';
export type {
  RenderScene,
  RenderView,
  RenderMaskZone,
  RenderSelection,
  RenderLayerOrder,
  RenderEmbroideryPlacement,
  ViewOverlay,
  TextureTransform,
  BlendMode,
  RepeatMode,
  ZoneCategory,
  LayerType,
} from './types';
