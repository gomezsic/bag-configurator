/**
 * textureSeamless — pipeline per trasformare una foto reale di tessuto in una
 * texture ripetibile senza distruggere la materia originale.
 *
 * Best practice adottata:
 * - Non si genera un pattern sintetico.
 * - Non si ripete un micro-modulo trovato dall'AI/autocorrelazione.
 * - Non si forza la continuità con mirror/blend aggressivi.
 * - Si cerca invece un CROP REALE i cui bordi siano già in fase: lato sinistro
 *   simile al destro, lato alto simile al basso. Questo è il punto chiave per
 *   tagliare correttamente il modulo da ripetere.
 *
 * In pratica: scegliamo il taglio che minimizza l'errore di cucitura quando il
 * tile viene ripetuto. L'autocorrelazione serve solo come indizio per preferire
 * dimensioni vicine a multipli del periodo del tessuto, non per creare pallini,
 * colonne o pattern sintetici.
 */

export interface SeamlessOptions {
  /** Lato target del tile in output. Default 1024. */
  tileSize?: number;
  /** Auto-crop sulla regione più uniforme della foto. Default true. */
  autoCropUniform?: boolean;
  /** Periodo minimo cercato nella ROI di analisi. Default 12. */
  minPeriod?: number;
  /** Periodo massimo cercato nella ROI di analisi. Default 180. */
  maxPeriod?: number;
  /** Soglia informativa per usare il periodo come bias, non come vincolo. */
  periodConfidence?: number;
  /** Legacy: ignorato intenzionalmente; lasciato per compatibilità. */
  lightingFlatten?: number;
  /** Legacy: ignorato intenzionalmente; lasciato per compatibilità. */
  edgeBlend?: number;
  /** Legacy fallback: non usato nella nuova pipeline. */
  fallbackEdgeBlend?: number;
}

