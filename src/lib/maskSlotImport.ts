/**
 * maskSlotImport
 *
 * Logica di import "a slot" per il nuovo flusso semplificato:
 *  - 1 originale + 6 maschere autoritative (front, sides, top, handles, side_loops, zipper)
 *  - Nessun manifest richiesto, nessuna struttura cartelle obbligatoria
 *  - Riconoscimento dei file dal nome
 *  - Commit diretto su bag_view + mask_zones esistenti
 */

import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_SIDE_LOOP_PRESETS,
  arePointsCompatibleWithCanvas,
  buildPathJsonFromPreset,
} from './handlePresetFallback';

export type SlotKey =
  | 'original'
  | 'body_front'
  | 'body_sides'
  | 'body_top'
  | 'handles'
  | 'side_loops'
  | 'zipper';

export interface SlotDefinition {
  key: SlotKey;
  label: string;
  description: string;
  required: boolean;
  /** Categoria per la mask_zone (per body/zipper/side_loops); 'none' = non crea zona */
  zoneCategory: 'fabric' | 'handle' | 'detail' | 'none';
  /** zone_type usato in mask_zones */
  zoneType?: string;
  /** Pattern di filename per riconoscimento automatico */
  patterns: RegExp[];
}

export const SLOT_DEFINITIONS: SlotDefinition[] = [
  {
    key: 'original',
    label: 'Originale',
    description: 'Foto della borsa, sfondo trasparente',
    required: true,
    zoneCategory: 'none',
    patterns: [/^original\b/i, /^base\b/i, /^bag[_-]?original/i],
  },
  {
    key: 'body_front',
    label: 'Maschera Tessuto Frontale',
    description: 'Pannello frontale del corpo',
    required: true,
    zoneCategory: 'fabric',
    zoneType: 'body_front',
    patterns: [
      /mask[_-]?body[_-]?front/i,
      /body[_-]?front[_-]?mask/i,
      /^front\b.*mask/i,
    ],
  },
  {
    key: 'body_sides',
    label: 'Maschera Tessuto Laterali',
    description: 'Pannelli laterali del corpo',
    required: true,
    zoneCategory: 'fabric',
    zoneType: 'body_sides',
    patterns: [
      /mask[_-]?body[_-]?(sides?|laterali)/i,
      /body[_-]?(sides?|laterali)[_-]?mask/i,
      /^side(s)?\b.*mask/i,
    ],
  },
  {
    key: 'body_top',
    label: 'Maschera Tessuto Superiore',
    description: 'Banda/pannello superiore',
    required: true,
    zoneCategory: 'fabric',
    zoneType: 'body_top',
    patterns: [
      /mask[_-]?body[_-]?(top|superior)/i,
      /body[_-]?(top|superior)[_-]?mask/i,
      /^top\b.*mask/i,
    ],
  },
  {
    key: 'handles',
    label: 'Maschera Manici',
    description: 'Manici (renderizzati a strisce)',
    required: true,
    zoneCategory: 'none', // handle gestito dal flusso strisce esistente
    patterns: [
      /mask[_-]?handles?/i,
      /handles?[_-]?mask/i,
      /^manici?\b.*mask/i,
    ],
  },
  {
    key: 'side_loops',
    label: 'Maschera Fettuccine Laterali',
    description: 'Fettuccine/passanti laterali',
    required: false,
    zoneCategory: 'overlay',
    zoneType: 'side_loops',
    patterns: [
      /mask[_-]?side[_-]?loops?/i,
      /side[_-]?loops?[_-]?mask/i,
      /mask[_-]?fettuccine/i,
      /fettuccine[_-]?mask/i,
    ],
  },
  {
    key: 'zipper',
    label: 'Maschera Cerniera',
    description: 'Cerniera/zip (colore variabile)',
    required: false,
    zoneCategory: 'overlay',
    zoneType: 'zipper',
    patterns: [
      /mask[_-]?zipper/i,
      /zipper[_-]?mask/i,
      /mask[_-]?cerniera/i,
      /cerniera[_-]?mask/i,
      /^zip\b.*mask/i,
    ],
  },
];

