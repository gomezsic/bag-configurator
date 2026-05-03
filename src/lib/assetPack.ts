/**
 * assetPack
 *
 * Parser + validatore per Asset Pack di una bag view.
 * Accetta:
 *  - un file ZIP con la struttura model_slug/{original.png, body/, handle_geometry/, asset_manifest.json}
 *  - oppure un set di file individuali (drag-drop multiplo) con paths relativi
 *
 * Genera un AssetPackParseResult con:
 *  - manifest (se presente)
 *  - mappa file -> Blob
 *  - lista issue (error / warning)
 *  - dimensioni rilevate per ogni immagine
 *
 * Il commit (upload + DB) è separato: vedi commitAssetPack.
 */

import JSZip from 'jszip';
import type { HandlePathDocument } from '@/engine/handlePath';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export interface AssetManifest {
  modelSlug: string;
  modelName?: string;
  viewSlug: string;
  viewName?: string;
  canvasWidth: number;
  canvasHeight: number;
  originalImage?: string;
  body?: {
    zones?: Array<{
      id: string;
      name: string;
      mask: string;
      defaultScale?: number;
      defaultRotation?: number;
      defaultOffsetX?: number;
      defaultOffsetY?: number;
      sortOrder?: number;
    }>;
    overlays?: {
      shadows?: string;
      highlights?: string;
      details?: string;
    };
  };
  handleGeometry?: {
    id?: string;
    name?: string;
    mask?: string;
    path?: string;
    overlays?: {
      shadows?: string;
      highlights?: string;
      details?: string;
      hardware?: string;
    };
    sideParts?: Array<{
      id: string;             // 'side_loop_left' | 'side_loop_right' | ...
      mask: string;
      path?: string;          // mini handle_path.json (opzionale)
      shadows?: string;
      highlights?: string;
      rotation?: number;
    }>;
  };
  /** Handle pattern presets dichiarati inline (alternativa o aggiunta a handle_presets.json). */
  handlePresets?: Array<Record<string, unknown>>;
}

/** Mappa di alias legacy → nome canonico nuovo. Permette di importare ZIP vecchi. */
const FILE_ALIASES: Record<string, string> = {
  // Body masks (legacy → canonico)
  'body/mask_body_main.png': 'body/mask_body_front_main.png',
  'body/mask_body_left.png': 'body/mask_body_left_side.png',
  'body/mask_body_right.png': 'body/mask_body_right_side.png',
  'body/mask_body_top.png': 'body/mask_body_top_band.png',
  'body/mask_body_bottom.png': 'body/mask_body_bottom_fold.png',
  // Handle side parts (legacy short → canonical loop)
  'handle_geometry/mask_handle_side_left.png': 'handle_geometry/mask_handle_side_loop_left.png',
  'handle_geometry/mask_handle_side_right.png': 'handle_geometry/mask_handle_side_loop_right.png',
  // Side overlays generici legacy → side_loop_left specifico (best-effort, l'utente può comunque
  // dichiarare nel manifest gli overlay corretti per ogni parte)
};

/** Normalizza un path di file rispetto agli alias canonici. */
function normalizeFilePath(p: string): string {
  return FILE_ALIASES[p] ?? p;
}

/** Path che non devono partecipare ai check di dimensione (assets non vincolanti). */
function isNonBlockingAsset(p: string): boolean {
  return p.startsWith('previews/') || p.startsWith('references/');
}

/**
 * Validazione semantica di un singolo handle pattern preset.
 * Regole: name string non vuoto, stripes array di {color hex, width > 0},
 * stripeCount coerente, spacing array opzionale di numeri >= 0.
 */
