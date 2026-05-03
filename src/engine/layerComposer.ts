/**
 * Layer Composer
 * 
 * Orchestrates the full rendering pipeline for a bag view.
 * Reads the layer order rules and composes all layers in sequence.
 * 
 * Asset Spec v1 pipeline:
 *   base → fabric zones → fabric overlays → handle zones → handle overlays →
 *   embroidery → overlay_shadows (multiply) → overlay_highlights (screen) →
 *   overlay_details (normal)
 */

import type { RenderScene, RenderLayerOrder, RenderMaskZone, ViewOverlay } from './types';
import { renderBaseImage, renderTexturedZone, renderOverlay, renderEmbroidery } from './textureRenderer';
import { validateView } from './assetValidator';
import { renderHandleToCanvas } from './handleStripeRenderer';
import type { HandlePathDocument } from './handlePath';
import type { HandlePatternPreset } from './handlePreset';
import { resolveSidePartPathDocument } from './sidePartPathFallback';

interface ComposerAssets {
  get(url: string): HTMLImageElement | undefined;
}

/**
 * Compose a full bag render onto the given canvas context.
 */
export function composeScene(
  ctx: CanvasRenderingContext2D,
  scene: RenderScene,
  assets: ComposerAssets
): void {
  const { view, selection } = scene;
  const { canvasWidth, canvasHeight } = view;

  // Runtime validation (warnings only, doesn't block render)
  if (assets instanceof Map) {
    const validation = validateView(view, assets as Map<string, HTMLImageElement>);
    if (validation.warnings.length > 0) {
      console.warn('[LayerComposer] Asset warnings:', validation.warnings);
    }
    if (validation.errors.length > 0) {
      console.error('[LayerComposer] Asset errors:', validation.errors);
    }
  }

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const layerOrder = [...view.layerOrder].sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of layerOrder) {
    if (!layer.isActive) continue;

    switch (layer.layerType) {
      case 'base':
        renderBase(ctx, view, assets, canvasWidth, canvasHeight);
        break;

      case 'fabric':
        renderZonesByCategory(ctx, view, 'fabric', selection.fabricTextureUrl, selection.fabricPatternScale, assets, canvasWidth, canvasHeight);
        break;

      case 'fabric_overlay':
        renderLocalOverlays(ctx, view, 'fabric', assets, layer, canvasWidth, canvasHeight);
        break;

      case 'handle':
        renderHandleStripes(ctx, view, selection, assets, canvasWidth, canvasHeight);
        break;

      case 'handle_overlay':
        renderLocalOverlays(ctx, view, 'handle', assets, layer, canvasWidth, canvasHeight);
        break;

      case 'embroidery':
        renderEmbroideryLayer(ctx, view, selection, assets, canvasWidth, canvasHeight);
        break;

      case 'overlay_shadows': {
        const passes = Math.max(1, Math.round(selection.shadowsBoost ?? 1));
        for (let p = 0; p < passes; p++) {
          renderTypedOverlay(ctx, view, 'shadows', layer, assets, canvasWidth, canvasHeight);
        }
        break;
      }

      case 'overlay_highlights': {
        const passes = Math.max(1, Math.round(selection.highlightsBoost ?? 1));
        for (let p = 0; p < passes; p++) {
          renderTypedOverlay(ctx, view, 'highlights', layer, assets, canvasWidth, canvasHeight);
        }
        break;
      }

      case 'overlay_details':
        renderTypedOverlay(ctx, view, 'details', layer, assets, canvasWidth, canvasHeight);
        break;

      // Static decorative zones (zipper, hardware overlays, ecc.) — disegnate
      // così come sono dal proprio mask_image_url, senza colorazione.
      case 'overlay_zones':
        renderOverlayZones(ctx, view, layer, assets, canvasWidth, canvasHeight);
        break;

      // Backward compat: single global overlay
      case 'global_overlay':
        renderGlobalOverlay(ctx, view, assets, layer, canvasWidth, canvasHeight);
        break;
    }
  }

  // Fallback: anche se non c'è una layer_order_rule esplicita di tipo
  // 'overlay_zones', le mask_zones di categoria 'overlay' devono essere
  // disegnate sopra a tutto (cerniere, hardware decorativi, ecc.) altrimenti
  // resterebbero invisibili.
  const hasOverlayZonesRule = layerOrder.some((l) => l.layerType === 'overlay_zones');
  if (!hasOverlayZonesRule) {
    renderOverlayZones(
      ctx,
      view,
      { blendMode: 'normal', opacity: 1, zIndex: 999, isActive: true, layerType: 'overlay_zones' } as RenderLayerOrder,
      assets,
      canvasWidth,
      canvasHeight,
    );
  }
}