export const DEFAULT_OPTIONS: Required<SeamlessOptions> = {
  tileSize: 1024,
  autoCropUniform: true,
  minPeriod: 12,
  maxPeriod: 180,
  periodConfidence: 0.28,
  lightingFlatten: 0,
  edgeBlend: 0,
  fallbackEdgeBlend: 0,
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function loadImage(src: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    if (typeof src === 'string') {
      img.src = src;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(src);
    }
  });
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function luminanceArray(data: Uint8ClampedArray): Float32Array {
  const Y = new Float32Array(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    Y[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return Y;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/* -------------------------------------------------------------------------- */
/* Step 1 — zona uniforme                                                      */
/* -------------------------------------------------------------------------- */

function findUniformSquare(
  img: HTMLImageElement,
  side: number,
): { x: number; y: number; side: number } {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const s = Math.min(side, W, H);
  const STAT = 256;
  const c = makeCanvas(STAT, STAT);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, STAT, STAT);
  const Y = luminanceArray(ctx.getImageData(0, 0, STAT, STAT).data);

  const sStat = Math.max(32, Math.round((s / Math.min(W, H)) * STAT));
  const step = Math.max(8, Math.floor((STAT - sStat) / 8));
  let best = { x: 0, y: 0, score: Infinity };

  for (let y = 0; y + sStat <= STAT; y += step) {
    for (let x = 0; x + sStat <= STAT; x += step) {
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let yy = y; yy < y + sStat; yy += 4) {
        for (let xx = x; xx < x + sStat; xx += 4) {
          const v = Y[yy * STAT + xx];
          sum += v;
          sumSq += v * v;
          n++;
        }
      }
      const mean = sum / n;
      const variance = sumSq / n - mean * mean;
      if (variance < best.score) best = { x, y, score: variance };
    }
  }

  return {
    x: Math.round((best.x / STAT) * W),
    y: Math.round((best.y / STAT) * H),
    side: s,
  };
}

/* -------------------------------------------------------------------------- */
/* Step 2 — periodo come indizio, non come generatore                          */
/* -------------------------------------------------------------------------- */

interface PeriodEstimate {
  px: number;
  py: number;
  confidence: number;
}

function estimateAxisPeriod(
  Z: Float32Array,
  N: number,
  axis: 'x' | 'y',
  minP: number,
  maxP: number,
): { period: number; confidence: number } {
  const limit = Math.min(maxP, Math.floor(N * 0.45));
  const corr: number[] = [];
  let bestD = minP;
  let best = -Infinity;

  for (let d = minP; d <= limit; d++) {
    let acc = 0;
    let a2 = 0;
    let b2 = 0;
    let n = 0;

    if (axis === 'x') {
      for (let y = 0; y < N; y += 2) {
        const row = y * N;
        for (let x = 0; x + d < N; x += 2) {
          const a = Z[row + x];
          const b = Z[row + x + d];
          acc += a * b;
          a2 += a * a;
          b2 += b * b;
          n++;
        }
      }
    } else {
      for (let y = 0; y + d < N; y += 2) {
        const row = y * N;
        const row2 = (y + d) * N;
        for (let x = 0; x < N; x += 2) {
          const a = Z[row + x];
          const b = Z[row2 + x];
          acc += a * b;
          a2 += a * a;
          b2 += b * b;
          n++;
        }
      }
    }

    const v = n > 0 && a2 > 0 && b2 > 0 ? acc / Math.sqrt(a2 * b2) : 0;
    corr[d] = v;
    if (v > best) {
      best = v;
      bestD = d;
    }
  }

  const vals = corr.slice(minP, limit + 1).filter(Number.isFinite).sort((a, b) => a - b);
  const median = vals[Math.floor(vals.length / 2)] ?? 0;
  const p80 = vals[Math.floor(vals.length * 0.8)] ?? median;
  const confidence = clamp01((best - p80) / Math.max(0.05, 1 - p80));

  return { period: bestD, confidence };
}

function estimatePatternPeriod(Y: Float32Array, N: number, minP: number, maxP: number): PeriodEstimate {
  let mean = 0;
  for (let i = 0; i < Y.length; i++) mean += Y[i];
  mean /= Y.length;

  const Z = new Float32Array(Y.length);
  for (let i = 0; i < Y.length; i++) Z[i] = Y[i] - mean;

  const x = estimateAxisPeriod(Z, N, 'x', minP, maxP);
  const y = estimateAxisPeriod(Z, N, 'y', minP, maxP);
  return {
    px: x.period,
    py: y.period,
    confidence: Math.min(x.confidence, y.confidence),
  };
}

/* -------------------------------------------------------------------------- */
/* Step 3 — scegliere il taglio migliore                                       */
/* -------------------------------------------------------------------------- */

interface CropCandidate {
  x: number;
  y: number;
  side: number;
  seamScore: number;
  periodScore: number;
  totalScore: number;
}

function seamScore(Y: Float32Array, N: number, x: number, y: number, side: number): number {
  const band = Math.max(3, Math.round(side * 0.012));
  const stride = Math.max(1, Math.round(side / 180));
  let err = 0;
  let n = 0;

  // Left/right seam: confronta piccole bande, non una sola colonna.
  for (let yy = 0; yy < side; yy += stride) {
    for (let b = 0; b < band; b++) {
      const l = Y[(y + yy) * N + x + b];
      const r = Y[(y + yy) * N + x + side - band + b];
      const d = l - r;
      err += d * d;
      n++;
    }
  }

  // Top/bottom seam.
  for (let xx = 0; xx < side; xx += stride) {
    for (let b = 0; b < band; b++) {
      const t = Y[(y + b) * N + x + xx];
      const bt = Y[(y + side - band + b) * N + x + xx];
      const d = t - bt;
      err += d * d;
      n++;
    }
  }

  return n ? err / n : Infinity;
}

function periodAlignmentPenalty(side: number, period: PeriodEstimate, threshold: number): number {
  if (period.confidence < threshold || period.px <= 0 || period.py <= 0) return 0;

  const fracDistance = (v: number) => {
    const f = Math.abs(v - Math.round(v));
    return Math.min(f, 1 - f);
  };

  // Penalità leggera: aiuta a scegliere un lato multiplo del periodo, ma non
  // prevale mai sul vero criterio, cioè la continuità dei bordi.
  return (fracDistance(side / period.px) + fracDistance(side / period.py)) * 0.15;
}

function chooseBestSeamCrop(
  Y: Float32Array,
  N: number,
  period: PeriodEstimate,
  periodConfidence: number,
): CropCandidate {
  const minSide = Math.max(180, Math.floor(N * 0.45));
  const maxSide = Math.max(minSide, N - 4);
  const sideStep = Math.max(4, Math.round(N / 128));
  const posSteps = 8;

  let best: CropCandidate = {
    x: 0,
    y: 0,
    side: maxSide,
    seamScore: Infinity,
    periodScore: 0,
    totalScore: Infinity,
  };

  for (let side = maxSide; side >= minSide; side -= sideStep) {
    const free = N - side;
    const positions: number[] = free <= 0
      ? [0]
      : Array.from({ length: posSteps + 1 }, (_, i) => Math.round((free * i) / posSteps));

    const pScore = periodAlignmentPenalty(side, period, periodConfidence);
    // Preferiamo crop grandi: meno ripetizione visibile sul prodotto.
    const sizePenalty = (maxSide - side) / Math.max(1, maxSide - minSide) * 0.08;

    for (const y of positions) {
      for (const x of positions) {
        const sScore = seamScore(Y, N, x, y, side);
        const total = sScore / (255 * 255) + pScore + sizePenalty;
        if (total < best.totalScore) {
          best = { x, y, side, seamScore: sScore, periodScore: pScore, totalScore: total };
        }
      }
    }
  }

  return best;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export interface SeamlessResult {
  canvas: HTMLCanvasElement;
  /** Periodo stimato solo per diagnostica. */
  periodX: number;
  periodY: number;
  /** Non sintetizziamo ripetizioni interne: il crop resta fotografia reale. */
  repeatX: number;
  repeatY: number;
  confidence: number;
  /** Sempre false nella nuova pipeline: niente fallback distruttivo. */
  usedFallback: boolean;
  /** Diagnostica del taglio scelto. */
  cropSide?: number;
  seamScore?: number;
}

export async function generateSeamless(
  source: HTMLImageElement | string | File,
  opts: Partial<SeamlessOptions> = {},
): Promise<HTMLCanvasElement> {
  const r = await generateSeamlessDetailed(source, opts);
  return r.canvas;
}

export async function generateSeamlessDetailed(
  source: HTMLImageElement | string | File,
  opts: Partial<SeamlessOptions> = {},
): Promise<SeamlessResult> {
  const o: Required<SeamlessOptions> = { ...DEFAULT_OPTIONS, ...opts };
  const img = source instanceof HTMLImageElement ? source : await loadImage(source);
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  // Teniamo una ROI grande: più superficie reale = meno ripetizione evidente.
  const analysisSide = Math.min(W, H, 768);
  const outerCrop = o.autoCropUniform
    ? findUniformSquare(img, analysisSide)
    : {
        x: Math.floor((W - Math.min(W, H)) / 2),
        y: Math.floor((H - Math.min(W, H)) / 2),
        side: Math.min(W, H),
      };

  const roi = makeCanvas(analysisSide, analysisSide);
  const rctx = roi.getContext('2d')!;
  rctx.imageSmoothingEnabled = true;
  rctx.imageSmoothingQuality = 'high';
  rctx.drawImage(
    img,
    outerCrop.x,
    outerCrop.y,
    outerCrop.side,
    outerCrop.side,
    0,
    0,
    analysisSide,
    analysisSide,
  );

  const Y = luminanceArray(rctx.getImageData(0, 0, analysisSide, analysisSide).data);
  const period = estimatePatternPeriod(Y, analysisSide, o.minPeriod, o.maxPeriod);
  const crop = chooseBestSeamCrop(Y, analysisSide, period, o.periodConfidence);

  const tile = makeCanvas(o.tileSize, o.tileSize);
  const tctx = tile.getContext('2d')!;
  tctx.imageSmoothingEnabled = true;
  tctx.imageSmoothingQuality = 'high';

  // Questo è il punto importante: NON ripetiamo micro-moduli, NON sintetizziamo.
  // Prendiamo il crop reale fase-allineato e lo portiamo alla risoluzione finale.
  tctx.drawImage(
    roi,
    crop.x,
    crop.y,
    crop.side,
    crop.side,
    0,
    0,
    o.tileSize,
    o.tileSize,
  );

  return {
    canvas: tile,
    periodX: period.px,
    periodY: period.py,
    repeatX: 1,
    repeatY: 1,
    confidence: period.confidence,
    usedFallback: false,
    cropSide: crop.side,
    seamScore: crop.seamScore,
  };
}

/** Disegna anteprima tile NxN del canvas seamless dentro un canvas target. */
export function drawTilePreview(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement,
  tilesPerSide = 3,
): void {
  const ctx = target.getContext('2d')!;
  const tw = target.width / tilesPerSide;
  const th = target.height / tilesPerSide;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, target.width, target.height);
  for (let y = 0; y < tilesPerSide; y++) {
    for (let x = 0; x < tilesPerSide; x++) {
      ctx.drawImage(source, x * tw, y * th, tw, th);
    }
  }
}

/** Converte un canvas in Blob PNG. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

export function canvasToDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

export async function dataURLToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(dataUrl);
  const c = makeCanvas(img.naturalWidth, img.naturalHeight);
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
}