function validatePreset(name: string, p: Record<string, unknown>): PackIssue[] {
  const out: PackIssue[] = [];
  const file = `handle_presets.json#${name}`;
  if (!name || typeof name !== 'string') {
    out.push({ level: 'error', file, message: 'Preset senza name valido' });
    return out;
  }
  const stripes = (p as { stripes?: unknown }).stripes;
  if (!Array.isArray(stripes) || stripes.length === 0) {
    out.push({ level: 'error', file, message: 'stripes deve essere un array non vuoto' });
    return out;
  }
  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  stripes.forEach((s, i) => {
    const obj = s as { color?: unknown; width?: unknown };
    if (typeof obj.color !== 'string' || !HEX.test(obj.color)) {
      out.push({ level: 'error', file, message: `stripes[${i}].color non è un hex valido` });
    }
    if (typeof obj.width !== 'number' || !(obj.width > 0)) {
      out.push({ level: 'error', file, message: `stripes[${i}].width deve essere > 0` });
    }
  });
  const declaredCount = (p as { stripeCount?: unknown }).stripeCount;
  if (typeof declaredCount === 'number' && declaredCount !== stripes.length) {
    out.push({
      level: 'warning',
      file,
      message: `stripeCount (${declaredCount}) ≠ stripes.length (${stripes.length})`,
    });
  }
  const spacing = (p as { spacing?: unknown }).spacing;
  if (spacing !== undefined) {
    if (!Array.isArray(spacing)) {
      out.push({ level: 'error', file, message: 'spacing deve essere un array di numeri' });
    } else {
      spacing.forEach((v, i) => {
        if (typeof v !== 'number' || v < 0) {
          out.push({ level: 'error', file, message: `spacing[${i}] deve essere un numero >= 0` });
        }
      });
    }
  }
  return out;
}


export type IssueLevel = 'error' | 'warning' | 'info';

export interface PackIssue {
  level: IssueLevel;
  message: string;
  file?: string;
}

export interface ImageDimension {
  width: number;
  height: number;
}

export interface AssetPackParseResult {
  manifest: AssetManifest | null;
  /** Tutti i file rilevati, mappati per path relativo dentro il pack (con alias normalizzati) */
  files: Map<string, Blob>;
  /** Dimensioni rilevate per ogni immagine */
  imageDims: Map<string, ImageDimension>;
  /** Documento centerline parsato (se presente) */
  pathDoc: HandlePathDocument | null;
  /** Preset manico globali rilevati (da handle_presets.json + manifest.handlePresets) */
  presetsToImport: Array<Record<string, unknown>>;
  /** Esiti */
  issues: PackIssue[];
  /** True se non ci sono issue di livello 'error' */
  isValid: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readImageDimensions(blob: Blob): Promise<ImageDimension> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image decode failed'));
    };
    img.src = url;
  });
}

async function readBlobAsText(blob: Blob): Promise<string> {
  return await blob.text();
}

/** Strippa un eventuale prefisso comune (es. "qg_duffle/") dai path */
function stripCommonPrefix(paths: string[]): string {
  if (!paths.length) return '';
  const segments = paths.map((p) => p.split('/'));
  if (segments[0].length < 2) return '';
  const candidate = segments[0][0];
  for (const s of segments) {
    if (s[0] !== candidate) return '';
  }
  return candidate + '/';
}

// ─── Parser principale ────────────────────────────────────────────────────────

export async function parseAssetPackFromZip(zipFile: File): Promise<AssetPackParseResult> {
  const issues: PackIssue[] = [];
  const files = new Map<string, Blob>();
  const imageDims = new Map<string, ImageDimension>();

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipFile);
  } catch (e) {
    return {
      manifest: null,
      files,
      imageDims,
      pathDoc: null,
      presetsToImport: [],
      issues: [{ level: 'error', message: `ZIP non leggibile: ${(e as Error).message}` }],
      isValid: false,
    };
  }

  // Estrai tutti i file (ignorando directory + file di sistema)
  const entries = Object.values(zip.files).filter(
    (e) => !e.dir && !e.name.startsWith('__MACOSX') && !e.name.endsWith('/.DS_Store'),
  );
  const allPaths = entries.map((e) => e.name);
  const prefix = stripCommonPrefix(allPaths);

  for (const entry of entries) {
    const blob = await entry.async('blob');
    const relPath = entry.name.startsWith(prefix) ? entry.name.slice(prefix.length) : entry.name;
    if (!relPath) continue;
    files.set(normalizeFilePath(relPath), blob);
  }

  return finalize(files, issues, imageDims);
}