export type SlotState = Record<SlotKey, File | null>;

export const emptySlotState = (): SlotState =>
  SLOT_DEFINITIONS.reduce((acc, s) => {
    acc[s.key] = null;
    return acc;
  }, {} as SlotState);

/** Riconosce a quale slot appartiene un file, dal nome. Restituisce null se nessun match. */
export function detectSlotForFile(file: File): SlotKey | null {
  const name = file.name.toLowerCase();
  // Skip non-immagini
  if (!/\.(png|jpe?g|webp)$/i.test(name)) return null;
  for (const def of SLOT_DEFINITIONS) {
    if (def.patterns.some((re) => re.test(name))) return def.key;
  }
  return null;
}

/** Distribuisce un set di file negli slot riconoscendo dal nome. Restituisce file non assegnati. */
export function autoAssignFiles(
  files: File[],
  current: SlotState,
): { next: SlotState; assigned: SlotKey[]; unassigned: File[] } {
  const next: SlotState = { ...current };
  const assigned: SlotKey[] = [];
  const unassigned: File[] = [];
  for (const f of files) {
    const slot = detectSlotForFile(f);
    if (slot && !next[slot]) {
      next[slot] = f;
      assigned.push(slot);
    } else if (slot && next[slot]) {
      // Slot già occupato — ignora (l'utente sostituisce manualmente)
      unassigned.push(f);
    } else {
      unassigned.push(f);
    }
  }
  return { next, assigned, unassigned };
}

// ─── Commit ──────────────────────────────────────────────────────────────────

export interface SlotCommitProgress {
  step: string;
  current: number;
  total: number;
}

export interface SlotCommitResult {
  uploadedFiles: number;
  zonesCreated: number;
  baseImageUpdated: boolean;
  handleMaskUploaded: boolean;
  rescaledHandlePath?: boolean;
  /** Numero di side parts ricreati da preset di fallback */
  fallbackSidePartsApplied?: number;
  /** True se gli overlay obsoleti del manico sono stati ripuliti */
  staleHandleOverlaysCleared?: boolean;
}

async function uploadBlob(
  blob: Blob,
  storagePath: string,
  contentType: string,
): Promise<string> {
  const { error } = await supabase.storage
    .from('admin-assets')
    .upload(storagePath, blob, { cacheControl: '3600', upsert: true, contentType });
  if (error) throw error;
  const { data } = supabase.storage.from('admin-assets').getPublicUrl(storagePath);
  return data.publicUrl;
}

async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export interface SlotCommitTarget {
  bagModelId: string;
  bagViewId: string;
  bagModelSlug: string;
  bagViewSlug: string;
}

