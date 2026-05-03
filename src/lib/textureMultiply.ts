/**
 * textureMultiply
 *
 * Applica un colore in blend `multiply` su una texture grayscale (matrice B/N).
 * È la versione canvas della formula:
 *
 *   out_rgb = (gray / 255) * tint_rgb
 *
 * Usato per generare al volo le N varianti colore di un tessuto a partire
 * da una sola "matrice" B/N caricata in `fabrics.texture_url`.
 *
 * Tutto deterministico, zero costi AI, zero storage extra.
 */

import { loadImage, generateSeamless } from './textureSeamless';

export interface MultiplyOptions {
  /**
   * Se true, normalizza la luminanza media della texture prima del multiply.
   * Default: true.
   */
  normalizeLuminance?: boolean;
  /** Lato target del canvas in output (default: dimensione nativa). */
  size?: number;
  /**
   * Target di luminanza media (0..1) per la normalizzazione. Più basso = ombre
   * più scure / colori più "carichi". Default 0.55 (prima era 0.65).
   */
  targetLuminance?: number;
  /**
   * Boost di contrasto applicato al canale grigio prima del multiply (1 = off).
   * Valori 1.1–1.3 enfatizzano le ombre senza schiacciare le luci. Default 1.2.
   */
  contrast?: number;
  /**
   * Se true (default), prima del multiply rende la texture seamless con
   * offset+mirror blend (Photoshop-style). Elimina i tagli visibili quando
   * la matrice viene tilata sulla borsa. Disabilitabile per debug.
   */
  seamless?: boolean;
  /**
   * Forza dell'edge blend seamless (0..0.5). Default 0.18 — più alto del
   * default seamless standalone perché qui la texture viene tilata molto.
   */
  seamlessEdgeBlend?: number;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Hex "#rrggbb" → [r,g,b] 0..255. Tollera "#rgb" e maiuscole. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (isNaN(n)) return [255, 255, 255];
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * Applica multiply tint a una texture grayscale già caricata su canvas.
 * Modifica direttamente il canvas passato.
 */
export function multiplyCanvas(
  canvas: HTMLCanvasElement,
  hex: string,
  opts: MultiplyOptions = {}
): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const D = img.data;
  const [R, G, B] = hexToRgb(hex);

  // Calcola luminanza media se serve normalizzare
  let scale = 1;
  if (opts.normalizeLuminance ?? true) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < D.length; i += 16) {
      // sample 1 ogni 4 pixel per velocità
      const Y = 0.2126 * D[i] + 0.7152 * D[i + 1] + 0.0722 * D[i + 2];
      sum += Y;
      n++;
    }
    const meanY = sum / n / 255;
    if (meanY > 0.05) {
      const target = opts.targetLuminance ?? 0.55;
      // moltiplico tutto per (target/meanY) clamp [0.55..1.5] per dare più
      // forza alle ombre senza estremi.
      scale = Math.min(1.5, Math.max(0.55, target / meanY));
    }
  }

  const sR = R / 255;
  const sG = G / 255;
  const sB = B / 255;
  // Boost di contrasto sul grigio: y' = 0.5 + (y - 0.5) * k, in [0..1] poi *255
  const k = opts.contrast ?? 1.2;
  for (let i = 0; i < D.length; i += 4) {
    let y0 = D[i] * scale / 255;
    let y1 = D[i + 1] * scale / 255;
    let y2 = D[i + 2] * scale / 255;
    if (k !== 1) {
      y0 = Math.min(1, Math.max(0, 0.5 + (y0 - 0.5) * k));
      y1 = Math.min(1, Math.max(0, 0.5 + (y1 - 0.5) * k));
      y2 = Math.min(1, Math.max(0, 0.5 + (y2 - 0.5) * k));
    }
    D[i]     = Math.min(255, y0 * 255 * sR);
    D[i + 1] = Math.min(255, y1 * 255 * sG);
    D[i + 2] = Math.min(255, y2 * 255 * sB);
    // alpha invariato
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Genera (o recupera dalla cache) un canvas con la texture grayscale moltiplicata
 * per la tinta richiesta. La cache è in-memory per `${url}|${hex}|${size}`.
 */
export async function getMultipliedTexture(
  grayscaleUrl: string,
  hex: string,
  opts: MultiplyOptions = {}
): Promise<HTMLCanvasElement> {
  const useSeamless = opts.seamless ?? true;
  const key = `${grayscaleUrl}|${hex.toLowerCase()}|${opts.size ?? 'native'}|s${useSeamless ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let c: HTMLCanvasElement;
  if (useSeamless) {
    // Period-aware seamless: trova il periodo del pattern e ripete il modulo
    // unitario → tiling continuo per costruzione, materia preservata.
    const tileSize = opts.size ?? 1024;
    c = await generateSeamless(grayscaleUrl, {
      tileSize,
      autoCropUniform: true,
    });
  } else {
    const img = await loadImage(grayscaleUrl);
    const w = opts.size ?? img.naturalWidth;
    const h = opts.size ?? img.naturalHeight;
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
  }
  multiplyCanvas(c, hex, opts);

  // Cache sobria: 32 entry max
  if (cache.size > 32) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, c);
  return c;
}

/** Ritorna direttamente un dataURL PNG (utile per <img src=...>). */
export async function getMultipliedTextureDataURL(
  grayscaleUrl: string,
  hex: string,
  opts: MultiplyOptions = {}
): Promise<string> {
  const c = await getMultipliedTexture(grayscaleUrl, hex, opts);
  return c.toDataURL('image/png');
}