export async function parseAssetPackFromFiles(
  fileList: FileList | File[],
): Promise<AssetPackParseResult> {
  const issues: PackIssue[] = [];
  const files = new Map<string, Blob>();
  const imageDims = new Map<string, ImageDimension>();

  const arr = Array.from(fileList);
  // webkitRelativePath se viene da <input webkitdirectory>
  const allPaths = arr.map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
  const prefix = stripCommonPrefix(allPaths);

  arr.forEach((f, i) => {
    const rel = allPaths[i];
    const final = rel.startsWith(prefix) ? rel.slice(prefix.length) : rel;
    files.set(normalizeFilePath(final), f);
  });

  return finalize(files, issues, imageDims);
}

async function finalize(
  files: Map<string, Blob>,
  issues: PackIssue[],
  imageDims: Map<string, ImageDimension>,
): Promise<AssetPackParseResult> {
  // Manifest
  let manifest: AssetManifest | null = null;
  const manifestBlob = files.get('asset_manifest.json');
  if (manifestBlob) {
    try {
      manifest = JSON.parse(await readBlobAsText(manifestBlob)) as AssetManifest;
    } catch (e) {
      issues.push({
        level: 'error',
        file: 'asset_manifest.json',
        message: `JSON non parsabile: ${(e as Error).message}`,
      });
    }
  } else {
    issues.push({
      level: 'warning',
      message: 'asset_manifest.json mancante: il pack verrà importato come "manuale" senza creazione automatica DB.',
    });
  }

  // Path doc (handle centerline) — validazione strutturale stretta
  let pathDoc: HandlePathDocument | null = null;
  const pathBlob = files.get('handle_geometry/handle_path.json');
  if (pathBlob) {
    let parsedPath: unknown = null;
    try {
      parsedPath = JSON.parse(await readBlobAsText(pathBlob));
    } catch (e) {
      issues.push({
        level: 'error',
        file: 'handle_geometry/handle_path.json',
        message: `handle_path.json non parsabile: ${(e as Error).message}`,
      });
    }
    if (parsedPath && typeof parsedPath === 'object' && !Array.isArray(parsedPath)) {
      const obj = parsedPath as Record<string, unknown>;
      const okCanvas =
        typeof obj.canvasWidth === 'number' && typeof obj.canvasHeight === 'number';
      const okPaths = Array.isArray(obj.paths);
      if (!okCanvas) {
        issues.push({
          level: 'error',
          file: 'handle_geometry/handle_path.json',
          message: 'campi canvasWidth/canvasHeight numerici richiesti',
        });
      }
      if (!okPaths) {
        issues.push({
          level: 'error',
          file: 'handle_geometry/handle_path.json',
          message: 'campo paths[] richiesto',
        });
      }
      if (okCanvas && okPaths) {
        pathDoc = parsedPath as HandlePathDocument;
      }
    } else if (parsedPath !== null) {
      issues.push({
        level: 'error',
        file: 'handle_geometry/handle_path.json',
        message: 'deve essere un oggetto JSON',
      });
    }
  }

  // Handle presets globali — file 'handle_presets.json' (array) + manifest.handlePresets[]
  // Convergono in un'unica lista deduplicata per nome.
  const presetsByName = new Map<string, Record<string, unknown>>();
  const presetsBlob = files.get('handle_presets.json');
  if (presetsBlob) {
    try {
      const parsed = JSON.parse(await readBlobAsText(presetsBlob));
      if (Array.isArray(parsed)) {
        for (const p of parsed as Array<Record<string, unknown>>) {
          if (p?.name && typeof p.name === 'string') presetsByName.set(p.name, p);
        }
      } else {
        issues.push({
          level: 'warning',
          file: 'handle_presets.json',
          message: 'handle_presets.json deve essere un array di preset; ignorato.',
        });
      }
    } catch (e) {
      issues.push({
        level: 'error',
        file: 'handle_presets.json',
        message: `handle_presets.json non parsabile: ${(e as Error).message}`,
      });
    }
  } else {
    // Strongly recommended ma non bloccante
    issues.push({
      level: 'warning',
      message: 'handle_presets.json non presente: i preset manico non verranno aggiornati globalmente.',
    });
  }
  if (Array.isArray(manifest?.handlePresets)) {
    for (const p of manifest!.handlePresets!) {
      if (p?.name && typeof p.name === 'string') presetsByName.set(p.name as string, p);
    }
  }
  // Valida ogni preset; quelli invalidi vengono scartati con warning.
  const presetsToImport: Array<Record<string, unknown>> = [];
  for (const [name, p] of presetsByName.entries()) {
    const presetIssues = validatePreset(name, p);
    if (presetIssues.some((i) => i.level === 'error')) {
      issues.push(...presetIssues);
      issues.push({
        level: 'warning',
        message: `Preset "${name}" scartato per errori di validazione.`,
      });
      continue;
    }
    issues.push(...presetIssues);
    presetsToImport.push(p);
  }

  // Misura dimensioni di ogni immagine
  for (const [path, blob] of files.entries()) {
    if (!/\.(png|jpe?g|webp)$/i.test(path)) continue;
    try {
      const dims = await readImageDimensions(blob);
      imageDims.set(path, dims);
    } catch {
      issues.push({ level: 'error', file: path, message: 'Immagine non decodificabile' });
    }
  }

  // ─── Regole di validazione ─────────────────────────────────────────────────

  const has = (p: string) => files.has(p);

  // 1. original.png richiesto
  if (!has('original.png')) {
    issues.push({ level: 'error', file: 'original.png', message: 'File required mancante' });
  }

  // 2. almeno una mask body o handle geometry
  const hasAnyBodyMask = Array.from(files.keys()).some((p) =>
    p.startsWith('body/mask_'),
  );
  const hasHandleMask = has('handle_geometry/mask_handle_main_full.png');
  if (!hasAnyBodyMask && !hasHandleMask) {
    issues.push({
      level: 'error',
      message: 'Nessuna mask trovata: serve almeno una mask body o un mask manico.',
    });
  }

  // 3. se manifest dichiara handleGeometry, verifica file richiesti
  if (manifest?.handleGeometry) {
    const hg = manifest.handleGeometry;
    if (hg.mask && !has(hg.mask)) {
      issues.push({ level: 'error', file: hg.mask, message: 'Mask manico dichiarata nel manifest ma non trovata' });
    }
    if (hg.path && !has(hg.path)) {
      issues.push({ level: 'error', file: hg.path, message: 'handle_path.json dichiarato ma non trovato' });
    }
    // Side parts dichiarati nel manifest devono esistere
    for (const sp of hg.sideParts ?? []) {
      if (!sp.mask || !has(sp.mask)) {
        issues.push({
          level: 'error',
          file: sp.mask ?? `sideParts/${sp.id}`,
          message: `Side part "${sp.id}": mask dichiarata ma non trovata`,
        });
      }
      if (sp.path && !has(sp.path)) {
        issues.push({
          level: 'warning',
          file: sp.path,
          message: `Side part "${sp.id}": path dichiarato ma non trovato (verrà usato bbox-fallback)`,
        });
      }
      for (const ov of [sp.shadows, sp.highlights]) {
        if (ov && !has(ov)) {
          issues.push({
            level: 'warning',
            file: ov,
            message: `Side part "${sp.id}": overlay dichiarato ma non trovato`,
          });
        }
      }
    }
  } else if (hasHandleMask && !pathDoc) {
    issues.push({
      level: 'warning',
      message: 'mask_handle_main_full.png presente ma handle_path.json mancante: il manico non sarà renderizzabile a strisce.',
    });
  }

  // 4. tutte le immagini devono avere stesse dimensioni (= original)
  //    previews/ e references/ NON partecipano: sono asset informativi.
  const originalDims = imageDims.get('original.png');
  if (originalDims) {
    for (const [path, dims] of imageDims.entries()) {
      if (path === 'original.png') continue;
      if (isNonBlockingAsset(path)) continue;
      if (dims.width !== originalDims.width || dims.height !== originalDims.height) {
        issues.push({
          level: 'error',
          file: path,
          message: `Dimensioni diverse da original.png (${dims.width}×${dims.height} vs ${originalDims.width}×${originalDims.height})`,
        });
      }
    }
  }

  // 5. canvas del manifest deve combaciare con original.png
  if (manifest && originalDims) {
    if (manifest.canvasWidth !== originalDims.width || manifest.canvasHeight !== originalDims.height) {
      issues.push({
        level: 'error',
        file: 'asset_manifest.json',
        message: `canvasWidth/Height (${manifest.canvasWidth}×${manifest.canvasHeight}) ≠ original.png (${originalDims.width}×${originalDims.height})`,
      });
    }
  }

  // 6. canvas del path doc deve combaciare con original.png
  if (pathDoc && originalDims) {
    if (pathDoc.canvasWidth !== originalDims.width || pathDoc.canvasHeight !== originalDims.height) {
      issues.push({
        level: 'error',
        file: 'handle_geometry/handle_path.json',
        message: `Canvas (${pathDoc.canvasWidth}×${pathDoc.canvasHeight}) ≠ original.png (${originalDims.width}×${originalDims.height})`,
      });
    }
    pathDoc.paths.forEach((p, idx) => {
      if (p.points.length < 2) {
        issues.push({
          level: 'error',
          file: 'handle_geometry/handle_path.json',
          message: `Path "${p.id || idx}" ha meno di 2 punti`,
        });
      }
      p.points.forEach((pt, j) => {
        if (pt.width <= 0) {
          issues.push({
            level: 'error',
            file: 'handle_geometry/handle_path.json',
            message: `Path "${p.id || idx}" punto #${j + 1}: width <= 0`,
          });
        }
        if (
          pt.x < 0 ||
          pt.y < 0 ||
          (originalDims && (pt.x > originalDims.width || pt.y > originalDims.height))
        ) {
          issues.push({
            level: 'warning',
            file: 'handle_geometry/handle_path.json',
            message: `Path "${p.id || idx}" punto #${j + 1}: fuori canvas`,
          });
        }
      });
    });
  }

  const isValid = !issues.some((i) => i.level === 'error');
  return { manifest, files, imageDims, pathDoc, presetsToImport, issues, isValid };
}