/**
 * Render mask_zones with zone_category='overlay' as flat decorative PNGs.
 * Il PNG della maschera contiene già l'aspetto finale (es. cerniera grigia
 * con denti) e va semplicemente disegnato a piena risoluzione canvas.
 */
function renderOverlayZones(
  ctx: CanvasRenderingContext2D,
  view: { maskZones: RenderMaskZone[] },
  layer: RenderLayerOrder,
  assets: ComposerAssets,
  w: number, h: number,
): void {
  const zones = view.maskZones
    .filter((z) => z.zoneCategory === 'overlay')
    .sort((a, b) => a.zIndex - b.zIndex);
  for (const zone of zones) {
    if (!zone.maskImageUrl) continue;
    const img = assets.get(zone.maskImageUrl);
    if (!img) continue;

    if (zone.tintColor) {
      // Recolor the mask: keep alpha, replace RGB with tintColor
      const tintCanvas = document.createElement('canvas');
      tintCanvas.width = w;
      tintCanvas.height = h;
      const tctx = tintCanvas.getContext('2d');
      if (!tctx) continue;
      tctx.drawImage(img, 0, 0, w, h);
      tctx.globalCompositeOperation = 'source-in';
      tctx.fillStyle = zone.tintColor;
      tctx.fillRect(0, 0, w, h);
      renderOverlay(ctx, tintCanvas, zone.blendMode || layer.blendMode, layer.opacity, w, h);
    } else {
      renderOverlay(ctx, img, zone.blendMode || layer.blendMode, layer.opacity, w, h);
    }
  }
}

function renderBase(
  ctx: CanvasRenderingContext2D,
  view: { baseImageUrl: string | null },
  assets: ComposerAssets,
  w: number, h: number
): void {
  if (!view.baseImageUrl) return;
  const img = assets.get(view.baseImageUrl);
  if (img) renderBaseImage(ctx, img, w, h);
}

function renderZonesByCategory(
  ctx: CanvasRenderingContext2D,
  view: { maskZones: RenderMaskZone[] },
  category: 'fabric' | 'handle',
  textureUrl: string | null,
  patternScale: number,
  assets: ComposerAssets,
  w: number, h: number
): void {
  const zones = view.maskZones
    .filter(z => z.zoneCategory === category)
    .sort((a, b) => a.zIndex - b.zIndex);

  if (zones.length === 0) return;

  // Resolve the effective texture for each zone (per-zone override or fallback)
  const zonesWithTex = zones
    .map((z) => ({
      zone: z,
      textureImg: assets.get(z.textureUrl ?? textureUrl ?? '') ?? null,
    }))
    .filter((z) => z.textureImg !== null) as Array<{
      zone: RenderMaskZone;
      textureImg: HTMLImageElement;
    }>;

  if (zonesWithTex.length === 0) return;

  // UNDERLAY per texture: union of zone masks sharing the same texture filled
  // with that texture's average color. Avoids gaps showing the white base.
  const byTexture = new Map<HTMLImageElement, RenderMaskZone[]>();
  for (const { zone, textureImg } of zonesWithTex) {
    const arr = byTexture.get(textureImg) ?? [];
    arr.push(zone);
    byTexture.set(textureImg, arr);
  }

  for (const [textureImg, group] of byTexture) {
    const avgColor = getAverageColor(textureImg);
    const unionCanvas = document.createElement('canvas');
    unionCanvas.width = w;
    unionCanvas.height = h;
    const unionCtx = unionCanvas.getContext('2d');
    if (!unionCtx) continue;
    for (const zone of group) {
      if (!zone.maskImageUrl) continue;
      const maskImg = assets.get(zone.maskImageUrl);
      if (maskImg) unionCtx.drawImage(maskImg, 0, 0, w, h);
    }
    unionCtx.globalCompositeOperation = 'source-in';
    unionCtx.fillStyle = avgColor;
    unionCtx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = category === 'fabric' ? 'multiply' : 'source-over';
    ctx.drawImage(unionCanvas, 0, 0);
    ctx.restore();
  }

  for (const { zone, textureImg } of zonesWithTex) {
    if (!zone.maskImageUrl) continue;
    const maskImg = assets.get(zone.maskImageUrl);
    if (!maskImg) continue;

    renderTexturedZone(
      ctx,
      maskImg,
      textureImg,
      zone.transform,
      patternScale,
      zone.blendMode,
      w,
      h,
      undefined,
      undefined,
      zone.shadingStrength,
    );
  }
}

