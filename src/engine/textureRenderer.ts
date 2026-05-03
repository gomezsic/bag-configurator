/**
 * Texture Renderer
 * 
 * Core rendering functions for applying textures to mask zones.
 * Handles pattern tiling, scaling, rotation, offset and repeat modes.
 * 
 * The key principle: textures are NOT stretched to fit masks.
 * Instead, they are tiled/repeated at a controlled scale, then
 * clipped by the mask shape.
 */

import type { TextureTransform, RepeatMode, BlendMode } from './types';

/**
 * Default feather radius (in pixels) applied to mask edges to avoid hard
 * aliasing seams between fabric zones and the background. Can be overridden
 * via the optional `featherRadius` argument.
 */
export const DEFAULT_FEATHER_PX = 2;

/**
 * Default mask dilation (in pixels) — expands every mask outward by N px so
 * adjacent zones overlap and there are no transparent gaps between them
 * showing the base image underneath.
 */
export const DEFAULT_DILATE_PX = 3;

/**
 * Apply a texture to a mask zone on the canvas.
 *
 * Pipeline:
 * 1. Create offscreen canvas and draw the FULL tiled texture
 * 2. Create mask canvas with the mask shape (dilated outward + feathered)
 * 3. Use 'source-in' to clip the texture by the mask in ONE operation
 * 4. Draw the result onto the main canvas with the specified blend mode
 */
export function renderTexturedZone(
  ctx: CanvasRenderingContext2D,
  maskImage: HTMLImageElement,
  textureImage: HTMLImageElement,
  transform: TextureTransform,
  materialPatternScale: number,
  blendMode: BlendMode,
  canvasWidth: number,
  canvasHeight: number,
  featherRadius: number = DEFAULT_FEATHER_PX,
  dilateRadius: number = DEFAULT_DILATE_PX,
  shadingStrength: number = 1
): void {
  const effectiveScale = materialPatternScale * transform.scaleCorrectionFactor * transform.scale;

  // Step 1: Draw the full tiled texture onto a temp canvas
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = canvasWidth;
  textureCanvas.height = canvasHeight;
  const texCtx = textureCanvas.getContext('2d');
  if (!texCtx) return;

  texCtx.save();
  if (transform.rotation !== 0) {
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    texCtx.translate(cx, cy);
    texCtx.rotate((transform.rotation * Math.PI) / 180);
    texCtx.translate(-cx, -cy);
  }

  drawTiledTexture(
    texCtx,
    textureImage,
    effectiveScale,
    transform.offsetX,
    transform.offsetY,
    transform.repeatMode,
    canvasWidth,
    canvasHeight
  );
  texCtx.restore();

  // Step 2: Create mask canvas — apply a small blur to soften the edge
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvasWidth;
  maskCanvas.height = canvasHeight;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) return;

  // Step 2a: DILATE — expand the mask outward by drawing it multiple times
  // with small offsets in 8 directions. This makes adjacent zones overlap so
  // no transparent gaps remain between them.
  if (dilateRadius > 0) {
    const r = dilateRadius;
    const offsets: Array<[number, number]> = [
      [-r, 0], [r, 0], [0, -r], [0, r],
      [-r, -r], [r, -r], [-r, r], [r, r],
      [-r * 0.5, 0], [r * 0.5, 0], [0, -r * 0.5], [0, r * 0.5],
    ];
    for (const [dx, dy] of offsets) {
      maskCtx.drawImage(maskImage, dx, dy, canvasWidth, canvasHeight);
    }
  }

  // Step 2b: Draw the mask once more on top, with optional feather blur to
  // soften the final edge against the background.
  if (featherRadius > 0) {
    maskCtx.filter = `blur(${featherRadius}px)`;
  }
  maskCtx.drawImage(maskImage, 0, 0, canvasWidth, canvasHeight);
  maskCtx.filter = 'none';

  // Step 3: Clip texture by mask — ONE composite operation
  // Draw the full texture onto the mask canvas using source-in
  // This keeps texture pixels only where mask had alpha
  maskCtx.globalCompositeOperation = 'source-in';
  maskCtx.drawImage(textureCanvas, 0, 0);

  // Step 4: Draw the composited result onto main canvas.
  //
  // For 'multiply' blend, the base image's shading shows through. But because
  // the base photo's "lit" areas are a light gray (not pure white), multiply
  // would darken even the highlights. To compensate, we first paint a soft
  // white veil over the destination area (lifting the base toward white),
  // then apply the multiply. The amount of "lift" is driven by shadingStrength
  // INVERSELY: shadingStrength = 1 → no lift (full shadows), 0 → full lift (flat).
  ctx.save();
  const lift = 1 - Math.max(0, Math.min(1, shadingStrength));
  if (lift > 0) {
    // Lift base toward white inside the masked area only
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = lift;
    // Use the dilated+feathered mask shape as a "white veil"
    const veil = document.createElement('canvas');
    veil.width = canvasWidth;
    veil.height = canvasHeight;
    const vctx = veil.getContext('2d');
    if (vctx) {
      vctx.drawImage(maskCanvas, 0, 0); // copies texture pixels (we want shape)
      vctx.globalCompositeOperation = 'source-in';
      vctx.fillStyle = '#ffffff';
      vctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(veil, 0, 0);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = blendModeToComposite(blendMode);
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.restore();
}

/**
 * Draw a tiled texture pattern across the canvas.
 * Respects scale, offset, and repeat mode.
 */
function drawTiledTexture(
  ctx: CanvasRenderingContext2D,
  texture: HTMLImageElement,
  scale: number,
  offsetX: number,
  offsetY: number,
  repeatMode: RepeatMode,
  canvasWidth: number,
  canvasHeight: number
): void {
  const tileW = texture.width * scale;
  const tileH = texture.height * scale;

  if (tileW <= 0 || tileH <= 0) return;

  // For 'clamp' mode, draw single stretched texture
  if (repeatMode === 'clamp') {
    ctx.drawImage(texture, offsetX, offsetY, canvasWidth, canvasHeight);
    return;
  }

  // Calculate tile grid covering the canvas
  const startX = offsetX % tileW - tileW;
  const startY = offsetY % tileH - tileH;
  const endX = canvasWidth + tileW;
  const endY = canvasHeight + tileH;

  for (let y = startY; y < endY; y += tileH) {
    for (let x = startX; x < endX; x += tileW) {
      if (repeatMode === 'mirror') {
        const col = Math.floor((x - startX) / tileW);
        const row = Math.floor((y - startY) / tileH);
        
        ctx.save();
        ctx.translate(x + tileW / 2, y + tileH / 2);
        if (col % 2 === 1) ctx.scale(-1, 1);
        if (row % 2 === 1) ctx.scale(1, -1);
        ctx.drawImage(texture, -tileW / 2, -tileH / 2, tileW, tileH);
        ctx.restore();
      } else {
        ctx.drawImage(texture, x, y, tileW, tileH);
      }
    }
  }
}

/**
 * Render an overlay image onto the canvas with blend mode.
 */
export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  overlayImage: HTMLImageElement | HTMLCanvasElement,
  blendMode: BlendMode,
  opacity: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.save();
  ctx.globalCompositeOperation = blendModeToComposite(blendMode);
  ctx.globalAlpha = opacity;
  ctx.drawImage(overlayImage, 0, 0, canvasWidth, canvasHeight);
  ctx.restore();
}