// ─── Commit ───────────────────────────────────────────────────────────────────

import { supabase } from '@/integrations/supabase/client';

export interface CommitProgress {
  step: string;
  current: number;
  total: number;
}

export interface CommitResult {
  bagModelId: string;
  bagModelSlug: string;
  bagViewId: string;
  bagViewSlug: string;
  uploadedFiles: number;
  zonesCreated: number;
  handleGeometryCreated: boolean;
  sidePartsCreated: number;
  presetsImported: number;
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

/**
 * Commit del pack: crea/aggiorna bag_model, bag_view, mask_zones (body),
 * handle_geometries. Richiede manifest valido + file required presenti.
 *
 * Se viene fornito `target` (bagModelId e/o bagViewId), il commit ignora
 * modelSlug/viewSlug del manifest e forza l'import sulla borsa/vista
 * specificata. Utile quando l'utente apre "Carica file" già dentro la
 * pagina di una borsa specifica.
 */
export async function commitAssetPack(
  result: AssetPackParseResult,
  onProgress?: (p: CommitProgress) => void,
  target?: { bagModelId?: string; bagViewId?: string },
): Promise<CommitResult> {
  if (!result.isValid) throw new Error('Pack non valido: risolvi gli errori prima di importare');
  if (!result.manifest) throw new Error('Manca asset_manifest.json: import automatico non possibile');

  const m = result.manifest;
  const slug = m.modelSlug.toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
  const viewSlug = m.viewSlug.toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
  const stamp = Date.now();
  const baseFolder = `packs/${slug}/${viewSlug}-${stamp}`;

  // Upload originale + raccolta URL
  const filesToUpload: Array<{ key: string; storagePath: string }> = [];
  for (const [relPath] of result.files) {
    if (!/\.(png|jpe?g|webp|json)$/i.test(relPath)) continue;
    filesToUpload.push({ key: relPath, storagePath: `${baseFolder}/${relPath}` });
  }

  const urls = new Map<string, string>();
  let uploaded = 0;
  for (const { key, storagePath } of filesToUpload) {
    onProgress?.({ step: `Upload ${key}`, current: uploaded, total: filesToUpload.length });
    const blob = result.files.get(key)!;
    const ct = key.endsWith('.json')
      ? 'application/json'
      : key.endsWith('.jpg') || key.endsWith('.jpeg')
        ? 'image/jpeg'
        : key.endsWith('.webp')
          ? 'image/webp'
          : 'image/png';
    const url = await uploadBlob(blob, storagePath, ct);
    urls.set(key, url);
    uploaded++;
  }

  onProgress?.({ step: 'Salvataggio bag model', current: uploaded, total: filesToUpload.length });

  // Upsert bag_model — se è stato passato un target.bagModelId lo usiamo
  // direttamente, ignorando lo slug del manifest.
  let bagModelId: string;
  let bagModelSlug = slug;
  if (target?.bagModelId) {
    const { data: targetModel, error: targetErr } = await supabase
      .from('bag_models')
      .select('id, slug')
      .eq('id', target.bagModelId)
      .maybeSingle();
    if (targetErr || !targetModel) {
      throw new Error('Borsa target non trovata: verifica il bagModelId fornito');
    }
    bagModelId = targetModel.id;
    bagModelSlug = targetModel.slug;
  } else {
    const { data: existingModel } = await supabase
      .from('bag_models')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingModel) {
      bagModelId = existingModel.id;
      if (m.modelName) {
        await supabase.from('bag_models').update({ name: m.modelName }).eq('id', bagModelId);
      }
    } else {
      const { data, error } = await supabase
        .from('bag_models')
        .insert({ slug, name: m.modelName ?? slug })
        .select('id')
        .single();
      if (error) throw error;
      bagModelId = data.id;
    }
  }