/** Compute average RGB of an image by downscaling to 1×1 px. Cached per image. */
const _avgColorCache = new WeakMap<HTMLImageElement, string>();
function getAverageColor(img: HTMLImageElement): string {
  const cached = _avgColorCache.get(img);
  if (cached) return cached;
  try {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    const cx = c.getContext('2d');
    if (!cx) return 'rgb(128,128,128)';
    cx.drawImage(img, 0, 0, 1, 1);
    const [r, g, b] = cx.getImageData(0, 0, 1, 1).data;
    const rgb = `rgb(${r},${g},${b})`;
    _avgColorCache.set(img, rgb);
    return rgb;
  } catch {
    return 'rgb(128,128,128)';
  }
}

function renderLocalOverlays(
  ctx: CanvasRenderingContext2D,
  view: { maskZones: RenderMaskZone[] },
  category: 'fabric' | 'handle',
  assets: ComposerAssets,
  layer: RenderLayerOrder,
  w: number, h: number
): void {
  const zones = view.maskZones.filter(z => z.zoneCategory === category);
  for (const zone of zones) {
    if (!zone.localOverlayUrl) continue;
    const img = assets.get(zone.localOverlayUrl);
    if (img) renderOverlay(ctx, img, layer.blendMode, layer.opacity, w, h);
  }
}

/**
 * Render a typed overlay (shadows, highlights, details) from the view's overlays array.
 */
function renderTypedOverlay(
  ctx: CanvasRenderingContext2D,
  view: { overlays: ViewOverlay[] },
  type: 'shadows' | 'highlights' | 'details',
  layer: RenderLayerOrder,
  assets: ComposerAssets,
  w: number, h: number
): void {
  const overlay = view.overlays.find(o => o.type === type);
  if (!overlay) return;
  const img = assets.get(overlay.url);
  if (!img) return;

  // Use the overlay's own blend mode (from asset spec), fallback to layer rule
  renderOverlay(ctx, img, overlay.blendMode || layer.blendMode, overlay.opacity ?? layer.opacity, w, h);
}

function renderEmbroideryLayer(
  ctx: CanvasRenderingContext2D,
  view: { embroideryPlacement: { positionX: number; positionY: number; maxWidth: number; maxHeight: number; scale: number; rotation: number } | null },
  selection: { embroideryImageUrl: string | null },
  assets: ComposerAssets,
  w: number, h: number
): void {
  if (!selection.embroideryImageUrl || !view.embroideryPlacement) return;
  const img = assets.get(selection.embroideryImageUrl);
  if (!img) return;
  const p = view.embroideryPlacement;
  renderEmbroidery(ctx, img, p.positionX, p.positionY, p.maxWidth, p.maxHeight, p.scale, p.rotation, w, h);
}

/** Backward compat: single global overlay from overlayUrl */
function renderGlobalOverlay(
  ctx: CanvasRenderingContext2D,
  view: { overlayUrl: string | null },
  assets: ComposerAssets,
  layer: RenderLayerOrder,
  w: number, h: number
): void {
  if (!view.overlayUrl) return;
  const img = assets.get(view.overlayUrl);
  if (img) renderOverlay(ctx, img, layer.blendMode, layer.opacity, w, h);
}