/**
 * Render an embroidery image at specified placement.
 */
export function renderEmbroidery(
  ctx: CanvasRenderingContext2D,
  embroideryImage: HTMLImageElement,
  positionX: number,
  positionY: number,
  maxWidth: number,
  maxHeight: number,
  scale: number,
  rotation: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  const x = (positionX / 100) * canvasWidth;
  const y = (positionY / 100) * canvasHeight;

  const aspectRatio = embroideryImage.width / embroideryImage.height;
  let drawWidth = maxWidth * scale;
  let drawHeight = drawWidth / aspectRatio;
  
  if (drawHeight > maxHeight * scale) {
    drawHeight = maxHeight * scale;
    drawWidth = drawHeight * aspectRatio;
  }

  ctx.save();
  ctx.translate(x, y);
  
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }

  ctx.drawImage(embroideryImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

/**
 * Render base image (silhouette/product photo) onto canvas.
 */
export function renderBaseImage(
  ctx: CanvasRenderingContext2D,
  baseImage: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.drawImage(baseImage, 0, 0, canvasWidth, canvasHeight);
}

/**
 * Map our blend mode names to Canvas globalCompositeOperation values.
 */
function blendModeToComposite(blendMode: BlendMode): GlobalCompositeOperation {
  switch (blendMode) {
    case 'multiply': return 'multiply';
    case 'screen': return 'screen';
    case 'overlay': return 'overlay';
    case 'soft-light': return 'soft-light' as GlobalCompositeOperation;
    case 'hard-light': return 'hard-light' as GlobalCompositeOperation;
    case 'normal':
    default:
      return 'source-over';
  }
}
