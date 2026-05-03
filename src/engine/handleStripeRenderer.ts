/**
 * Handle Stripe Renderer
 *
 * Genera un canvas off-screen con N strisce LONGITUDINALI continue lungo la
 * centerline di un manico, poi lo clippa con la mask del manico, applica
 * eventuale grana e gli overlay (shadow/highlight/details/hardware).
 *
 * REGOLA INVIOLABILE (memoria):
 *  - U = posizione attraverso la larghezza del manico (0..1)
 *  - V = posizione lungo la lunghezza del manico
 *  - colore = funzione di U soltanto, COSTANTE in V
 *  - niente tile lungo V, niente blocchi sull'arco superiore
 *
 * Algoritmo:
 *  1. Campiona la centerline a passo costante (super-sampling) interpolando
 *     con Catmull-Rom per ottenere una curva liscia.
 *  2. Per ogni campione calcola la tangente (differenza centrale) e quindi
 *     la normale unitaria perpendicolare.
 *  3. Per ogni striscia (banda U del preset), calcola due polilinee laterali
 *     come offset della centerline:  P + n * (uLeft - 0.5) * width(s)  e
 *     P + n * (uRight - 0.5) * width(s).  Width(s) è interpolata linearmente
 *     fra i punti del path utente.
 *  4. Riempie ogni striscia come singolo polygon con il suo colore solido.
 *     -> stripe continua dall'inizio alla fine, segue la curvatura, mai
 *        spezzata in blocchi.
 *  5. Clippa il risultato con handle_mask.png.
 *  6. Applica grain opzionale come overlay separato (multiply, mascherato).
 *  7. Applica shadow (multiply), highlight (screen), details (normal),
 *     hardware (normal) sopra.
 */

import type { HandlePathDocument, SurfaceBehavior } from './handlePath';
import { presetToUBands, type HandlePatternPreset } from './handlePreset';

/**
 * Texture pattern: alternativa al preset matematico.
 * Quando presente (handle_colors.texture_url), il manico viene riempito
 * mappando la texture sulla centerline (U = larghezza, V = lunghezza)
 * invece di disegnare strisce di colore solido.
 */
export interface HandleTexturePattern {
  texture: HTMLImageElement;
  /** Scala lungo V (lunghezza). 1 = la texture copre tutto il manico una volta. */
  scaleV?: number;
  /** Rotazione opzionale della texture (gradi). */
  rotationDeg?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Foldback: finestra visibile del pattern lungo la centerline
// ─────────────────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Restituisce la "finestra visibile" del pattern (0..1) per un dato t lungo
 * la centerline. 1 = tutto il pattern visibile (tratto rettilineo). Valori
 * più piccoli = solo la zona centrale del pattern è visibile (curva alta).
 */
function getVisibleWindowAtT(t: number, behavior?: SurfaceBehavior): number {
  if (!behavior || behavior.mode !== 'center_window_foldback') return 1;
  let vw = 1;
  for (const seg of behavior.segments) {
    if (t < seg.tStart || t > seg.tEnd) continue;
    let local: number;
    if (t <= seg.tPeak) {
      local = smoothstep(seg.tStart, seg.tPeak, t);
      vw = Math.min(vw, lerp(seg.visibleWindowStart, seg.visibleWindowPeak, local));
    } else {
      local = smoothstep(seg.tPeak, seg.tEnd, t);
      vw = Math.min(vw, lerp(seg.visibleWindowPeak, seg.visibleWindowEnd, local));
    }
  }
  return Math.max(0, Math.min(1, vw));
}

interface Vec2 { x: number; y: number }

export interface RenderedHandleAssets {
  mask: HTMLImageElement | null;
  shadow?: HTMLImageElement | null;
  highlight?: HTMLImageElement | null;
  details?: HTMLImageElement | null;
  hardware?: HTMLImageElement | null;
  grain?: HTMLImageElement | null;
}

export interface RenderHandleOptions {
  doc: HandlePathDocument;
  preset: HandlePatternPreset;
  assets: RenderedHandleAssets;
  /** Numero di campioni lungo la curva (default: ~ length/2 px). */
  samples?: number;
  /**
   * Texture pattern opzionale. Se fornito, sostituisce le strisce solide
   * del preset: la texture viene mappata sulla centerline come ribbon.
   */
  texturePattern?: HandleTexturePattern;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catmull-Rom smoothing
// ─────────────────────────────────────────────────────────────────────────────

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

interface Sample { x: number; y: number; width: number }

/** Campiona la centerline con Catmull-Rom restituendo posizione e width interp. */
function sampleCenterline(points: { x: number; y: number; width: number }[], samplesPerSegment = 48): Sample[] {
  if (points.length < 2) return points.map(p => ({ ...p }));

  const pad = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  const out: Sample[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = pad(i - 1);
    const p1 = pad(i);
    const p2 = pad(i + 1);
    const p3 = pad(i + 2);
    const last = i === points.length - 2;
    const steps = samplesPerSegment;
    for (let s = 0; s < steps + (last ? 1 : 0); s++) {
      const t = s / steps;
      out.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
        width: catmullRom(p0.width, p1.width, p2.width, p3.width, t),
      });
    }
  }
  return out;
}