  // Upsert bag_view — se è stato passato un target.bagViewId lo usiamo
  // direttamente, altrimenti match per (model + view_type=viewSlug).
  let bagViewId: string;
  let bagViewSlug = viewSlug;
  let existingView: { id: string } | null = null;

  if (target?.bagViewId) {
    const { data: targetView, error: targetErr } = await supabase
      .from('bag_views')
      .select('id, view_type, bag_model_id')
      .eq('id', target.bagViewId)
      .maybeSingle();
    if (targetErr || !targetView) {
      throw new Error('Vista target non trovata: verifica il bagViewId fornito');
    }
    if (targetView.bag_model_id !== bagModelId) {
      throw new Error('La vista target non appartiene alla borsa target');
    }
    existingView = { id: targetView.id };
    bagViewSlug = targetView.view_type;
  } else {
    const { data } = await supabase
      .from('bag_views')
      .select('id')
      .eq('bag_model_id', bagModelId)
      .eq('view_type', viewSlug)
      .maybeSingle();
    existingView = data ?? null;
  }

  const viewPayload = {
    bag_model_id: bagModelId,
    view_type: bagViewSlug,
    custom_label: m.viewName ?? bagViewSlug,
    canvas_width: m.canvasWidth,
    canvas_height: m.canvasHeight,
    base_image_url: urls.get(m.originalImage ?? 'original.png') ?? null,
    overlay_shadows_url: urls.get(m.body?.overlays?.shadows ?? '') ?? null,
    overlay_highlights_url: urls.get(m.body?.overlays?.highlights ?? '') ?? null,
    overlay_details_url: urls.get(m.body?.overlays?.details ?? '') ?? null,
  };

