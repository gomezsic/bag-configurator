/**
 * Handle Path types & helpers
 *
 * Formato JSON deterministico per la centerline di un manico.
 * Ogni path è una sequenza ordinata di punti con coordinate canvas (px) e
 * larghezza locale (px). La curvatura visiva sarà ottenuta in fase di
 * rendering interpolando con Catmull-Rom (Fase 3).
 */

export interface HandlePoint {
  /** Coordinata X in pixel canvas */
  x: number;
  /** Coordinata Y in pixel canvas */
  y: number;
  /** Larghezza locale del manico in pixel (perpendicolare alla tangente) */
  width: number;
}

/**
 * Comportamento di "ripiegamento" della superficie del manico nei tratti
 * curvi. In una curva alta il nastro ruota all'indietro, quindi solo una
 * finestra centrale del pattern è visibile.
 *
 * - tStart..tEnd  : intervallo lungo la centerline (0..1) in cui agisce
 * - tPeak         : punto di massimo ripiegamento (apice della curva)
 * - visibleWindow : larghezza visibile del pattern (0..1, 1 = tutto visibile)
 * - edgeFeather   : sfumatura ai bordi della finestra (riservato per estensioni)
 */
export interface FoldbackSegment {
  id: string;
  tStart: number;
  tPeak: number;
  tEnd: number;
  visibleWindowStart: number;
  visibleWindowPeak: number;
  visibleWindowEnd: number;
  edgeFeather?: number;
}

export interface SurfaceBehavior {
  mode: 'center_window_foldback';
  segments: FoldbackSegment[];
}

export interface HandlePath {
  id: string;
  closed: boolean;
  points: HandlePoint[];
  surfaceBehavior?: SurfaceBehavior;
}

export interface HandlePathDocument {
  /** Nome libero per riferimento */
  name?: string;
  canvasWidth: number;
  canvasHeight: number;
  paths: HandlePath[];
}

export const EMPTY_PATH_DOC = (
  canvasWidth = 2000,
  canvasHeight = 2000,
): HandlePathDocument => ({
  name: 'main',
  canvasWidth,
  canvasHeight,
  paths: [
    {
      id: 'main',
      closed: false,
      points: [],
    },
  ],
});

/** Distanza euclidea fra due punti */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Trova l'indice del punto più vicino entro una soglia (in coordinate canvas).
 * Restituisce -1 se nessuno è abbastanza vicino.
 */
export function findNearestPointIndex(
  points: HandlePoint[],
  x: number,
  y: number,
  threshold: number,
): number {
  let bestIdx = -1;
  let bestDist = threshold;
  for (let i = 0; i < points.length; i++) {
    const d = distance(points[i], { x, y });
    if (d <= bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Trova il segmento più vicino al punto (x,y) restituendo l'indice del primo
 * vertice del segmento. Usato per inserire un nuovo punto fra due esistenti.
 */
export function findNearestSegmentIndex(
  points: HandlePoint[],
  x: number,
  y: number,
  threshold: number,
): number {
  let bestIdx = -1;
  let bestDist = threshold;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const d = pointToSegmentDistance({ x, y }, a, b);
    if (d <= bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function pointToSegmentDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Validation: ogni path deve avere almeno 2 punti e width >= 1 */
export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

export function validatePathDocument(doc: HandlePathDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!doc.paths.length) {
    issues.push({ level: 'error', message: 'Nessun path definito' });
    return issues;
  }
  doc.paths.forEach((p, idx) => {
    if (p.points.length < 2) {
      issues.push({
        level: 'error',
        message: `Path "${p.id || idx}" ha meno di 2 punti`,
      });
    }
    p.points.forEach((pt, j) => {
      if (pt.width < 1) {
        issues.push({
          level: 'warning',
          message: `Path "${p.id || idx}" punto #${j + 1}: width < 1px`,
        });
      }
    });
  });
  return issues;
}