/**
 * Ricampiona la curva a passo costante in arc-length. Catmull-Rom con t
 * uniforme produce campioni più radi sull'apex (dove la curvatura è alta) e
 * più fitti sui rettilinei. Per un transport stabile della normale e per
 * stripe perfettamente parallele all'apex serve invece un passo costante in
 * lunghezza d'arco. `targetSpacingPx` è la distanza desiderata fra campioni.
 */
function resampleByArcLength(samples: Sample[], targetSpacingPx = 3): Sample[] {
  if (samples.length < 2) return samples;
  const cum: number[] = [0];
  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i].x - samples[i - 1].x;
    const dy = samples[i].y - samples[i - 1].y;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const total = cum[cum.length - 1];
  if (total <= 0) return samples;
  const n = Math.max(2, Math.ceil(total / targetSpacingPx) + 1);
  const out: Sample[] = new Array(n);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total;
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const segLen = cum[j + 1] - cum[j] || 1;
    const t = (target - cum[j]) / segLen;
    out[k] = {
      x: samples[j].x + (samples[j + 1].x - samples[j].x) * t,
      y: samples[j].y + (samples[j + 1].y - samples[j].y) * t,
      width: samples[j].width + (samples[j + 1].width - samples[j].width) * t,
    };
  }
  return out;
}

/**
 * Calcola normali unitarie tramite differenze centrali sui campioni e ne
 * STABILIZZA l'orientamento lungo la curva: se il prodotto scalare con la
 * normale precedente è negativo, viene invertita. Questo evita il "twist"
 * sull'arco superiore del manico, dove la tangente ruota di ~180° e la
 * scelta naive (-ty, tx) farebbe flippare la normale all'apex, capovolgendo
 * l'ordine delle strisce.
 *
 * Smoothing aggiuntivo: applichiamo una piccola media mobile sulle tangenti
 * prima di derivare la normale, per assorbire micro-rumore nei punti utente.
 */
