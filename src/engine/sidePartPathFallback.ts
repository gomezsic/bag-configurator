import type { HandlePathDocument } from './handlePath';

interface MaskBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  sampleWidth: number;
  sampleHeight: number;
}

function getMaskBounds(mask: HTMLImageElement, sample = 128): MaskBounds | null {
  const ratio = Math.min(sample / mask.naturalWidth, sample / mask.naturalHeight);
  const sw = Math.max(8, Math.round(mask.naturalWidth * ratio));
  const sh = Math.max(8, Math.round(mask.naturalHeight * ratio));
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const cx = c.getContext('2d');
  if (!cx) return null;

  cx.drawImage(mask, 0, 0, sw, sh);
  const data = cx.getImageData(0, 0, sw, sh).data;
  let minX = sw;
  let minY = sh;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const a = data[(y * sw + x) * 4 + 3];
      if (a > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, sampleWidth: sw, sampleHeight: sh };
}

function buildFallbackPathFromMask(
  mask: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  rotationDeg: number,
): HandlePathDocument | null {
  const bounds = getMaskBounds(mask, 128);
  if (!bounds) return null;

  const sx = canvasW / bounds.sampleWidth;
  const sy = canvasH / bounds.sampleHeight;
  const x0 = bounds.minX * sx;
  const x1 = bounds.maxX * sx;
  const y0 = bounds.minY * sy;
  const y1 = bounds.maxY * sy;
  const cxC = (x0 + x1) / 2;
  const cyC = (y0 + y1) / 2;
  const bw = x1 - x0;
  const bh = y1 - y0;
  const horizontal = bw >= bh;
  const baseLen = Math.max(bw, bh);
  const baseW = Math.min(bw, bh);
  const rad = (rotationDeg * Math.PI) / 180;
  const baseDx = horizontal ? Math.cos(rad) : -Math.sin(rad);
  const baseDy = horizontal ? Math.sin(rad) : Math.cos(rad);
  const half = baseLen / 2;

  return {
    name: 'side_fallback',
    canvasWidth: canvasW,
    canvasHeight: canvasH,
    paths: [
      {
        id: 'side',
        closed: false,
        points: [
          { x: cxC - baseDx * half, y: cyC - baseDy * half, width: baseW },
          { x: cxC, y: cyC, width: baseW },
          { x: cxC + baseDx * half, y: cyC + baseDy * half, width: baseW },
        ],
      },
    ],
  };
}

function pathOverlapsMask(doc: HandlePathDocument | null, mask: HTMLImageElement): boolean {
  if (!doc || !doc.paths?.length) return false;
  const pts = doc.paths[0]?.points ?? [];
  if (pts.length < 1) return false;

  const bounds = getMaskBounds(mask, 64);
  if (!bounds) return false;

  const sx = doc.canvasWidth / bounds.sampleWidth;
  const sy = doc.canvasHeight / bounds.sampleHeight;
  const x0 = bounds.minX * sx;
  const x1 = bounds.maxX * sx;
  const y0 = bounds.minY * sy;
  const y1 = bounds.maxY * sy;

  return pts.some((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1);
}

export function resolveSidePartPathDocument(
  doc: HandlePathDocument | null,
  mask: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  rotationDeg: number,
): HandlePathDocument | null {
  const hasValidPath = !!doc?.paths?.length && (doc.paths[0]?.points?.length ?? 0) >= 2;
  if (hasValidPath && pathOverlapsMask(doc, mask)) return doc;
  return buildFallbackPathFromMask(mask, canvasW, canvasH, rotationDeg);
}
