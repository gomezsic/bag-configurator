/**
 * BagViewsEditor
 *
 * Gestisce N viste (bag_views) per un singolo bag_model:
 * - lista ordinata per sort_order
 * - aggiungi/elimina vista
 * - per ogni vista: view_type (front/back/side/...), canvas_width/height,
 *   upload base_image_url e overlay_url, flag is_active
 *
 * Le immagini vengono caricate nel bucket pubblico admin-assets.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uploadAsset } from '@/lib/uploadAsset';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Upload, ImageOff, Save, RotateCcw, Wand2, AlertTriangle, Loader2 } from 'lucide-react';
import { NewViewWizard } from './NewViewWizard';
import { MaskGeneratorDialog } from './MaskGeneratorDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const VIEW_TYPES = [
  { value: 'front', label: 'Frontale' },
  { value: 'back', label: 'Posteriore' },
  { value: 'side', label: 'Laterale' },
  { value: 'three_quarter', label: '3/4' },
  { value: 'top', label: 'Dall\'alto' },
  { value: 'bottom', label: 'Dal basso' },
  { value: 'interior', label: 'Interno' },
  { value: 'custom', label: 'Personalizzata' },
] as const;
const VIEW_TYPE_VALUES: string[] = VIEW_TYPES.map(v => v.value);

interface BagView {
  id: string;
  bag_model_id: string;
  view_type: string;
  custom_label: string | null;
  base_image_url: string | null;
  overlay_url: string | null;
  overlay_shadows_url: string | null;
  overlay_highlights_url: string | null;
  overlay_details_url: string | null;
  canvas_width: number;
  canvas_height: number;
  sort_order: number;
  is_active: boolean;
  asset_notes: string | null;
}

type OverlayField =
  | 'base_image_url'
  | 'overlay_url'
  | 'overlay_shadows_url'
  | 'overlay_highlights_url'
  | 'overlay_details_url';

interface Props {
  bagModelId: string;
  modelSlug: string;
}

export const BagViewsEditor: React.FC<Props> = ({ bagModelId, modelSlug }) => {
  const qc = useQueryClient();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [maskGenViewId, setMaskGenViewId] = useState<string | null>(null);
  // Local drafts: viewId -> partial edits, applied to the server only on Save
  const [drafts, setDrafts] = useState<Record<string, Partial<BagView>>>({});

  const { data: views, isLoading } = useQuery({
    queryKey: ['bag-views', bagModelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bag_views')
        .select('*')
        .eq('bag_model_id', bagModelId)
        .order('sort_order');
      if (error) throw error;
      return data as unknown as BagView[];
    },
  });

  // Helpers to read merged value (draft over server) and to update a draft field
  const merged = (v: BagView): BagView => ({ ...v, ...(drafts[v.id] ?? {}) });
  const isDirty = (id: string) => Object.keys(drafts[id] ?? {}).length > 0;
  const setDraft = (id: string, patch: Partial<BagView>) =>
    setDrafts(d => ({ ...d, [id]: { ...(d[id] ?? {}), ...patch } }));
  const clearDraft = (id: string) =>
    setDrafts(d => {
      const { [id]: _, ...rest } = d;
      return rest;
    });

  const addView = useMutation({
    mutationFn: async () => {
      const nextOrder = (views?.length ?? 0);
      // pick next standard type or fall back to 'custom'
      const usedTypes = new Set(views?.map(v => v.view_type) ?? []);
      const nextStandard = ['front', 'back', 'side', 'three_quarter', 'top', 'bottom', 'interior']
        .find(t => !usedTypes.has(t));
      const defaultType = nextStandard ?? 'custom';
      const { error } = await supabase.from('bag_views').insert({
        bag_model_id: bagModelId,
        view_type: defaultType,
        canvas_width: 2000,
        canvas_height: 2000,
        sort_order: nextOrder,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bag-views', bagModelId] });
      toast.success('Vista aggiunta');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateView = useMutation({
    mutationFn: async (v: Partial<BagView> & { id: string }) => {
      const { id, ...rest } = v;
      const { error } = await supabase.from('bag_views').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bag-views', bagModelId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bag_views').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bag-views', bagModelId] });
      toast.success('Vista eliminata');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Legge width/height di un File immagine in modo asincrono. */
  const readImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const dims = { width: img.naturalWidth, height: img.naturalHeight };
        URL.revokeObjectURL(url);
        resolve(dims);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Impossibile leggere il file immagine'));
      };
      img.src = url;
    });

  const handleUpload = async (
    viewId: string,
    file: File,
    field: OverlayField,
    viewType: string,
    expectedSize?: { width: number; height: number },
  ) => {
    setUploadingId(`${viewId}-${field}`);
    try {
      // Per gli overlay (NON per base_image_url) verifichiamo che le dimensioni
      // del PNG combacino col canvas della view: senza questo check è facile
      // caricare un overlay legacy di un'altra borsa e ritrovarlo disallineato
      // o stretchato dal renderer.
      if (field !== 'base_image_url' && expectedSize) {
        const dims = await readImageDimensions(file);
        if (dims.width !== expectedSize.width || dims.height !== expectedSize.height) {
          toast.error(
            `Dimensioni non valide: il PNG è ${dims.width}×${dims.height}, atteso ${expectedSize.width}×${expectedSize.height} (canvas della vista). Esporta il file con le stesse dimensioni della base image.`,
            { duration: 8000 },
          );
          return;
        }
      }
      const url = await uploadAsset(
        file,
        `models/${modelSlug}/${viewType}`,
        field
      );
      await updateView.mutateAsync({ id: viewId, [field]: url } as Partial<BagView> & { id: string });
      toast.success('Immagine caricata');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Viste del modello</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => addView.mutate()} className="gap-2 text-xs">
            <Plus className="h-3.5 w-3.5" /> Vista vuota
          </Button>
          <Button size="sm" variant="default" onClick={() => setWizardOpen(true)} className="gap-2">
            <Wand2 className="h-3.5 w-3.5" /> Nuova vista guidata
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Caricamento viste...</p>}

      {views?.length === 0 && (
        <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
          Nessuna vista. Aggiungi almeno una vista (es. <code>front</code>) e carica la base image
          neutra del modello.
        </div>
      )}

      <div className="space-y-3">
        {views?.map(v => {
          const m = merged(v);
          const dirty = isDirty(v.id);
          return (
          <div key={v.id} className="border border-border rounded-lg p-3 space-y-3 bg-muted/20">
            <div className="flex items-start gap-3">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo vista</Label>
                  <Select
                    value={VIEW_TYPE_VALUES.includes(m.view_type) ? m.view_type : 'custom'}
                    onValueChange={val => setDraft(v.id, { view_type: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VIEW_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ordine</Label>
                  <Input
                    type="number"
                    value={m.sort_order}
                    onChange={e =>
                      setDraft(v.id, { sort_order: parseInt(e.target.value) || 0 })
                    }
                    className="h-8 text-xs"
                  />
                </div>
                {m.view_type === 'custom' && (
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Nome personalizzato</Label>
                    <Input
                      type="text"
                      value={m.custom_label ?? ''}
                      placeholder="Es. dettaglio_chiusura"
                      onChange={e => setDraft(v.id, { custom_label: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Canvas W</Label>
                  <Input
                    type="number"
                    value={m.canvas_width}
                    onChange={e =>
                      setDraft(v.id, { canvas_width: parseInt(e.target.value) || 2000 })
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Canvas H</Label>
                  <Input
                    type="number"
                    value={m.canvas_height}
                    onChange={e =>
                      setDraft(v.id, { canvas_height: parseInt(e.target.value) || 2000 })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={m.is_active}
                    onCheckedChange={val => setDraft(v.id, { is_active: val })}
                  />
                  <Label className="text-xs">Attiva</Label>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Link
                      to={`/admin/upload?bagModelId=${bagModelId}&bagViewId=${v.id}&bagModelName=${encodeURIComponent(modelSlug)}&bagViewName=${encodeURIComponent(v.custom_label || v.view_type)}`}
                      title="Carica ZIP per questa vista"
                    >
                      <Upload className="h-3 w-3" /> ZIP
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Eliminare la vista "${v.view_type}"?`)) deleteView.mutate(v.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AssetSlot
                label="Base image (borsa neutra)"
                url={v.base_image_url}
                uploading={uploadingId === `${v.id}-base_image_url`}
                onUpload={file => handleUpload(v.id, file, 'base_image_url', v.view_type)}
                onClear={() => updateView.mutate({ id: v.id, base_image_url: null })}
              />
              <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground bg-muted/30 flex flex-col items-center justify-center text-center leading-relaxed gap-3">
                <p>
                  Carica la <strong>foto neutra</strong> della borsa, poi genera le maschere di zona con AI.
                </p>
                <Button
                  size="sm"
                  variant="default"
                  disabled={!v.base_image_url}
                  onClick={() => setMaskGenViewId(v.id)}
                  className="gap-1.5 w-full"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Genera maschere zone AI
                </Button>
                {!v.base_image_url && (
                  <p className="text-[11px] opacity-70">Carica prima la base image.</p>
                )}
              </div>
            </div>

            {/* Runtime overlays: shadows / highlights / details (upload manuale) */}
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs font-medium text-foreground">
                Overlay di rendering (profondità + metalli)
              </p>

              {/* Avviso disallineamento dimensioni overlay */}
              <OverlayMismatchWarning
                view={v}
                onClearMismatched={fields => {
                  const patch: Partial<BagView> & { id: string } = { id: v.id };
                  for (const f of fields) (patch as Record<string, unknown>)[f] = null;
                  updateView.mutate(patch);
                }}
              />

              <div className="grid grid-cols-3 gap-2">
                <AssetSlot
                  label="Ombre (multiply)"
                  url={v.overlay_shadows_url}
                  uploading={uploadingId === `${v.id}-overlay_shadows_url`}
                  onUpload={file =>
                    handleUpload(v.id, file, 'overlay_shadows_url', v.view_type, {
                      width: v.canvas_width,
                      height: v.canvas_height,
                    })
                  }
                  onClear={() => updateView.mutate({ id: v.id, overlay_shadows_url: null })}
                />
                <AssetSlot
                  label="Luci (screen)"
                  url={v.overlay_highlights_url}
                  uploading={uploadingId === `${v.id}-overlay_highlights_url`}
                  onUpload={file =>
                    handleUpload(v.id, file, 'overlay_highlights_url', v.view_type, {
                      width: v.canvas_width,
                      height: v.canvas_height,
                    })
                  }
                  onClear={() => updateView.mutate({ id: v.id, overlay_highlights_url: null })}
                />
                <AssetSlot
                  label="Dettagli (zip, metalli)"
                  url={v.overlay_details_url}
                  uploading={uploadingId === `${v.id}-overlay_details_url`}
                  onUpload={file =>
                    handleUpload(v.id, file, 'overlay_details_url', v.view_type, {
                      width: v.canvas_width,
                      height: v.canvas_height,
                    })
                  }
                  onClear={() => updateView.mutate({ id: v.id, overlay_details_url: null })}
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Carica i tre PNG precomputati con le <strong>stesse dimensioni esatte</strong> del
                canvas ({v.canvas_width}×{v.canvas_height}px), sfondo trasparente. Le ombre vengono
                fuse in <code>multiply</code>, le luci in <code>screen</code>, i dettagli in{' '}
                <code>normal</code> sopra a tutto.
              </p>
            </div>

            {/* Editor manico (centerline + maschera + overlay handle) */}
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs font-medium text-foreground">Manico</p>
              <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <a href={`/admin/handle-editor/${v.id}`}>
                  Apri editor manico per questa vista
                </a>
              </Button>
            </div>

            {/* Save / Cancel bar (visible only when there are unsaved changes) */}
            {dirty && (
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                <p className="text-xs text-destructive">
                  ● Modifiche non salvate
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => clearDraft(v.id)}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <RotateCcw className="h-3 w-3" /> Annulla
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await updateView.mutateAsync({ id: v.id, ...drafts[v.id] });
                        clearDraft(v.id);
                        toast.success('Vista salvata');
                      } catch {
                        // toast already handled in mutation onError
                      }
                    }}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <Save className="h-3 w-3" /> Salva
                  </Button>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>



      <NewViewWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        bagModelId={bagModelId}
        modelSlug={modelSlug}
        existingViewsCount={views?.length ?? 0}
        usedViewTypes={views?.map(v => v.view_type) ?? []}
        onCreated={() => qc.invalidateQueries({ queryKey: ['bag-views', bagModelId] })}
      />

      {maskGenViewId && (() => {
        const view = views?.find(v => v.id === maskGenViewId);
        if (!view?.base_image_url) return null;
        return (
          <MaskGeneratorDialog
            open={true}
            onOpenChange={open => { if (!open) setMaskGenViewId(null); }}
            bagViewId={view.id}
            bagModelSlug={modelSlug}
            viewType={view.view_type}
            canvasWidth={view.canvas_width}
            canvasHeight={view.canvas_height}
            baseImageUrl={view.base_image_url}
            onApplied={() => {
              setMaskGenViewId(null);
              qc.invalidateQueries({ queryKey: ['bag-views', bagModelId] });
            }}
          />
        );
      })()}
    </div>
  );
};

interface SlotProps {
  label: string;
  url: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}

const AssetSlot: React.FC<SlotProps> = ({ label, url, uploading, onUpload, onClear }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="border border-border rounded-md bg-background aspect-square relative overflow-hidden flex items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="w-full h-full object-contain" />
        ) : (
          <ImageOff className="h-6 w-6 text-muted-foreground" />
        )}
        {uploading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center text-xs">
            Caricamento...
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = '';
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="gap-1.5 h-7 text-xs flex-1"
        >
          <Upload className="h-3 w-3" />
          {url ? 'Sostituisci' : 'Carica'}
        </Button>
        {url && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            className="h-7 text-xs px-2"
          >
            Rimuovi
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * OverlayMismatchWarning
 *
 * Carica in background le 3 immagini overlay (shadows/highlights/details) di una
 * view e ne legge `naturalWidth × naturalHeight`. Se NON combaciano col canvas
 * della view, mostra un banner di warning con la lista dei file disallineati e
 * un bottone per pulirli (li imposta a NULL nel DB). Questo è il fix definitivo
 * al problema "ombre/dettagli più grandi della borsa": invece di lasciare che
 * il renderer stretchi un PNG di dimensioni sbagliate, lo segnaliamo subito e
 * permettiamo di rimuoverlo con un click.
 */
const OverlayMismatchWarning: React.FC<{
  view: BagView;
  onClearMismatched: (fields: OverlayField[]) => void;
}> = ({ view, onClearMismatched }) => {
  type Status = 'loading' | 'ok' | 'mismatch' | 'error';
  type FieldKey = 'overlay_shadows_url' | 'overlay_highlights_url' | 'overlay_details_url';

  const slots: { field: FieldKey; label: string; url: string | null }[] = [
    { field: 'overlay_shadows_url', label: 'Ombre', url: view.overlay_shadows_url },
    { field: 'overlay_highlights_url', label: 'Luci', url: view.overlay_highlights_url },
    { field: 'overlay_details_url', label: 'Dettagli', url: view.overlay_details_url },
  ];

  const [results, setResults] = useState<
    Record<FieldKey, { status: Status; width?: number; height?: number }>
  >({
    overlay_shadows_url: { status: 'loading' },
    overlay_highlights_url: { status: 'loading' },
    overlay_details_url: { status: 'loading' },
  });

  useEffect(() => {
    let cancelled = false;
    const expected = { width: view.canvas_width, height: view.canvas_height };
    const loadOne = (slot: { field: FieldKey; url: string | null }) =>
      new Promise<void>(resolve => {
        if (!slot.url) {
          if (!cancelled) setResults(r => ({ ...r, [slot.field]: { status: 'ok' } }));
          resolve();
          return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (cancelled) return resolve();
          const matches =
            img.naturalWidth === expected.width && img.naturalHeight === expected.height;
          setResults(r => ({
            ...r,
            [slot.field]: {
              status: matches ? 'ok' : 'mismatch',
              width: img.naturalWidth,
              height: img.naturalHeight,
            },
          }));
          resolve();
        };
        img.onerror = () => {
          if (cancelled) return resolve();
          setResults(r => ({ ...r, [slot.field]: { status: 'error' } }));
          resolve();
        };
        img.src = `${slot.url}${slot.url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
      });
    Promise.all(slots.map(loadOne));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    view.id,
    view.canvas_width,
    view.canvas_height,
    view.overlay_shadows_url,
    view.overlay_highlights_url,
    view.overlay_details_url,
  ]);

  const mismatched = slots.filter(s => results[s.field].status === 'mismatch');
  const anyLoading = slots.some(s => s.url && results[s.field].status === 'loading');

  if (mismatched.length === 0 && !anyLoading) return null;

  if (anyLoading) {
    return (
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Verifica dimensioni overlay…
      </div>
    );
  }

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <div className="flex-1 text-xs space-y-1">
          <p className="font-medium text-foreground">
            Overlay con dimensioni non allineate al canvas ({view.canvas_width}×
            {view.canvas_height}px)
          </p>
          <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
            {mismatched.map(s => {
              const r = results[s.field];
              return (
                <li key={s.field}>
                  <strong className="text-foreground">{s.label}</strong>: {r.width}×{r.height}px →
                  verrà stretchato e apparirà disallineato
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="destructive"
          className="h-7 text-xs gap-1.5"
          onClick={() => onClearMismatched(mismatched.map(s => s.field))}
        >
          <Trash2 className="h-3 w-3" />
          Pulisci {mismatched.length} overlay disallineati
        </Button>
      </div>
    </div>
  );
};
