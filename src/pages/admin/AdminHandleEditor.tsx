/**
 * AdminHandleEditor — Fase 2
 *
 * Pagina admin per editare la geometria del manico di una bag_view:
 *  - upload dei 5 PNG (mask obbligatorio, gli altri opzionali)
 *  - canvas interattivo con punti centerline (click/drag/insert/delete)
 *  - lista numerica dei punti per editing fine di x/y/width
 *  - slider per width di default e per il punto selezionato
 *  - toggle visibilità mask, strip, sfondo borsa
 *  - import/export JSON, save su handle_geometries.path_json
 *
 * Il rendering finale curvato del manico (mesh PixiJS) verrà aggiunto in Fase 3.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  HandlePathDocument,
  EMPTY_PATH_DOC,
  validatePathDocument,
} from '@/engine/handlePath';
import HandlePathCanvas from '@/components/admin/handle/HandlePathCanvas';
import HandlePointsList from '@/components/admin/handle/HandlePointsList';
import HandleAssetUploader from '@/components/admin/handle/HandleAssetUploader';
import HandleSideLoopUploader from '@/components/admin/handle/HandleSideLoopUploader';
import HandlePresetPreview from '@/components/admin/handle/HandlePresetPreview';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { HandlePatternPreset } from '@/engine/handlePreset';

type GeometryRow = {
  id: string;
  bag_view_id: string;
  default_width: number;
  mask_url: string | null;
  shadow_url: string | null;
  highlight_url: string | null;
  details_url: string | null;
  hardware_url: string | null;
  // path_json arriva come Json di Supabase; lo trattiamo come HandlePathDocument lato app
  path_json: unknown;
};

const AdminHandleEditor: React.FC = () => {
  const { viewId } = useParams<{ viewId: string }>();
  const qc = useQueryClient();

  const { data: view } = useQuery({
    queryKey: ['bag-view', viewId],
    queryFn: async () => {
      if (!viewId) return null;
      const { data, error } = await supabase
        .from('bag_views')
        .select(
          'id, view_type, custom_label, canvas_width, canvas_height, base_image_url, bag_model_id',
        )
        .eq('id', viewId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!viewId,
  });

  const { data: geometry, refetch: refetchGeo } = useQuery({
    queryKey: ['handle-geometry', viewId],
    queryFn: async () => {
      if (!viewId) return null;
      const { data, error } = await supabase
        .from('handle_geometries')
        .select('*')
        .eq('bag_view_id', viewId)
        .maybeSingle();
      if (error) throw error;
      return data as GeometryRow | null;
    },
    enabled: !!viewId,
  });

  const ensureGeometry = useMutation({
    mutationFn: async () => {
      if (!viewId || geometry) return;
      const initial = EMPTY_PATH_DOC(view?.canvas_width, view?.canvas_height);
      const { error } = await supabase.from('handle_geometries').insert({
        bag_view_id: viewId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        path_json: initial as any,
        default_width: 50,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handle-geometry', viewId] }),
  });

  useEffect(() => {
    if (view && geometry === null) ensureGeometry.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, geometry]);

  // Stato locale del documento (editing ottimistico, save manuale)
  const [doc, setDoc] = useState<HandlePathDocument | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showMask, setShowMask] = useState(true);
  const [showStrip, setShowStrip] = useState(true);
  const [showBag, setShowBag] = useState(true);
  const [defaultWidth, setDefaultWidth] = useState<number>(50);
  const [dirty, setDirty] = useState(false);
  const [previewPresetId, setPreviewPresetId] = useState<string | null>(null);
  const [previewShowCenterline, setPreviewShowCenterline] = useState(false);

  // Target di editing: il manico principale o una delle due fettuccine laterali.
  // Ciascun target ha la propria centerline indipendente, salvata in tabelle diverse:
  //  - 'main'            → handle_geometries.path_json
  //  - 'side_loop_left'  → handle_side_parts.path_json (row con part_id)
  //  - 'side_loop_right' → handle_side_parts.path_json (row con part_id)
  type EditTarget = 'main' | 'side_loop_left' | 'side_loop_right';
  const [editTarget, setEditTarget] = useState<EditTarget>('main');

  // Side parts dal DB (per leggere/scrivere la centerline indipendente)
  const { data: sideParts, refetch: refetchSides } = useQuery({
    queryKey: ['handle-side-parts', geometry?.id],
    enabled: !!geometry?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('handle_side_parts')
        .select('id, part_id, mask_url, path_json')
        .eq('handle_geometry_id', geometry!.id);
      if (error) throw error;
      return data as Array<{ id: string; part_id: string; mask_url: string | null; path_json: unknown }>;
    },
  });

  const activeSideRow = useMemo(() => {
    if (editTarget === 'main') return null;
    return sideParts?.find((r) => r.part_id === editTarget) ?? null;
  }, [editTarget, sideParts]);


  // Preset disponibili per anteprima rendering finale
  const { data: presetsList } = useQuery({
    queryKey: ['handle-presets-for-editor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('handle_pattern_presets')
        .select('id, name, stripe_count, preset_json')
        .order('sort_order');
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as any as { id: string; name: string; stripe_count: number; preset_json: HandlePatternPreset | null }[];
    },
  });

  const previewPreset = useMemo(() => {
    if (!previewPresetId || !presetsList) return null;
    const row = presetsList.find((r) => r.id === previewPresetId);
    return row?.preset_json ?? null;
  }, [previewPresetId, presetsList]);

  // Quando arriva la geometria/side row, carica il doc locale del target attivo.
  // Il manico principale e ciascuna fettuccia hanno path_json indipendente.
  useEffect(() => {
    if (!view) return;
    const sourceJson =
      editTarget === 'main'
        ? (geometry?.path_json as HandlePathDocument | null)
        : (activeSideRow?.path_json as HandlePathDocument | null);

    if (sourceJson && Array.isArray(sourceJson.paths)) {
      setDoc({
        ...sourceJson,
        canvasWidth: view.canvas_width,
        canvasHeight: view.canvas_height,
      });
    } else {
      setDoc(EMPTY_PATH_DOC(view.canvas_width, view.canvas_height));
    }
    setDefaultWidth(geometry?.default_width ?? 50);
    setSelectedIndex(null);
    setDirty(false);
  }, [geometry, view, editTarget, activeSideRow]);


  const updateDoc = (next: HandlePathDocument) => {
    setDoc(next);
    setDirty(true);
  };

  const issues = useMemo(() => (doc ? validatePathDocument(doc) : []), [doc]);
  const hasErrors = issues.some((i) => i.level === 'error');

  // Statistiche del path corrente per il pannello info
  const pathInfo = useMemo(() => {
    if (!doc) return null;
    const totalPoints = doc.paths.reduce((acc, p) => acc + (p.points?.length ?? 0), 0);
    const allWidths = doc.paths.flatMap((p) => p.points.map((pt) => pt.width));
    const avgWidth = allWidths.length
      ? Math.round(allWidths.reduce((a, b) => a + b, 0) / allWidths.length)
      : 0;
    return {
      name: doc.name ?? '(senza nome)',
      canvasWidth: doc.canvasWidth,
      canvasHeight: doc.canvasHeight,
      pathsCount: doc.paths.length,
      totalPoints,
      avgWidth,
    };
  }, [doc]);

  const save = useMutation({
    mutationFn: async () => {
      if (!geometry || !doc) return;

      if (editTarget === 'main') {
        const { error } = await supabase
          .from('handle_geometries')
          .update({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            path_json: doc as any,
            default_width: defaultWidth,
          })
          .eq('id', geometry.id);
        if (error) throw error;
        return;
      }

      // Side loop: crea la riga al volo se manca, poi aggiorna il path_json
      if (activeSideRow) {
        const { error } = await supabase
          .from('handle_side_parts')
          .update({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            path_json: doc as any,
          })
          .eq('id', activeSideRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('handle_side_parts').insert({
          handle_geometry_id: geometry.id,
          part_id: editTarget,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          path_json: doc as any,
          sort_order: editTarget === 'side_loop_left' ? 0 : 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        editTarget === 'main' ? 'Geometria salvata' : 'Centerline fettuccia salvata',
      );
      setDirty(false);
      if (editTarget === 'main') refetchGeo();
      else refetchSides();
    },
    onError: (e) => {
      console.error(e);
      toast.error('Errore salvataggio');
    },
  });


  // Export/import JSON sono stati rimossi: l'unico canale di import è "Carica File" (ZIP).
  // Restano gli editor visivi (centerline, punti) per fine-tuning manuale.

  const applyDefaultWidthToAll = () => {
    if (!doc) return;
    const path = doc.paths[0];
    if (!path) return;
    updateDoc({
      ...doc,
      paths: doc.paths.map((p, i) =>
        i === 0
          ? { ...p, points: p.points.map((pt) => ({ ...pt, width: defaultWidth })) }
          : p,
      ),
    });
  };

  const clearAllPoints = () => {
    if (!doc) return;
    if (!confirm('Cancellare tutti i punti?')) return;
    updateDoc({
      ...doc,
      paths: doc.paths.map((p, i) => (i === 0 ? { ...p, points: [] } : p)),
    });
    setSelectedIndex(null);
  };

  const updateSelectedWidth = (w: number) => {
    if (!doc || selectedIndex === null) return;
    const path = doc.paths[0];
    if (!path) return;
    updateDoc({
      ...doc,
      paths: doc.paths.map((p, i) =>
        i === 0
          ? {
              ...p,
              points: p.points.map((pt, idx) => (idx === selectedIndex ? { ...pt, width: w } : pt)),
            }
          : p,
      ),
    });
  };

  const selectedPoint =
    doc && selectedIndex !== null ? doc.paths[0]?.points[selectedIndex] : null;

  const targetLabel: Record<EditTarget, string> = {
    main: 'Manico principale',
    side_loop_left: 'Fettuccia sinistra',
    side_loop_right: 'Fettuccia destra',
  };

  const activeMaskUrl =
    editTarget === 'main'
      ? geometry?.mask_url ?? null
      : activeSideRow?.mask_url ?? null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link to="/admin/models">
              <ArrowLeft className="h-4 w-4" /> Modelli
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="text-sm">
            <span className="font-semibold">Editor manico</span>
            <span className="text-muted-foreground">
              {' '}
              · vista <code>{view?.view_type ?? '…'}</code>
              {view && (
                <>
                  {' '}
                  · {view.canvas_width}×{view.canvas_height}
                </>
              )}
            </span>
          </div>
          <Separator orientation="vertical" className="h-6" />
          {/* Selettore target di editing: ciascuno ha la propria centerline */}
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-background">
            {(['main', 'side_loop_left', 'side_loop_right'] as EditTarget[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  if (dirty && !confirm('Hai modifiche non salvate. Cambiare target?')) return;
                  setEditTarget(t);
                }}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${
                  editTarget === t
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {targetLabel[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-500 font-medium">Modifiche non salvate</span>
          )}
          <Button
            size="sm"
            onClick={() => save.mutate()}
            disabled={save.isPending || !dirty || hasErrors}
            className="gap-1"
          >
            <Save className="h-4 w-4" />
            {save.isPending ? 'Salvataggio…' : `Salva ${targetLabel[editTarget].toLowerCase()}`}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 grid grid-cols-[280px_1fr_320px] gap-0 min-h-0">
        {/* Left: assets + view options */}
        <aside className="border-r border-border bg-card p-3 overflow-y-auto space-y-4">
          {geometry ? (
            <HandleAssetUploader
              geometryId={geometry.id}
              values={{
                mask_url: geometry.mask_url,
                shadow_url: geometry.shadow_url,
                highlight_url: geometry.highlight_url,
                details_url: geometry.details_url,
                hardware_url: geometry.hardware_url,
              }}
              onSaved={() => refetchGeo()}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Caricamento geometria…</p>
          )}

          {geometry && <HandleSideLoopUploader geometryId={geometry.id} />}

          <Separator />

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
              Visualizzazione
            </h3>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mostra mask</Label>
              <Switch checked={showMask} onCheckedChange={setShowMask} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mostra strip width</Label>
              <Switch checked={showStrip} onCheckedChange={setShowStrip} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mostra foto borsa</Label>
              <Switch checked={showBag} onCheckedChange={setShowBag} />
            </div>
          </div>
        </aside>

        {/* Center: canvas */}
        <main className="bg-background min-h-0 p-3">
          {editTarget !== 'main' && !activeMaskUrl && (
            <div className="border border-dashed border-border rounded p-3 mb-2 text-xs text-muted-foreground">
              Nessuna mask caricata per <strong>{targetLabel[editTarget].toLowerCase()}</strong>.
              Caricala dal pannello "Fettuccine laterali" a sinistra; poi puoi disegnare i suoi punti qui.
            </div>
          )}
          {doc && (
            <HandlePathCanvas
              doc={doc}
              maskUrl={activeMaskUrl}
              baseImageUrl={showBag ? view?.base_image_url ?? null : null}
              selectedIndex={selectedIndex}
              onChange={updateDoc}
              onSelectIndex={setSelectedIndex}
              defaultWidth={defaultWidth}
              showMask={showMask}
              showStrip={showStrip}
            />
          )}
        </main>

        {/* Right: info + width controls + points list */}
        <aside className="border-l border-border bg-card p-3 overflow-y-auto space-y-4">
          {pathInfo && (
            <div className="rounded-md border border-border bg-muted/20 p-2 space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                Handle path attuale
              </h3>
              <dl className="text-[11px] text-muted-foreground space-y-0.5">
                <div className="flex justify-between gap-2">
                  <dt>Nome:</dt>
                  <dd className="text-foreground truncate" title={pathInfo.name}>
                    {pathInfo.name}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Canvas:</dt>
                  <dd className="text-foreground">
                    {pathInfo.canvasWidth} × {pathInfo.canvasHeight}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Paths:</dt>
                  <dd className="text-foreground">{pathInfo.pathsCount}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Punti:</dt>
                  <dd className="text-foreground">{pathInfo.totalPoints}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Larghezza media:</dt>
                  <dd className="text-foreground">{pathInfo.avgWidth} px</dd>
                </div>
                {view &&
                  (pathInfo.canvasWidth !== view.canvas_width ||
                    pathInfo.canvasHeight !== view.canvas_height) && (
                    <div className="text-destructive pt-1">
                      ⚠ Canvas non allineato alla vista ({view.canvas_width}×{view.canvas_height})
                    </div>
                  )}
              </dl>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
              Width
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Width default ({defaultWidth}px)</Label>
              </div>
              <Slider
                value={[defaultWidth]}
                min={4}
                max={300}
                step={1}
                onValueChange={(v) => {
                  setDefaultWidth(v[0]);
                  setDirty(true);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1"
                onClick={applyDefaultWidthToAll}
              >
                <RotateCcw className="h-3 w-3" /> Applica a tutti i punti
              </Button>
            </div>

            {selectedPoint && selectedIndex !== null && (
              <div className="border border-border rounded-md p-2 bg-muted/20 space-y-2">
                <Label className="text-xs">
                  Punto #{selectedIndex + 1} width ({Math.round(selectedPoint.width)}px)
                </Label>
                <Slider
                  value={[selectedPoint.width]}
                  min={1}
                  max={400}
                  step={1}
                  onValueChange={(v) => updateSelectedWidth(v[0])}
                />
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div>
                    <Label className="text-[10px]">x</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedPoint.x)}
                      className="h-7 text-xs"
                      onChange={(e) => {
                        const x = parseFloat(e.target.value) || 0;
                        if (!doc) return;
                        updateDoc({
                          ...doc,
                          paths: doc.paths.map((p, i) =>
                            i === 0
                              ? {
                                  ...p,
                                  points: p.points.map((pt, idx) =>
                                    idx === selectedIndex ? { ...pt, x } : pt,
                                  ),
                                }
                              : p,
                          ),
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">y</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedPoint.y)}
                      className="h-7 text-xs"
                      onChange={(e) => {
                        const y = parseFloat(e.target.value) || 0;
                        if (!doc) return;
                        updateDoc({
                          ...doc,
                          paths: doc.paths.map((p, i) =>
                            i === 0
                              ? {
                                  ...p,
                                  points: p.points.map((pt, idx) =>
                                    idx === selectedIndex ? { ...pt, y } : pt,
                                  ),
                                }
                              : p,
                          ),
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                Punti centerline
              </h3>
              {doc && doc.paths[0]?.points.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] text-destructive"
                  onClick={clearAllPoints}
                >
                  Reset
                </Button>
              )}
            </div>
            {doc && (
              <HandlePointsList
                doc={doc}
                selectedIndex={selectedIndex}
                onChange={updateDoc}
                onSelectIndex={setSelectedIndex}
                maskUrl={geometry?.mask_url ?? null}
              />
            )}
          </div>

          <Separator />

          {/* Anteprima rendering finale con preset */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
              Anteprima rendering
            </h3>
            <Select value={previewPresetId ?? ''} onValueChange={setPreviewPresetId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Scegli un preset…" />
              </SelectTrigger>
              <SelectContent>
                {presetsList?.length === 0 && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    Nessun preset. Vai a /admin/handle-presets.
                  </div>
                )}
                {presetsList?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.stripe_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Mostra centerline manico</Label>
              <Switch
                checked={previewShowCenterline}
                onCheckedChange={setPreviewShowCenterline}
              />
            </div>
            {doc && previewPreset && geometry?.mask_url ? (
              <div className="aspect-square w-full">
                <HandlePresetPreview
                  mode="curved"
                  preset={previewPreset}
                  doc={doc}
                  baseImageUrl={view?.base_image_url ?? null}
                  maskUrl={geometry.mask_url}
                  shadowUrl={geometry.shadow_url}
                  highlightUrl={geometry.highlight_url}
                  detailsUrl={geometry.details_url}
                  hardwareUrl={geometry.hardware_url}
                  showCenterline={previewShowCenterline}
                />
              </div>
            ) : (
              <div className="border border-dashed border-border rounded p-3 text-[10px] text-muted-foreground text-center">
                Carica mask + ≥2 punti + scegli preset per vedere il rendering
              </div>
            )}
          </div>

          {issues.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Validazione
                </h3>
                {issues.map((i, idx) => (
                  <div
                    key={idx}
                    className={`text-xs px-2 py-1 rounded ${
                      i.level === 'error'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-amber-500/10 text-amber-600'
                    }`}
                  >
                    {i.message}
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default AdminHandleEditor;
