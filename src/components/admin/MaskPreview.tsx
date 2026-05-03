/**
 * MaskPreview
 *
 * Renderizza l'anteprima della vista per il mask editor.
 *
 * Modalità:
 *  - "overlay": disegna la base image e sopra le mask colorate (una tinta diversa
 *    per ogni zona) con opacità regolabile, per verificare l'allineamento.
 *  - "textured": applica la texture fabric scelta dentro ogni mask di categoria
 *    fabric, lasciando le zone handle come tinta grigia. Sopra disegna la base
 *    image al 30% per vedere gli edge.
 */

import React, { useEffect, useRef } from 'react';

interface ViewLite {
  canvas_width: number;
  canvas_height: number;
  base_image_url: string | null;
}
interface ZoneLite {
  id: string;
  zone_type: string;
  zone_category: string;
  mask_image_url: string | null;
  texture_scale: number;
  texture_offset_x: number;
  texture_offset_y: number;
  texture_rotation: number;
  texture_repeat_mode: string;
}
interface FabricLite {
  texture_url: string | null;
}

interface Props {
  view: ViewLite;
  zones: ZoneLite[];
  maskOpacity: number;
  /** Tessuto di fallback usato per tutte le zone fabric senza override. */
  fabric: FabricLite | null;
  /** Override per-zona: zoneId → fabric. Se presente, prevale su `fabric`. */
  fabricByZone?: Record<string, FabricLite | null>;
  mode: 'overlay' | 'textured';
}

// Distinct hues per zone (HSL — semantic-friendly, not theme-tied)
const ZONE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
];

export const MaskPreview: React.FC<Props> = ({ view, zones, maskOpacity, fabric, fabricByZone, mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = view.canvas_width;
    canvas.height = view.canvas_height;

    let cancelled = false;

    (async () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Base image
      if (view.base_image_url) {
        const baseImg = await loadImage(view.base_image_url);
        if (cancelled) return;
        if (baseImg) {
          ctx.globalAlpha = mode === 'textured' ? 0.3 : 1;
          ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;
        }
      } else {
        drawCheckerboard(ctx, canvas.width, canvas.height);
      }

      // 2. Pre-carica le texture di tutte le zone (fallback + override)
      const fallbackTexUrl = fabric?.texture_url ?? null;
      const urlsToLoad = new Set<string>();
      if (mode === 'textured') {
        if (fallbackTexUrl) urlsToLoad.add(fallbackTexUrl);
        if (fabricByZone) {
          for (const f of Object.values(fabricByZone)) {
            if (f?.texture_url) urlsToLoad.add(f.texture_url);
          }
        }
      }
      const texCache = new Map<string, HTMLImageElement | null>();
      await Promise.all(
        [...urlsToLoad].map(async u => {
          texCache.set(u, await loadImage(u));
        })
      );
      if (cancelled) return;

      // 3. Zones
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        if (!z.mask_image_url) continue;
        const maskImg = await loadImage(z.mask_image_url);
        if (cancelled) return;
        if (!maskImg) continue;

        // Texture per questa zona: override per-zona oppure fallback globale
        let texForZone: HTMLImageElement | null = null;
        if (mode === 'textured' && z.zone_category === 'fabric') {
          const override = fabricByZone?.[z.id];
          const url = override?.texture_url ?? fallbackTexUrl;
          if (url) texForZone = texCache.get(url) ?? null;
        }
        const tint = texForZone ? null : ZONE_COLORS[i % ZONE_COLORS.length];

        drawMaskedZone(ctx, maskImg, texForZone, z, tint, maskOpacity, canvas.width, canvas.height);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [view, zones, maskOpacity, fabric, fabricByZone, mode]);

  return (
    <div className="w-full bg-muted/20 border border-border rounded-md overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-auto block"
        style={{ aspectRatio: `${view.canvas_width} / ${view.canvas_height}` }}
      />
    </div>
  );
};

/* ===== helpers ===== */

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(url: string): Promise<HTMLImageElement | null> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

function drawMaskedZone(
  ctx: CanvasRenderingContext2D,
  maskImg: HTMLImageElement,
  textureImg: HTMLImageElement | null,
  z: ZoneLite,
  tint: string | null,
  opacity: number,
  w: number,
  h: number
) {
  // Render to an offscreen canvas: fill (texture or tint) clipped by the mask alpha.
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  if (!octx) return;

  if (textureImg) {
    // Tile the texture honoring scale/offset/rotation
    const scale = (z.texture_scale || 1) * 0.5; // similar to runtime, matches engine feel
    const tw = textureImg.width * scale;
    const th = textureImg.height * scale;
    octx.save();
    octx.translate(w / 2 + (z.texture_offset_x || 0), h / 2 + (z.texture_offset_y || 0));
    octx.rotate(((z.texture_rotation || 0) * Math.PI) / 180);
    octx.translate(-w / 2, -h / 2);
    // simple tiling
    const repeat = z.texture_repeat_mode !== 'clamp';
    if (repeat) {
      for (let y = -th; y < h + th; y += th) {
        for (let x = -tw; x < w + tw; x += tw) {
          octx.drawImage(textureImg, x, y, tw, th);
        }
      }
    } else {
      octx.drawImage(textureImg, 0, 0, w, h);
    }
    octx.restore();
  } else if (tint) {
    octx.fillStyle = tint;
    octx.fillRect(0, 0, w, h);
  }

  // Clip by mask alpha — apply a small feather to soften edges (matches engine)
  octx.globalCompositeOperation = 'destination-in';
  octx.filter = 'blur(2px)';
  octx.drawImage(maskImg, 0, 0, w, h);
  octx.filter = 'none';

  // Compose onto main
  ctx.globalAlpha = opacity;
  ctx.drawImage(off, 0, 0);
  ctx.globalAlpha = 1;
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const size = 40;
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = ((x / size + y / size) | 0) % 2 ? '#e5e7eb' : '#f3f4f6';
      ctx.fillRect(x, y, size, size);
    }
  }
}