/**
 * Render del manico procedurale (nuovo sistema).
 *
 * Usa la geometria fissa della vista (path + mask + overlay PNG) e il preset
 * selezionato dal cliente per generare strisce LONGITUDINALI continue lungo
 * tutta la centerline. Vedi `handleStripeRenderer.ts` per i dettagli.
 *
 * Se la vista non ha geometria configurata o non c'è preset selezionato, il
 * layer viene saltato silenziosamente (no-op): il vecchio sistema basato su
 * mask_zones di categoria 'handle' è dismesso e non viene più usato.
 */
function renderHandleStripes(
  ctx: CanvasRenderingContext2D,
  view: RenderScene['view'],
  selection: RenderScene['selection'],
  assets: ComposerAssets,
  w: number, h: number
): void {
  const geom = view.handleGeometry;
  const preset = selection.handlePreset as HandlePatternPreset | null;
  const textureImg = selection.handleTextureUrl
    ? assets.get(selection.handleTextureUrl) ?? null
    : null;

  // Serve almeno uno tra preset (pattern) o texture
  if (!geom || (!preset && !textureImg)) return;

  // Quando si usa una texture, il renderer richiede comunque un preset
  // (lo legge solo per grain). Passiamo un preset minimo neutro.
  const effectivePreset: HandlePatternPreset =
    preset ?? ({ name: 'texture', stripeCount: 1, stripes: [], spacing: [], edgeMarginLeft: 0, edgeMarginRight: 0, grainEnabled: false, grainOpacity: 0 } as unknown as HandlePatternPreset);
  const texturePattern = textureImg ? { texture: textureImg, scaleV: 1 } : undefined;

  // 1. Manico principale (se ha mask + path validi)
  if (geom.maskUrl) {
    const doc = geom.pathDocument as HandlePathDocument | null;
    const mask = assets.get(geom.maskUrl);
    if (doc && doc.paths && doc.paths.length > 0 && mask && doc.canvasWidth > 0 && doc.canvasHeight > 0) {
      try {
        const handleCanvas = renderHandleToCanvas({
          doc,
          preset: effectivePreset,
          texturePattern,
          assets: {
            mask,
            shadow: geom.shadowUrl ? assets.get(geom.shadowUrl) ?? null : null,
            highlight: geom.highlightUrl ? assets.get(geom.highlightUrl) ?? null : null,
            details: geom.detailsUrl ? assets.get(geom.detailsUrl) ?? null : null,
            hardware: geom.hardwareUrl ? assets.get(geom.hardwareUrl) ?? null : null,
          },
        });
        if (handleCanvas.width > 0 && handleCanvas.height > 0) {
          ctx.drawImage(handleCanvas, 0, 0, w, h);
        }
      } catch (e) {
        console.warn('[layerComposer] renderHandleToCanvas failed', e);
      }
    }
  }

  // 2. Side parts (fettuccine laterali) — stesso preset / stessa texture
  for (const sp of geom.sideParts ?? []) {
    if (!sp.maskUrl) continue;
    const mask = assets.get(sp.maskUrl);
    if (!mask) continue;

    const sourceDoc = sp.pathDocument as HandlePathDocument | null;
    const doc = resolveSidePartPathDocument(sourceDoc, mask, w, h, sp.rotation);
    if (!doc) continue;

    if (doc.canvasWidth <= 0 || doc.canvasHeight <= 0) continue;
    try {
      const sideCanvas = renderHandleToCanvas({
        doc,
        preset: effectivePreset,
        texturePattern,
        assets: {
          mask,
          shadow: sp.shadowUrl ? assets.get(sp.shadowUrl) ?? null : null,
          highlight: sp.highlightUrl ? assets.get(sp.highlightUrl) ?? null : null,
          details: null,
          hardware: null,
        },
      });
      if (sideCanvas.width > 0 && sideCanvas.height > 0) {
        ctx.drawImage(sideCanvas, 0, 0, w, h);
      }
    } catch (e) {
      console.warn('[layerComposer] side renderHandleToCanvas failed', e);
    }
  }
}