export async function commitSlotImport(
  slots: SlotState,
  target: SlotCommitTarget,
  onProgress?: (p: SlotCommitProgress) => void,
): Promise<SlotCommitResult> {
  const stamp = Date.now();
  const baseFolder = `slots/${target.bagModelSlug}/${target.bagViewSlug}-${stamp}`;

  const filesToUpload: Array<{ key: SlotKey; file: File }> = [];
  for (const def of SLOT_DEFINITIONS) {
    const f = slots[def.key];
    if (f) filesToUpload.push({ key: def.key, file: f });
  }

  if (filesToUpload.length === 0) {
    throw new Error('Nessun file da caricare');
  }

  const required = SLOT_DEFINITIONS.filter((d) => d.required);
  for (const def of required) {
    if (!slots[def.key]) {
      throw new Error(`Slot obbligatorio mancante: ${def.label}`);
    }
  }

  // Upload
  const urls: Partial<Record<SlotKey, string>> = {};
  let uploaded = 0;
  for (const { key, file } of filesToUpload) {
    onProgress?.({
      step: `Upload ${key}`,
      current: uploaded,
      total: filesToUpload.length,
    });
    const ext = file.name.split('.').pop() || 'png';
    const storagePath = `${baseFolder}/${key}-${stamp}.${ext}`;
    const ct = file.type || 'image/png';
    urls[key] = await uploadBlob(file, storagePath, ct);
    uploaded++;
  }

  // Aggiorna bag_view (base image + canvas size dall'originale).
  // Salva il rapporto di scala per riallineare path manici / placements.
  let baseImageUpdated = false;
  let scaleX = 1;
  let scaleY = 1;
  let canvasChanged = false;
  if (urls.original && slots.original) {
    onProgress?.({
      step: 'Aggiornamento vista',
      current: uploaded,
      total: filesToUpload.length,
    });
    // Canvas attuale (prima del cambio)
    const { data: currentView } = await supabase
      .from('bag_views')
      .select('canvas_width, canvas_height')
      .eq('id', target.bagViewId)
      .maybeSingle();

    const dims = await readImageDimensions(slots.original);
    const update: { base_image_url: string; canvas_width?: number; canvas_height?: number } = {
      base_image_url: urls.original,
    };
    if (dims) {
      update.canvas_width = dims.width;
      update.canvas_height = dims.height;
      if (currentView && currentView.canvas_width && currentView.canvas_height) {
        scaleX = dims.width / currentView.canvas_width;
        scaleY = dims.height / currentView.canvas_height;
        canvasChanged = Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001;
      }
    }
    const { error } = await supabase
      .from('bag_views')
      .update(update)
      .eq('id', target.bagViewId);
    if (error) throw error;
    baseImageUpdated = true;
  }

  // Pulisci mask_zones esistenti per le categorie che stiamo (ri)creando.
  // Cancelliamo tutte le zone fabric+detail della view: il nuovo flusso è autoritativo.
  onProgress?.({
    step: 'Pulizia zone esistenti',
    current: uploaded,
    total: filesToUpload.length,
  });
  await supabase
    .from('mask_zones')
    .delete()
    .eq('bag_view_id', target.bagViewId)
    .in('zone_category', ['fabric', 'detail']);

  // Crea le mask_zones nuove
  let zonesCreated = 0;
  let sortOrder = 0;
  for (const def of SLOT_DEFINITIONS) {
    if (def.zoneCategory === 'none') continue;
    if (!def.zoneType) continue;
    const url = urls[def.key];
    if (!url) continue;

    const { error } = await supabase.from('mask_zones').insert({
      bag_view_id: target.bagViewId,
      zone_type: def.zoneType,
      zone_category: def.zoneCategory,
      label: def.label,
      mask_image_url: url,
      texture_scale: 1,
      texture_rotation: 0,
      texture_offset_x: 0,
      texture_offset_y: 0,
      sort_order: sortOrder++,
    });
    if (!error) zonesCreated++;
  }

  // Handle mask → handle_geometries.mask_url (se la view ne ha una).
  // IMPORTANTE: quando arriva una nuova maschera handles, gli overlay
  // shadow/highlight/details/hardware del pack precedente NON sono più
  // garantiti coerenti col nuovo canvas → li azzeriamo per evitare
  // sovrapposizioni di "manico fantasma" alla risoluzione vecchia.
  let handleMaskUploaded = false;
  let staleHandleOverlaysCleared = false;
  if (urls.handles) {
    onProgress?.({
      step: 'Aggiornamento manico',
      current: uploaded,
      total: filesToUpload.length,
    });
    const { data: existingGeo } = await supabase
      .from('handle_geometries')
      .select('id, shadow_url, highlight_url, details_url, hardware_url')
      .eq('bag_view_id', target.bagViewId)
      .maybeSingle();

    if (existingGeo) {
      const hadStale =
        !!existingGeo.shadow_url ||
        !!existingGeo.highlight_url ||
        !!existingGeo.details_url ||
        !!existingGeo.hardware_url;
      const { error } = await supabase
        .from('handle_geometries')
        .update({
          mask_url: urls.handles,
          shadow_url: null,
          highlight_url: null,
          details_url: null,
          hardware_url: null,
        })
        .eq('id', existingGeo.id);
      if (!error) {
        handleMaskUploaded = true;
        staleHandleOverlaysCleared = hadStale;
      }
    } else {
      const { error } = await supabase.from('handle_geometries').insert({
        bag_view_id: target.bagViewId,
        mask_url: urls.handles,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        path_json: { paths: [] } as any,
      });
      if (!error) handleMaskUploaded = true;
    }
  }

  // Rescale path manici / side parts / placements se il canvas è cambiato.
  let rescaledHandlePath = false;
  if (canvasChanged) {
    onProgress?.({
      step: 'Riallineamento manici',
      current: uploaded,
      total: filesToUpload.length,
    });
    rescaledHandlePath = await rescaleHandleAndPlacements(
      target.bagViewId,
      scaleX,
      scaleY,
    );
  }

  // Fallback side parts: se è stato caricato lo slot side_loops oppure se
  // i side parts esistenti puntano a maschere obsolete (oppure non sono
  // compatibili col nuovo canvas), ricostruiamo i side parts da preset
  // normalizzati (front-left / front-right). Gli URL di mask/shadow/highlight
  // restano null finché l'utente non carica overlay coerenti.
  let fallbackSidePartsApplied = 0;
  const finalCanvas = await fetchViewCanvas(target.bagViewId);
  if (finalCanvas) {
    fallbackSidePartsApplied = await ensureFallbackSideParts(
      target.bagViewId,
      finalCanvas.width,
      finalCanvas.height,
      !!urls.side_loops, // forza ricreazione se l'utente ha caricato lo slot
    );
  }

  onProgress?.({
    step: 'Completato',
    current: filesToUpload.length,
    total: filesToUpload.length,
  });

  return {
    uploadedFiles: uploaded,
    zonesCreated,
    baseImageUpdated,
    handleMaskUploaded,
    rescaledHandlePath,
    fallbackSidePartsApplied,
    staleHandleOverlaysCleared,
  };
}

