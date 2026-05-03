/**
 * AdminUpload — pagina unica per import borsa configurabile.
 *
 * Flusso:
 *  1. Dropzone "Carica ZIP" (oppure cartella)
 *  2. Analisi automatica: manifest, body masks, handle geometry, side loops, preset manico
 *  3. Report leggibile (cosa è stato rilevato, errori, warning)
 *  4. Bottone "Importa tutto" → upsert idempotente (modelSlug + viewSlug)
 *  5. Azioni finali: vai alla borsa, anteprima configuratore, preset manici
 *
 * Sostituisce il vecchio AdminAssetPackUpload con un'esperienza più semplice e
 * con il supporto ai nomi canonici nuovi (mask_handle_side_loop_left/right + overlay
 * per parte) e ai preset manico globali (handle_presets.json + manifest.handlePresets).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Upload,
  FileArchive,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  Info,
  Trash2,
  Play,
  ArrowRight,
  Eye,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  parseAssetPackFromZip,
  parseAssetPackFromFiles,
  commitAssetPack,
  type AssetPackParseResult,
  type CommitProgress,
  type CommitResult,
} from '@/lib/assetPack';
import MaskSlotUploader from '@/components/admin/MaskSlotUploader';
import HandleAlignmentPreview from '@/components/admin/HandleAlignmentPreview';
import { supabase } from '@/integrations/supabase/client';

interface DefaultTarget {
  bagModelId: string;
  bagViewId: string;
  bagModelSlug: string;
  bagViewSlug: string;
  bagModelName: string;
  bagViewName: string;
}

const AdminUpload: React.FC = () => {
  const [searchParams] = useSearchParams();
  const targetBagModelId = searchParams.get('bagModelId') || undefined;
  const targetBagViewId = searchParams.get('bagViewId') || undefined;
  const targetBagModelName = searchParams.get('bagModelName') || undefined;
  const targetBagViewName = searchParams.get('bagViewName') || undefined;
  const hasTarget = !!(targetBagModelId || targetBagViewId);

  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<AssetPackParseResult | null>(null);
  const [progress, setProgress] = useState<CommitProgress | null>(null);
  const [commitDone, setCommitDone] = useState<CommitResult | null>(null);
  const [drag, setDrag] = useState(false);

  // Target risolto per il nuovo uploader a slot (carica la borsa selezionata,
  // o – in mancanza – la prima borsa+vista disponibile come default).
  const [resolvedTarget, setResolvedTarget] = useState<DefaultTarget | null>(null);
  const [resolvingTarget, setResolvingTarget] = useState(true);

  // Timestamp dell'ultimo import via slot uploader: usato come refreshKey per
  // forzare il ricaricamento dell'anteprima allineamento e dei suoi asset.
  const [lastSlotImportAt, setLastSlotImportAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setResolvingTarget(true);
      try {
        let modelId = targetBagModelId;
        let viewId = targetBagViewId;

        // Se non c'è target nei searchParams, prendiamo la prima borsa+vista
        if (!modelId) {
          const { data: m } = await supabase
            .from('bag_models')
            .select('id')
            .eq('is_active', true)
            .order('sort_order')
            .limit(1)
            .maybeSingle();
          if (m) modelId = m.id;
        }
        if (!modelId) return;

        if (!viewId) {
          const { data: v } = await supabase
            .from('bag_views')
            .select('id')
            .eq('bag_model_id', modelId)
            .eq('is_active', true)
            .order('sort_order')
            .limit(1)
            .maybeSingle();
          if (v) viewId = v.id;
        }
        if (!viewId) return;

        const [{ data: model }, { data: view }] = await Promise.all([
          supabase.from('bag_models').select('id, name, slug').eq('id', modelId).maybeSingle(),
          supabase
            .from('bag_views')
            .select('id, view_type, custom_label')
            .eq('id', viewId)
            .maybeSingle(),
        ]);
        if (cancelled || !model || !view) return;
        setResolvedTarget({
          bagModelId: model.id,
          bagViewId: view.id,
          bagModelSlug: model.slug,
          bagViewSlug: view.view_type,
          bagModelName: model.name,
          bagViewName: view.custom_label ?? view.view_type,
        });
      } finally {
        if (!cancelled) setResolvingTarget(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetBagModelId, targetBagViewId]);

  const reset = useCallback(() => {
    setResult(null);
    setProgress(null);
    setCommitDone(null);
  }, []);

  const handleZip = useCallback(
    async (file: File) => {
      reset();
      setParsing(true);
      try {
        const r = await parseAssetPackFromZip(file);
        setResult(r);
        if (r.isValid) toast.success(`Pack analizzato: ${r.files.size} file pronti`);
        else
          toast.error(
            `Trovati ${r.issues.filter((i) => i.level === 'error').length} errori da risolvere`,
          );
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setParsing(false);
      }
    },
    [reset],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      reset();
      setParsing(true);
      try {
        const r = await parseAssetPackFromFiles(files);
        setResult(r);
        if (r.isValid) toast.success(`Pack analizzato: ${r.files.size} file pronti`);
        else
          toast.error(
            `Trovati ${r.issues.filter((i) => i.level === 'error').length} errori da risolvere`,
          );
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setParsing(false);
      }
    },
    [reset],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const files = Array.from(e.dataTransfer.files);
      if (!files.length) return;
      const single = files.length === 1 && files[0].name.toLowerCase().endsWith('.zip');
      if (single) handleZip(files[0]);
      else handleFiles(files);
    },
    [handleZip, handleFiles],
  );

  const onCommit = useCallback(async () => {
    if (!result || !result.isValid || !result.manifest) return;
    setCommitting(true);
    setProgress(null);
    setCommitDone(null);
    try {
      const target =
        targetBagModelId || targetBagViewId
          ? { bagModelId: targetBagModelId, bagViewId: targetBagViewId }
          : undefined;
      const r = await commitAssetPack(result, setProgress, target);
      setCommitDone(r);
      toast.success(
        `Importato: ${r.uploadedFiles} file, ${r.zonesCreated} zone, ${r.sidePartsCreated} fettuccine, ${r.presetsImported} preset`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCommitting(false);
    }
  }, [result, targetBagModelId, targetBagViewId]);

  const errors = result?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = result?.issues.filter((i) => i.level === 'warning') ?? [];

  // Riepilogo "intelligente" del contenuto rilevato
  const summary = useMemo(() => {
    if (!result) return null;
    const m = result.manifest;
    const has = (p: string) => result.files.has(p);
    const bodyZones = m?.body?.zones?.length ?? 0;
    const bodyOverlays = [
      m?.body?.overlays?.shadows,
      m?.body?.overlays?.highlights,
      m?.body?.overlays?.details,
    ].filter(Boolean).length;
    const handleMain = !!m?.handleGeometry?.mask || has('handle_geometry/mask_handle_main_full.png');
    const handlePath =
      !!m?.handleGeometry?.path || has('handle_geometry/handle_path.json');
    const sideLeft = has('handle_geometry/mask_handle_side_loop_left.png');
    const sideRight = has('handle_geometry/mask_handle_side_loop_right.png');
    return {
      bagDetected: !!m,
      modelName: m?.modelName ?? m?.modelSlug ?? '—',
      modelSlug: m?.modelSlug ?? '—',
      viewName: m?.viewName ?? m?.viewSlug ?? '—',
      viewSlug: m?.viewSlug ?? '—',
      canvas: m ? `${m.canvasWidth}×${m.canvasHeight}` : '—',
      bodyZones,
      bodyOverlays,
      handleMain,
      handlePath,
      sideLeft,
      sideRight,
      sideLoopsCount: (sideLeft ? 1 : 0) + (sideRight ? 1 : 0),
      presetsCount: result.presetsToImport.length,
    };
  }, [result]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Carica File</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Due modalità di import: <strong>Maschere autoritative</strong> (consigliata, 7
          slot fissi con auto-riconoscimento dal nome) o <strong>ZIP completo</strong>{' '}
          (modalità legacy con manifest, struttura cartelle, preset manici).
        </p>
      </div>

      {/* Banner target: import vincolato a una borsa specifica */}
      {hasTarget && (
        <div className="border border-primary/40 bg-primary/5 rounded-lg p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Import vincolato a:{' '}
              <span className="font-semibold">
                {targetBagModelName ?? 'borsa selezionata'}
              </span>
              {targetBagViewName && (
                <>
                  {' '}·{' '}
                  <span className="font-semibold">{targetBagViewName}</span>
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              I file dello ZIP verranno applicati a questa borsa, ignorando{' '}
              <code>modelSlug</code>/<code>viewSlug</code> del manifest.
            </p>
          </div>
          <Button asChild size="sm" variant="ghost" className="shrink-0">
            <Link to="/admin/upload">Rimuovi vincolo</Link>
          </Button>
        </div>
      )}

      <Tabs defaultValue="slots" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="slots" className="gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" /> Maschere autoritative
          </TabsTrigger>
          <TabsTrigger value="zip" className="gap-1.5">
            <FileArchive className="h-3.5 w-3.5" /> ZIP completo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="slots" className="space-y-4 mt-4">
          {resolvingTarget && (
            <p className="text-xs text-muted-foreground">Caricamento borsa target…</p>
          )}
          {!resolvingTarget && !resolvedTarget && (
            <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4 text-sm text-foreground">
              Nessuna borsa+vista trovata nel database. Crea prima un modello e una vista
              dalle pagine{' '}
              <Link to="/admin/models" className="underline">
                Modelli
              </Link>
              .
            </div>
          )}
          {resolvedTarget && (
            <>
              <div className="border border-primary/40 bg-primary/5 rounded-lg p-3 flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-primary shrink-0" />
                <span className="text-foreground">
                  Le maschere verranno applicate a:{' '}
                  <strong>{resolvedTarget.bagModelName}</strong> ·{' '}
                  <strong>{resolvedTarget.bagViewName}</strong>
                </span>
              </div>
              <MaskSlotUploader
                target={resolvedTarget}
                onCompleted={() => setLastSlotImportAt(Date.now())}
              />
              <HandleAlignmentPreview
                bagModelId={resolvedTarget.bagModelId}
                bagViewId={resolvedTarget.bagViewId}
                viewType={resolvedTarget.bagViewSlug}
                refreshKey={lastSlotImportAt ?? undefined}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="zip" className="space-y-4 mt-4">
          {/* Dropzone (nascosto a import completato) */}
          {!commitDone && (
            <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            drag ? 'border-primary bg-primary/5' : 'border-border bg-card'
          }`}
        >
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-base text-foreground font-medium">
            Trascina qui il file .zip della borsa
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            oppure scegli manualmente
          </p>
          <div className="flex gap-2 justify-center mt-4">
            <label>
              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleZip(e.target.files[0])}
              />
              <Button type="button" size="sm" variant="outline" asChild>
                <span className="cursor-pointer">
                  <FileArchive className="h-4 w-4 mr-1" /> Scegli .zip
                </span>
              </Button>
            </label>
            <label>
              <input
                type="file"
                multiple
                className="hidden"
                // @ts-expect-error webkitdirectory non è in tipi standard
                webkitdirectory=""
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <Button type="button" size="sm" variant="outline" asChild>
                <span className="cursor-pointer">
                  <FolderOpen className="h-4 w-4 mr-1" /> Cartella
                </span>
              </Button>
            </label>
          </div>
          {parsing && (
            <p className="mt-4 text-xs text-muted-foreground">Analisi in corso…</p>
          )}
        </div>
      )}

      {/* Report leggibile */}
      {result && summary && !commitDone && (
        <div className="space-y-4">
          <div className="border border-border rounded-lg p-5 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                {result.isValid ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    Pronto per l'import
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    Risolvi gli errori per procedere
                  </>
                )}
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={reset}>
                  <Trash2 className="h-3 w-3 mr-1" /> Annulla
                </Button>
                <Button
                  size="sm"
                  disabled={!result.isValid || !result.manifest || committing}
                  onClick={onCommit}
                  className="gap-1"
                >
                  <Play className="h-4 w-4" />
                  {committing ? 'Importazione…' : 'Importa tutto'}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Pacchetto rilevato — formato standard */}
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Pacchetto rilevato
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <SummaryRow
                label="Borsa"
                value={summary.bagDetected ? 'sì' : 'no'}
                ok={summary.bagDetected}
              />
              <SummaryRow label="Modello" value={summary.modelName} sub={summary.modelSlug} />
              <SummaryRow label="Vista" value={summary.viewName} sub={summary.viewSlug} />
              <SummaryRow label="Canvas" value={summary.canvas} />
              <SummaryRow
                label="Zone corpo"
                value={summary.bodyZones > 0 ? `${summary.bodyZones}` : '0'}
              />
              <SummaryRow
                label="Geometria manico principale"
                value={summary.handleMain && summary.handlePath ? 'sì' : summary.handleMain ? 'parziale (no path)' : 'no'}
                ok={summary.handleMain && summary.handlePath}
              />
              <SummaryRow
                label="Side loops"
                value={`${summary.sideLoopsCount} / 2`}
                muted={summary.sideLoopsCount === 0}
              />
              <SummaryRow
                label="Handle path"
                value={summary.handlePath ? 'sì' : 'no'}
                ok={summary.handlePath}
              />
              <SummaryRow
                label="Preset manici"
                value={`${summary.presetsCount}`}
                muted={summary.presetsCount === 0}
              />
              <SummaryRow
                label="Errori"
                value={`${errors.length}`}
                ok={errors.length === 0}
              />
              <SummaryRow
                label="Warning"
                value={`${warnings.length}`}
                muted={warnings.length === 0}
              />
              <SummaryRow
                label="File totali"
                value={`${result.files.size} (${result.imageDims.size} immagini)`}
              />
            </div>
          </div>

          {/* Progress */}
          {committing && progress && (
            <div className="border border-border rounded-lg p-4 bg-card space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{progress.step}</span>
                <span className="font-mono">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <Progress
                value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
              />
            </div>
          )}

          {/* Issues (solo se ce ne sono) */}
          {(errors.length > 0 || warnings.length > 0) && (
            <div className="border border-border rounded-lg p-4 bg-card">
              <h3 className="text-sm font-semibold mb-2">
                {errors.length > 0
                  ? `${errors.length} errori`
                  : ''}
                {errors.length > 0 && warnings.length > 0 ? ' · ' : ''}
                {warnings.length > 0 ? `${warnings.length} avvisi` : ''}
              </h3>
              <Separator className="mb-3" />
              <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                {result.issues
                  .filter((i) => i.level !== 'info')
                  .map((i, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs">
                      {i.level === 'error' ? (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      )}
                      <span className="text-foreground">
                        {i.file && (
                          <code className="text-[10px] bg-muted px-1 py-0.5 rounded mr-1">
                            {i.file}
                          </code>
                        )}
                        {i.message}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Schermata "Import completato" */}
      {commitDone && (
        <div className="border border-border rounded-lg p-6 bg-card space-y-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Importazione completata
              </h3>
              <p className="text-xs text-muted-foreground">
                {commitDone.uploadedFiles} file caricati ·{' '}
                {commitDone.zonesCreated} zone body ·{' '}
                {commitDone.handleGeometryCreated ? 'manico configurato' : 'nessun manico'} ·{' '}
                {commitDone.sidePartsCreated} fettuccine ·{' '}
                {commitDone.presetsImported} preset manico
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button asChild variant="default" className="gap-2">
              <Link to={`/admin/models`}>
                <ArrowRight className="h-4 w-4" /> Vai alla borsa
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/engine-demo">
                <Eye className="h-4 w-4" /> Anteprima configuratore
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/admin/handle-presets">
                <Layers className="h-4 w-4" /> Preset manici
              </Link>
            </Button>
          </div>

          <Button size="sm" variant="ghost" onClick={reset} className="gap-1">
            <Upload className="h-3 w-3" /> Carica un altro pack
          </Button>
        </div>
      )}

      {/* Help */}
      {!result && !commitDone && (
        <div className="border border-border rounded-lg p-4 bg-muted/20 text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            <strong className="text-foreground">Cosa contiene lo ZIP standard?</strong>
          </p>
          <ul className="ml-5 list-disc space-y-0.5">
            <li>
              <code>asset_manifest.json</code>, <code>original.png</code>,{' '}
              <code>handle_presets.json</code>
            </li>
            <li>
              <code>body/</code>: mask_body_front_main, _left_side, _right_side, _top_band,
              _bottom_fold + overlays
            </li>
            <li>
              <code>handle_geometry/</code>: mask_handle_main_full + handle_path.json + overlay
              shadows/highlights
            </li>
            <li>
              <code>handle_geometry/</code>: mask_handle_side_loop_left/right.png + overlay
              dedicati
            </li>
          </ul>
          <p className="mt-2">
            Lo stesso ZIP può essere ricaricato per aggiornare la borsa: identifichiamo lo
            stesso modello/vista tramite <code>modelSlug</code> + <code>viewSlug</code> e
            sovrascriviamo zone, manico, fettuccine e preset esistenti.
          </p>
        </div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const SummaryRow: React.FC<{
  label: string;
  value: string;
  sub?: string;
  ok?: boolean;
  muted?: boolean;
}> = ({ label, value, sub, ok, muted }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-2">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span
      className={`text-sm font-medium text-right ${
        muted ? 'text-muted-foreground' : ok ? 'text-emerald-500' : 'text-foreground'
      }`}
    >
      {value}
      {sub && (
        <code className="block text-[10px] font-mono text-muted-foreground">
          {sub}
        </code>
      )}
    </span>
  </div>
);

export default AdminUpload;