function computeNormals(samples: Sample[]): Vec2[] {
  const n = samples.length;
  const tangents: Vec2[] = new Array(n);

  // 1. Tangenti grezze (differenze centrali)
  for (let i = 0; i < n; i++) {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(n - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tangents[i] = { x: tx / len, y: ty / len };
  }

  // 2. Smoothing della tangente con kernel gaussiano largo (9 tap, σ≈2).
  //    Un kernel piccolo non basta sull'apex: lì la curvatura cambia
  //    rapidamente in pochi campioni e il "twist" residuo si vede come
  //    schiacciamento delle strisce. Con 9 tap la tangente cambia in modo
  //    monotono anche sull'apice, eliminando le inversioni locali.
  //    Pesi normalizzati: [1,8,28,56,70,56,28,8,1] / 256.
  const W = [1, 8, 28, 56, 70, 56, 28, 8, 1];
  const WSUM = 256;
  const HALF = 4;
  const smoothed: Vec2[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let sx = 0;
    let sy = 0;
    for (let k = -HALF; k <= HALF; k++) {
      const idx = Math.max(0, Math.min(n - 1, i + k));
      const w = W[k + HALF];
      sx += tangents[idx].x * w;
      sy += tangents[idx].y * w;
    }
    sx /= WSUM;
    sy /= WSUM;
    const len = Math.hypot(sx, sy) || 1;
    smoothed[i] = { x: sx / len, y: sy / len };
  }

  // 3. Normali con propagazione di orientamento (parallel transport).
  //    La prima normale è (-ty, tx). Ogni successiva viene flippata se il
  //    dot product con la precedente è negativo, così attraversando l'apex
  //    (dove la tangente ruota di ~180°) le normali NON si capovolgono.
  const rawNormals: Vec2[] = new Array(n);
  let prevN: Vec2 = { x: -smoothed[0].y, y: smoothed[0].x };
  rawNormals[0] = prevN;
  for (let i = 1; i < n; i++) {
    let nx = -smoothed[i].y;
    let ny = smoothed[i].x;
    if (nx * prevN.x + ny * prevN.y < 0) {
      nx = -nx;
      ny = -ny;
    }
    prevN = { x: nx, y: ny };
    rawNormals[i] = prevN;
  }

  // 4. Smoothing finale delle normali (stesso kernel gaussiano).
  //    Riduce gli ultimi micro-jitter residui sull'apex senza alterare
  //    l'orientamento globale (già garantito dal parallel transport).
  const normals: Vec2[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let sx = 0;
    let sy = 0;
    for (let k = -HALF; k <= HALF; k++) {
      const idx = Math.max(0, Math.min(n - 1, i + k));
      const w = W[k + HALF];
      sx += rawNormals[idx].x * w;
      sy += rawNormals[idx].y * w;
    }
    sx /= WSUM;
    sy /= WSUM;
    const len = Math.hypot(sx, sy) || 1;
    normals[i] = { x: sx / len, y: sy / len };
  }
  return normals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stripe polygon builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Costruisce il polygon di UNA striscia: cammina avanti lungo i campioni col
 * bordo sinistro (offset uLeft), poi indietro col bordo destro (offset uRight).
 *
 * Se `visibility` è fornito, il polygon viene spezzato in più sotto-polygon
 * tagliando i tratti contigui in cui la banda non è visibile (foldback). In
 * quel modo la stripe si "spegne" gradualmente nella curva alta.
 */
function fillStripe(
  ctx: CanvasRenderingContext2D,
  samples: Sample[],
  normals: Vec2[],
  uLeft: number,
  uRight: number,
  color: string,
  visibility?: boolean[],
): void {
  if (samples.length < 2) return;
  const oL = uLeft - 0.5;
  const oR = uRight - 0.5;
  const n = samples.length;

  // Trova i tratti contigui di campioni "visibili"
  const ranges: Array<[number, number]> = [];
  if (!visibility) {
    ranges.push([0, n - 1]);
  } else {
    let start = -1;
    for (let i = 0; i < n; i++) {
      if (visibility[i]) {
        if (start < 0) start = i;
      } else if (start >= 0) {
        if (i - 1 - start >= 1) ranges.push([start, i - 1]);
        start = -1;
      }
    }
    if (start >= 0 && n - 1 - start >= 1) ranges.push([start, n - 1]);
  }

  ctx.fillStyle = color;
  for (const [a, b] of ranges) {
    ctx.beginPath();
    for (let i = a; i <= b; i++) {
      const s = samples[i];
      const nrm = normals[i];
      const x = s.x + nrm.x * oL * s.width;
      const y = s.y + nrm.y * oL * s.width;
      if (i === a) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = b; i >= a; i--) {
      const s = samples[i];
      const nrm = normals[i];
      const x = s.x + nrm.x * oR * s.width;
      const y = s.y + nrm.y * oR * s.width;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Riempie il manico mappando una texture sulla centerline come "ribbon".
 *
 * Strategia: per ogni segmento fra due campioni successivi della centerline
 * costruiamo un quad (4 vertici offset di +/- width/2 lungo la normale) e ci
 * mappiamo dentro la striscia di texture corrispondente alla porzione V del
 * segmento (V = arc-length cumulata / lunghezza totale * scaleV, modulo 1).
 *
 * Per ogni quad usiamo un transform affine stimato da 3 punti:
 *  src triangle = (0, vTop)-(texW, vTop)-(0, vBottom)
 *  dst triangle = (leftA)-(rightA)-(leftB)
 * e disegniamo la striscia clippata sul quad. Il bordo opposto (rightB) è
 * approssimato linearmente; per spacing fra campioni piccolo (≤ ~3px) la
 * deformazione visibile è trascurabile.
 *
 * Vantaggio: niente WebGL, niente shader. Tutto Canvas2D.
 */
function fillTextureRibbon(
  ctx: CanvasRenderingContext2D,
  samples: Sample[],
  normals: Vec2[],
  texture: HTMLImageElement,
  scaleV: number,
  visibility?: boolean[],
): void {
  if (samples.length < 2) return;
  const texW = texture.naturalWidth || texture.width;
  const texH = texture.naturalHeight || texture.height;
  if (!texW || !texH) return;

  // Calcolo arc-length cumulata
  const cum: number[] = [0];
  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i].x - samples[i - 1].x;
    const dy = samples[i].y - samples[i - 1].y;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const total = cum[cum.length - 1] || 1;
  // Quante volte la texture si ripete lungo V. scaleV=1 -> una sola volta
  // (la texture viene "stiracchiata" su tutta la lunghezza). scaleV=4 -> 4
  // ripetizioni. Per texture di pattern continui (righe verticali) scaleV
  // grande mantiene il rapporto di tessitura naturale.
  const repeats = Math.max(0.1, scaleV || 1);

  for (let i = 0; i < samples.length - 1; i++) {
    if (visibility && (!visibility[i] || !visibility[i + 1])) continue;
    const sA = samples[i];
    const sB = samples[i + 1];
    const nA = normals[i];
    const nB = normals[i + 1];
    const wA = sA.width * 0.5;
    const wB = sB.width * 0.5;

    const leftA = { x: sA.x - nA.x * wA, y: sA.y - nA.y * wA };
    const rightA = { x: sA.x + nA.x * wA, y: sA.y + nA.y * wA };
    const leftB = { x: sB.x - nB.x * wB, y: sB.y - nB.y * wB };
    const rightB = { x: sB.x + nB.x * wB, y: sB.y + nB.y * wB };

    // Coordinate V (texture verticale) in pixel — wrap modulo texH per ripetere
    const vA = ((cum[i] / total) * repeats * texH) % texH;
    const vB = ((cum[i + 1] / total) * repeats * texH) % texH;
    // Se vB < vA significa che siamo passati per il wrap: gestiamo come due
    // sotto-segmenti per evitare smearing
    const segments: Array<{ v0: number; v1: number; t0: number; t1: number }> = [];
    if (vB >= vA) {
      segments.push({ v0: vA, v1: vB, t0: 0, t1: 1 });
    } else {
      const split = (texH - vA) / (texH - vA + vB);
      segments.push({ v0: vA, v1: texH, t0: 0, t1: split });
      segments.push({ v0: 0, v1: vB, t0: split, t1: 1 });
    }

    for (const seg of segments) {
      const lerpPt = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });
      const lA = lerpPt(leftA, leftB, seg.t0);
      const rA = lerpPt(rightA, rightB, seg.t0);
      const lB = lerpPt(leftA, leftB, seg.t1);
      const rB = lerpPt(rightA, rightB, seg.t1);

      // Affine transform da triangolo src (0,v0)-(texW,v0)-(0,v1) a dst (lA)-(rA)-(lB)
      // Risoluzione: T(x,y) = M * [x, y, 1]^T
      // src: (0, v0) -> lA ; (texW, v0) -> rA ; (0, v1) -> lB
      // M = [[a, c, e],[b, d, f]]
      // a*0 + c*v0 + e = lA.x  => e = lA.x - c*v0
      // a*texW + c*v0 + e = rA.x => a*texW = rA.x - lA.x => a = (rA.x - lA.x)/texW
      // a*0 + c*v1 + e = lB.x   => c*(v1 - v0) = lB.x - lA.x => c = (lB.x - lA.x)/(v1-v0)
      // (analogo per y)
      const dv = seg.v1 - seg.v0 || 1;
      const a = (rA.x - lA.x) / texW;
      const b = (rA.y - lA.y) / texW;
      const c = (lB.x - lA.x) / dv;
      const d = (lB.y - lA.y) / dv;
      const e = lA.x - c * seg.v0;
      const f = lA.y - d * seg.v0;

      ctx.save();
      // Clip al quadrilatero di destinazione (lA-rA-rB-lB)
      ctx.beginPath();
      ctx.moveTo(lA.x, lA.y);
      ctx.lineTo(rA.x, rA.y);
      ctx.lineTo(rB.x, rB.y);
      ctx.lineTo(lB.x, lB.y);
      ctx.closePath();
      ctx.clip();
      ctx.transform(a, b, c, d, e, f);
      // Disegniamo la texture intera; il clip taglierà al quad
      ctx.drawImage(texture, 0, 0);
      ctx.restore();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderizza il manico configurato in un canvas off-screen di dimensioni pari
 * al canvas logico del documento (path.canvasWidth × path.canvasHeight).
 *
 * Il canvas restituito ha già: strisce + grain + overlay applicati e clippato
 * dalla mask. Può essere blittato 1:1 sul canvas finale dal layerComposer.
 */
export function renderHandleToCanvas(opts: RenderHandleOptions): HTMLCanvasElement {
  const { doc, preset, assets, texturePattern } = opts;
  const w = doc.canvasWidth;
  const h = doc.canvasHeight;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  if (!octx) return out;

  const path = doc.paths[0];
  if (!path || path.points.length < 2 || !assets.mask) return out;

  // 1. Campiona la centerline con Catmull-Rom (denso) + ricampionamento a
  //    passo costante in arc-length. Lo step in arc-length è cruciale per
  //    avere normali stabili sull'apex e stripe perfettamente parallele
  //    lungo tutta la curva (incluso l'arco superiore del manico).
  const raw = sampleCenterline(path.points, 48);
  const samples = resampleByArcLength(raw, 2.5);
  const normals = computeNormals(samples);

  // 2. Renderizza le strisce su un canvas intermedio "stripeLayer"
  const stripeLayer = document.createElement('canvas');
  stripeLayer.width = w;
  stripeLayer.height = h;
  const sctx = stripeLayer.getContext('2d');
  if (!sctx) return out;

  // Pre-calcola la "finestra visibile" per ciascun campione lungo la centerline.
  const N = samples.length;
  const behavior = path.surfaceBehavior;
  const windows: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const t = N > 1 ? i / (N - 1) : 0;
    windows[i] = getVisibleWindowAtT(t, behavior);
  }

  if (texturePattern && texturePattern.texture) {
    // MODE TEXTURE: mappa l'immagine sul ribbon. Il foldback applicato come
    // visibility globale (per-campione) anziché per-banda: quando la finestra
    // visibile scende sotto soglia, il quad non viene disegnato.
    const visibility = behavior
      ? windows.map((vw) => vw > 0.4)
      : undefined;
    fillTextureRibbon(
      sctx,
      samples,
      normals,
      texturePattern.texture,
      texturePattern.scaleV ?? 1,
      visibility,
    );
  } else {
    // MODE STRIPE: pattern matematico classico
    const bands = presetToUBands(preset);
    for (const b of bands) {
      const visibility = behavior
        ? windows.map((vw) => {
            const halfVw = vw / 2;
            const wMin = 0.5 - halfVw;
            const wMax = 0.5 + halfVw;
            return b.uLeft >= wMin && b.uRight <= wMax;
          })
        : undefined;
      fillStripe(sctx, samples, normals, b.uLeft, b.uRight, b.color, visibility);
    }
  }

  // 3. Grain opzionale, applicato SOLO sopra il colore (in screen space, ma
  //    finalmente clippato dalla mask insieme alle strisce). Volutamente
  //    semplice: tile della texture con multiply leggero.
  if (preset.grainEnabled && assets.grain && (preset.grainOpacity ?? 0) > 0) {
    sctx.save();
    sctx.globalAlpha = preset.grainOpacity ?? 0.18;
    sctx.globalCompositeOperation = 'multiply';
    const pattern = sctx.createPattern(assets.grain, 'repeat');
    if (pattern) {
      sctx.fillStyle = pattern;
      sctx.fillRect(0, 0, w, h);
    }
    sctx.restore();
  }

  // 4. Clip dello stripeLayer con la mask del manico (alpha della mask).
  //    Tecnica: disegna prima la mask sul canvas finale, poi composita lo
  //    stripeLayer in modalità 'source-in' su un buffer, infine blittalo.
  const clipped = document.createElement('canvas');
  clipped.width = w;
  clipped.height = h;
  const cctx = clipped.getContext('2d');
  if (!cctx) return out;
  cctx.drawImage(assets.mask, 0, 0, w, h);
  cctx.globalCompositeOperation = 'source-in';
  cctx.drawImage(stripeLayer, 0, 0);

  // 5. Compose finale: strisce clippate + overlay nel giusto ordine
  octx.drawImage(clipped, 0, 0);

  if (assets.shadow) {
    octx.save();
    octx.globalCompositeOperation = 'multiply';
    octx.drawImage(assets.shadow, 0, 0, w, h);
    octx.restore();
  }
  if (assets.highlight) {
    octx.save();
    octx.globalCompositeOperation = 'screen';
    octx.globalAlpha = 0.85;
    octx.drawImage(assets.highlight, 0, 0, w, h);
    octx.restore();
  }
  if (assets.details) {
    octx.drawImage(assets.details, 0, 0, w, h);
  }
  if (assets.hardware) {
    octx.drawImage(assets.hardware, 0, 0, w, h);
  }

  return out;
}