/** Legge canvas size attuale della view */
async function fetchViewCanvas(
  bagViewId: string,
): Promise<{ width: number; height: number } | null> {
  const { data } = await supabase
    .from('bag_views')
    .select('canvas_width, canvas_height')
    .eq('id', bagViewId)
    .maybeSingle();
  if (!data) return null;
  return { width: data.canvas_width, height: data.canvas_height };
}

/**
 * Garantisce che esistano side parts (left/right) compatibili col canvas.
 * - Se forceRecreate è true → cancella e ricrea da preset normalizzati.
 * - Altrimenti ricrea solo se quelli esistenti non sono compatibili.
 * Restituisce il numero di side parts ricreati.
 */
async function ensureFallbackSideParts(
  bagViewId: string,
  canvasWidth: number,
  canvasHeight: number,
  forceRecreate: boolean,
): Promise<number> {
  const { data: geo } = await supabase
    .from('handle_geometries')
    .select('id')
    .eq('bag_view_id', bagViewId)
    .maybeSingle();
  if (!geo) return 0;

  const { data: existing } = await supabase
    .from('handle_side_parts')
    .select('id, path_json')
    .eq('handle_geometry_id', geo.id);

  let needsRecreate = forceRecreate;
  if (!needsRecreate) {
    if (!existing || existing.length === 0) {
      // Nessun side part: non creiamo nulla in automatico (l'utente potrebbe
      // non volerli) — il fallback scatta solo se richiesto esplicitamente.
      return 0;
    }
    // Se anche uno solo è incompatibile col canvas → ricrea tutto
    for (const s of existing) {
      if (!arePointsCompatibleWithCanvas(s.path_json, canvasWidth, canvasHeight)) {
        needsRecreate = true;
        break;
      }
    }
  }

  if (!needsRecreate) return 0;

  // Cancella i vecchi side parts (asset compresi a livello di record)
  if (existing && existing.length > 0) {
    await supabase
      .from('handle_side_parts')
      .delete()
      .eq('handle_geometry_id', geo.id);
  }

  // Inserisci side parts da preset (mask/shadow/highlight = null)
  let inserted = 0;
  for (const preset of DEFAULT_SIDE_LOOP_PRESETS) {
    const pathJson = buildPathJsonFromPreset(preset, canvasWidth, canvasHeight);
    const { error } = await supabase.from('handle_side_parts').insert({
      handle_geometry_id: geo.id,
      part_id: preset.partId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      path_json: pathJson as any,
      rotation: preset.rotation,
      sort_order: preset.sortOrder,
      mask_url: null,
      shadow_url: null,
      highlight_url: null,
    });
    if (!error) inserted++;
  }
  return inserted;
}