  if (existingView) {
    bagViewId = existingView.id;
    await supabase.from('bag_views').update(viewPayload).eq('id', bagViewId);
  } else {
    const { data, error } = await supabase
      .from('bag_views')
      .insert(viewPayload)
      .select('id')
      .single();
    if (error) throw error;
    bagViewId = data.id;
  }

  // Mask zones (body)
  let zonesCreated = 0;
  const zones = m.body?.zones ?? [];
  // Cancella le mask_zones body precedenti per coerenza
  if (zones.length > 0) {
    await supabase.from('mask_zones').delete().eq('bag_view_id', bagViewId).eq('zone_category', 'fabric');
  }
  for (const z of zones) {
    const url = urls.get(z.mask);
    if (!url) continue;
    const { error } = await supabase.from('mask_zones').insert({
      bag_view_id: bagViewId,
      zone_type: z.id,
      zone_category: 'fabric',
      label: z.name,
      mask_image_url: url,
      texture_scale: z.defaultScale ?? 1,
      texture_rotation: z.defaultRotation ?? 0,
      texture_offset_x: z.defaultOffsetX ?? 0,
      texture_offset_y: z.defaultOffsetY ?? 0,
      sort_order: z.sortOrder ?? 0,
    });
    if (!error) zonesCreated++;
  }

