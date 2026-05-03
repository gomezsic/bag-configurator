/**
 * Handle Pattern Preset — tipi e default.
 *
 * Un preset definisce SOLO la suddivisione trasversale (U) del manico:
 * margini ai bordi, larghezze normalizzate delle strisce, spazi opzionali
 * fra strisce, grana opzionale.
 *
 * REGOLA MEMORIA: il colore della striscia dipende solo da U (larghezza),
 * NON da V (lunghezza). Le strisce sono bande longitudinali continue.
 */

export interface HandleStripeDef {
  color: string; // hex, es. "#e2188f"
  width: number; // normalizzato 0..1 sulla larghezza visibile
}

export interface HandlePatternPreset {
  name: string;
  stripeCount: number;
  stripes: HandleStripeDef[];
  /** spaziature fra coppie consecutive di strisce, length = stripeCount - 1 (normalizzate) */
  spacing: number[];
  edgeMarginLeft: number; // 0..0.5 normalizzato
  edgeMarginRight: number;
  grainEnabled?: boolean;
  grainOpacity?: number; // 0..1
  grainTextureUrl?: string | null;
}

export const DEFAULT_PRESET = (stripeCount = 5): HandlePatternPreset => {
  const w = (1 - 0) / stripeCount;
  return {
    name: 'New preset',
    stripeCount,
    stripes: Array.from({ length: stripeCount }, (_, i) => ({
      color: i % 2 === 0 ? '#e2188f' : '#f1eadb',
      width: w,
    })),
    spacing: Array.from({ length: Math.max(0, stripeCount - 1) }, () => 0),
    edgeMarginLeft: 0,
    edgeMarginRight: 0,
    grainEnabled: false,
    grainOpacity: 0.18,
    grainTextureUrl: null,
  };
};

/**
 * Normalizza il preset garantendo che (sum(stripes.width) + sum(spacing) +
 * margini) <= 1. Se eccede, scala proporzionalmente le strisce. Se manca
 * spazio, lo distribuisce.
 */
export function normalizePreset(p: HandlePatternPreset): HandlePatternPreset {
  const margin = (p.edgeMarginLeft || 0) + (p.edgeMarginRight || 0);
  const totalSpacing = (p.spacing || []).reduce((a, b) => a + b, 0);
  const totalStripes = (p.stripes || []).reduce((a, s) => a + s.width, 0);
  const total = margin + totalSpacing + totalStripes;
  if (total <= 0) return p;
  if (Math.abs(total - 1) < 1e-6) return p;
  // Scala SOLO le strisce (margini e spazi sono volutamente fissi)
  const remaining = Math.max(0.0001, 1 - margin - totalSpacing);
  const factor = remaining / totalStripes;
  return {
    ...p,
    stripes: p.stripes.map((s) => ({ ...s, width: s.width * factor })),
  };
}

/**
 * Converte un preset normalizzato in una sequenza ordinata di "bande U" con
 * bordo sinistro e destro normalizzati [0..1]. Le bande sono solo le strisce
 * colorate (margini e spazi diventano "buchi" trasparenti che NON si renderizzano).
 */
export interface UBand {
  uLeft: number;
  uRight: number;
  color: string;
  index: number;
}

export function presetToUBands(preset: HandlePatternPreset): UBand[] {
  const p = normalizePreset(preset);
  const bands: UBand[] = [];
  let cursor = p.edgeMarginLeft || 0;
  for (let i = 0; i < p.stripes.length; i++) {
    const s = p.stripes[i];
    const uLeft = cursor;
    const uRight = cursor + s.width;
    bands.push({ uLeft, uRight, color: s.color, index: i });
    cursor = uRight;
    if (i < p.stripes.length - 1) cursor += p.spacing[i] ?? 0;
  }
  return bands;
}
