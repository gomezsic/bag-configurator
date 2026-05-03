/**
 * handlePresetFallback
 *
 * Preset front-left / front-right in coordinate NORMALIZZATE (0-1) sul canvas.
 * Vengono usati come fallback quando un upload sostituisce le maschere ma gli
 * asset secondari del manico (shadow/highlight/side_loops) puntano ancora a un
 * pack precedente con dimensioni diverse, oppure quando i side parts esistenti
 * non sono compatibili con il nuovo canvas.
 *
 * I preset descrivono SOLO la geometria (path + larghezza) e non gli asset
 * grafici: gli URL di mask/shadow/highlight vengono mantenuti a null finché
 * l'utente non carica overlay coerenti col nuovo canvas.
 */
export interface NormalizedPoint {
  /** 0..1 sul canvas width */
  x: number;
  /** 0..1 sul canvas height */
  y: number;
  /** larghezza locale come frazione del lato minore del canvas */
  width: number;
}

export interface NormalizedHandlePreset {
  partId: string;
  /** etichetta umana */
  label: string;
  /** rotazione iniziale dello stripe pattern */
  rotation: number;
  /** sortOrder relativo (0 = prima) */
  sortOrder: number;
  points: NormalizedPoint[];
}

/**
 * Preset di default per le 2 fettuccine laterali (passanti) di un duffle:
 * partono dal bordo basso del corpo, salgono lateralmente e si raccordano
 * alla base del manico principale.
 *
 * Coordinate calibrate empiricamente su canvas quadrato 1170×1170 e
 * ri-normalizzate; sono un punto di partenza ragionevole per qualunque
 * canvas — l'admin potrà rifinirle nell'editor manico.
 */
export const DEFAULT_SIDE_LOOP_PRESETS: NormalizedHandlePreset[] = [
  {
    partId: 'side_loop_left',
    label: 'Fettuccia laterale sinistra',
    rotation: 0,
    sortOrder: 0,
    points: [
      { x: 0.18, y: 0.62, width: 0.035 },
      { x: 0.20, y: 0.50, width: 0.035 },
      { x: 0.22, y: 0.40, width: 0.035 },
      { x: 0.24, y: 0.32, width: 0.035 },
    ],
  },
  {
    partId: 'side_loop_right',
    label: 'Fettuccia laterale destra',
    rotation: 0,
    sortOrder: 1,
    points: [
      { x: 0.82, y: 0.62, width: 0.035 },
      { x: 0.80, y: 0.50, width: 0.035 },
      { x: 0.78, y: 0.40, width: 0.035 },
      { x: 0.76, y: 0.32, width: 0.035 },
    ],
  },
];

/** Preset di default per il manico principale (arco superiore). */
export const DEFAULT_MAIN_HANDLE_PRESET: NormalizedHandlePreset = {
  partId: 'main',
  label: 'Manico principale',
  rotation: 0,
  sortOrder: 0,
  points: [
    { x: 0.30, y: 0.32, width: 0.045 },
    { x: 0.35, y: 0.20, width: 0.045 },
    { x: 0.45, y: 0.12, width: 0.045 },
    { x: 0.55, y: 0.12, width: 0.045 },
    { x: 0.65, y: 0.20, width: 0.045 },
    { x: 0.70, y: 0.32, width: 0.045 },
  ],
};

export interface AbsolutePoint {
  x: number;
  y: number;
  width: number;
}

/** Converte coordinate normalizzate in pixel assoluti per un dato canvas. */
export function denormalizePoints(
  preset: NormalizedHandlePreset,
  canvasWidth: number,
  canvasHeight: number,
): AbsolutePoint[] {
  const minSide = Math.min(canvasWidth, canvasHeight);
  return preset.points.map((p) => ({
    x: Math.round(p.x * canvasWidth),
    y: Math.round(p.y * canvasHeight),
    width: Math.max(2, Math.round(p.width * minSide)),
  }));
}

/**
 * Costruisce un path_json compatibile con handle_geometries / handle_side_parts
 * a partire da un preset normalizzato e dalle dimensioni del canvas.
 */
export function buildPathJsonFromPreset(
  preset: NormalizedHandlePreset,
  canvasWidth: number,
  canvasHeight: number,
): { paths: Array<{ id: string; closed: boolean; points: AbsolutePoint[] }> } {
  return {
    paths: [
      {
        id: preset.partId,
        closed: false,
        points: denormalizePoints(preset, canvasWidth, canvasHeight),
      },
    ],
  };
}

/**
 * Verifica se i side parts esistenti sono "compatibili" col canvas corrente.
 * Considera incompatibile se: 0 punti, oppure qualsiasi punto cade fuori dal
 * canvas, oppure tutti i punti sono concentrati in una porzione < 5% (segno
 * che il path è stato salvato per un canvas molto più grande).
 */
export function arePointsCompatibleWithCanvas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pathJson: any,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  if (!pathJson || typeof pathJson !== 'object') return false;
  const paths = Array.isArray(pathJson.paths) ? pathJson.paths : [];
  if (paths.length === 0) return false;
  let totalPoints = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of paths) {
    const pts = Array.isArray(p.points) ? p.points : [];
    for (const pt of pts) {
      if (typeof pt.x !== 'number' || typeof pt.y !== 'number') continue;
      totalPoints++;
      if (pt.x < 0 || pt.x > canvasWidth) return false;
      if (pt.y < 0 || pt.y > canvasHeight) return false;
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
  }
  if (totalPoints < 2) return false;
  const spreadX = (maxX - minX) / canvasWidth;
  const spreadY = (maxY - minY) / canvasHeight;
  // Se il path occupa meno del 5% del canvas in entrambi gli assi è sospetto
  if (spreadX < 0.05 && spreadY < 0.05) return false;
  return true;
}