// ─── Rescale helpers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scalePathJson(pathJson: any, sx: number, sy: number): any {
  if (!pathJson || typeof pathJson !== 'object') return pathJson;
  const sAvg = (sx + sy) / 2;
  const scalePoint = (p: unknown) => {
    if (!p || typeof p !== 'object') return p;
    const pt = p as Record<string, unknown>;
    const out: Record<string, unknown> = { ...pt };
    if (typeof pt.x === 'number') out.x = pt.x * sx;
    if (typeof pt.y === 'number') out.y = pt.y * sy;
    if (typeof pt.width === 'number') out.width = pt.width * sAvg;
    if (typeof pt.r === 'number') out.r = pt.r * sAvg;
    return out;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scalePath = (path: any) => {
    if (!path || typeof path !== 'object') return path;
    const out = { ...path };
    if (Array.isArray(path.points)) out.points = path.points.map(scalePoint);
    if (Array.isArray(path.skeleton)) out.skeleton = path.skeleton.map(scalePoint);
    if (typeof path.width === 'number') out.width = path.width * sAvg;
    return out;
  };
  const out = { ...pathJson };
  if (Array.isArray(pathJson.paths)) out.paths = pathJson.paths.map(scalePath);
  if (Array.isArray(pathJson.points)) out.points = pathJson.points.map(scalePoint);
  return out;
}

async function rescaleHandleAndPlacements(
  bagViewId: string,
  sx: number,
  sy: number,
): Promise<boolean> {
  const sAvg = (sx + sy) / 2;
  let didSomething = false;

  // handle_geometries
  const { data: geo } = await supabase
    .from('handle_geometries')
    .select('id, path_json, default_width')
    .eq('bag_view_id', bagViewId)
    .maybeSingle();
  if (geo) {
    const newPath = scalePathJson(geo.path_json, sx, sy);
    const newWidth = (geo.default_width ?? 50) * sAvg;
    const { error } = await supabase
      .from('handle_geometries')
      .update({ path_json: newPath, default_width: newWidth })
      .eq('id', geo.id);
    if (!error) didSomething = true;

    // handle_side_parts
    const { data: sides } = await supabase
      .from('handle_side_parts')
      .select('id, path_json')
      .eq('handle_geometry_id', geo.id);
    if (sides) {
      for (const s of sides) {
        const newSidePath = scalePathJson(s.path_json, sx, sy);
        await supabase
          .from('handle_side_parts')
          .update({ path_json: newSidePath })
          .eq('id', s.id);
      }
    }
  }

  // embroidery_placements
  const { data: placements } = await supabase
    .from('embroidery_placements')
    .select('id, position_x, position_y, max_width, max_height')
    .eq('bag_view_id', bagViewId);
  if (placements) {
    for (const p of placements) {
      await supabase
        .from('embroidery_placements')
        .update({
          position_x: p.position_x * sx,
          position_y: p.position_y * sy,
          max_width: p.max_width * sAvg,
          max_height: p.max_height * sAvg,
        })
        .eq('id', p.id);
    }
  }

  return didSomething;
}