  // Handle geometry
  let handleGeometryCreated = false;
  let handleGeometryId: string | null = null;
  const hg = m.handleGeometry;
  if (hg?.mask) {
    const maskUrl = urls.get(hg.mask);
    const pathRaw = hg.path ? result.files.get(hg.path) : null;
    let pathJson: HandlePathDocument | null = result.pathDoc;
    if (pathRaw && !pathJson) {
      try {
        pathJson = JSON.parse(await pathRaw.text()) as HandlePathDocument;
      } catch {
        /* ignore */
      }
    }

    const geoPayload = {
      bag_view_id: bagViewId,
      mask_url: maskUrl ?? null,
      path_json: (pathJson ?? { paths: [] }) as unknown as Parameters<typeof supabase.from>[0] extends never ? never : object,
      shadow_url: urls.get(hg.overlays?.shadows ?? '') ?? null,
      highlight_url: urls.get(hg.overlays?.highlights ?? '') ?? null,
      details_url: urls.get(hg.overlays?.details ?? '') ?? null,
      hardware_url: urls.get(hg.overlays?.hardware ?? '') ?? null,
    };

    const { data: existingGeo } = await supabase
      .from('handle_geometries')
      .select('id')
      .eq('bag_view_id', bagViewId)
      .maybeSingle();

    if (existingGeo) {
      handleGeometryId = existingGeo.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('handle_geometries').update(geoPayload as any).eq('id', handleGeometryId);
    } else {
      const { data: newGeo, error: insErr } = await supabase
        .from('handle_geometries')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(geoPayload as any)
        .select('id')
        .single();
      if (insErr) throw insErr;
      handleGeometryId = newGeo.id;
    }
    handleGeometryCreated = true;
  }

  // Handle side parts (fettuccine laterali) — auto-detect anche senza manifest
  let sidePartsCreated = 0;
  if (handleGeometryId) {
    type SidePartSpec = {
      partId: string;
      maskKey: string;
      pathKey?: string;
      shadowKey?: string;
      highlightKey?: string;
      rotation: number;
    };

    const declared: SidePartSpec[] = (hg?.sideParts ?? []).map((sp) => ({
      partId: sp.id,
      maskKey: sp.mask,
      pathKey: sp.path,
      shadowKey: sp.shadows,
      highlightKey: sp.highlights,
      rotation: sp.rotation ?? 0,
    }));

    // Auto-detect by naming convention se non dichiarate.
    // Nomi canonici nuovi: side_loop_left / side_loop_right + overlay specifici per parte.
    // Gli alias legacy (mask_handle_side_left.png) sono già normalizzati a side_loop_*.
    const conventionParts: Array<{
      partId: string;
      maskKey: string;
      shadowKey: string;
      highlightKey: string;
    }> = [
      {
        partId: 'side_loop_left',
        maskKey: 'handle_geometry/mask_handle_side_loop_left.png',
        shadowKey: 'handle_geometry/overlay_handle_side_loop_left_shadows_multiply.png',
        highlightKey: 'handle_geometry/overlay_handle_side_loop_left_highlights_screen.png',
      },
      {
        partId: 'side_loop_right',
        maskKey: 'handle_geometry/mask_handle_side_loop_right.png',
        shadowKey: 'handle_geometry/overlay_handle_side_loop_right_shadows_multiply.png',
        highlightKey: 'handle_geometry/overlay_handle_side_loop_right_highlights_screen.png',
      },
    ];
    for (const cp of conventionParts) {
      if (declared.some((d) => d.partId === cp.partId)) continue;
      if (!result.files.has(cp.maskKey)) continue;
      // Fallback overlay generici se i specifici non esistono
      const fallbackShadow = 'handle_geometry/overlay_handle_side_shadows_multiply.png';
      const fallbackHighlight = 'handle_geometry/overlay_handle_side_highlights_screen.png';
      declared.push({
        partId: cp.partId,
        maskKey: cp.maskKey,
        pathKey: `handle_geometry/path_handle_${cp.partId}.json`,
        shadowKey: result.files.has(cp.shadowKey)
          ? cp.shadowKey
          : result.files.has(fallbackShadow)
            ? fallbackShadow
            : undefined,
        highlightKey: result.files.has(cp.highlightKey)
          ? cp.highlightKey
          : result.files.has(fallbackHighlight)
            ? fallbackHighlight
            : undefined,
        rotation: 0,
      });
    }

    if (declared.length > 0) {
      // Pulisci side parts precedenti per coerenza
      await supabase
        .from('handle_side_parts')
        .delete()
        .eq('handle_geometry_id', handleGeometryId);

      for (let i = 0; i < declared.length; i++) {
        const sp = declared[i];
        const maskUrl = urls.get(sp.maskKey);
        if (!maskUrl) continue;

        let pathJson: HandlePathDocument | null = null;
        if (sp.pathKey && result.files.has(sp.pathKey)) {
          try {
            pathJson = JSON.parse(await result.files.get(sp.pathKey)!.text()) as HandlePathDocument;
          } catch {
            /* fallback to empty path; renderer userà bbox-fallback */
          }
        }

        const { error: spErr } = await supabase.from('handle_side_parts').insert({
          handle_geometry_id: handleGeometryId,
          part_id: sp.partId,
          mask_url: maskUrl,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          path_json: (pathJson ?? { paths: [] }) as any,
          shadow_url: sp.shadowKey ? urls.get(sp.shadowKey) ?? null : null,
          highlight_url: sp.highlightKey ? urls.get(sp.highlightKey) ?? null : null,
          rotation: sp.rotation,
          sort_order: i,
        });
        if (!spErr) sidePartsCreated++;
      }
    }
  }

  // Handle pattern presets globali — upsert per name
  let presetsImported = 0;
  if (result.presetsToImport.length > 0) {
    onProgress?.({ step: 'Import preset manico', current: uploaded, total: filesToUpload.length });
    for (const p of result.presetsToImport) {
      const name = p.name as string;
      const stripeCount =
        (p.stripeCount as number | undefined) ??
        (Array.isArray((p as { stripes?: unknown[] }).stripes)
          ? ((p as { stripes: unknown[] }).stripes.length)
          : 0);

      const { data: existing } = await supabase
        .from('handle_pattern_presets')
        .select('id')
        .eq('name', name)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('handle_pattern_presets')
          .update({
            stripe_count: stripeCount,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            preset_json: p as any,
          })
          .eq('id', existing.id);
        if (!error) presetsImported++;
      } else {
        const { error } = await supabase.from('handle_pattern_presets').insert({
          name,
          stripe_count: stripeCount,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          preset_json: p as any,
        });
        if (!error) presetsImported++;
      }
    }
  }

  onProgress?.({ step: 'Completato', current: filesToUpload.length, total: filesToUpload.length });

  return {
    bagModelId,
    bagModelSlug,
    bagViewId,
    bagViewSlug,
    uploadedFiles: uploaded,
    zonesCreated,
    handleGeometryCreated,
    sidePartsCreated,
    presetsImported,
  };
}
