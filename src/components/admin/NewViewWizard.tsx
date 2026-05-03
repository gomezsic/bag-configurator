/**
 * NewViewWizard
 *
 * Procedura guidata in 4 step per creare una nuova bag_view + le sue mask_zones
 * partendo da PNG scontornati prodotti in Photoshop:
 *
 *   STEP 1 — Info vista       → tipo (front/back/...) + nome custom + ordine
 *   STEP 2 — Base image       → upload del PNG neutro (definisce canvas W×H)
 *   STEP 3 — Maschere zone    → aggiungi N maschere (categoria + zone_type +
 *                                label + PNG). Validazione warning se le
 *                                dimensioni non combaciano con la base.
 *   STEP 4 — Riepilogo + Save → preview di tutto, poi crea bag_view + le N
 *                                mask_zones in una transazione "best effort"
 *                                (rollback in caso di errore parziale).
 *
 * I file vengono caricati nel bucket admin-assets sotto:
 *   models/<modelSlug>/<viewType>/...
 *
 * Le validazioni sono soft: mostrano un warning giallo ma non bloccano il
 * salvataggio (scelta del progetto).
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  ImageOff,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadAsset } from '@/lib/uploadAsset';
import {
  STANDARD_FABRIC_ZONES,
  STANDARD_HANDLE_ZONES,
} from '@/engine/types';

const VIEW_TYPES = [
  { value: 'front', label: 'Frontale' },
  { value: 'back', label: 'Posteriore' },
  { value: 'side', label: 'Laterale' },
  { value: 'three_quarter', label: '3/4' },
  { value: 'top', label: "Dall'alto" },
  { value: 'bottom', label: 'Dal basso' },
  { value: 'interior', label: 'Interno' },
  { value: 'custom', label: 'Personalizzata' },
] as const;

type ZoneCategory = 'fabric' | 'handle' | 'detail';

interface DraftZone {
  /** local id used only inside the wizard to identify list rows */
  localId: string;
  category: ZoneCategory;
  zoneType: string;
  label: string;
  file: File | null;
  /** object URL for thumbnail preview */
  previewUrl: string | null;
  /** natural dimensions of the loaded image, used for validation */
  naturalW: number | null;
  naturalH: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bagModelId: string;
  modelSlug: string;
  /** Current count of views, used to default sort_order. */
  existingViewsCount: number;
  /** Already-used view_type values, to suggest the next free one. */
  usedViewTypes: string[];
  onCreated: () => void;
}

const STEPS = [
  { num: 1, label: 'Info' },
  { num: 2, label: 'Base' },
  { num: 3, label: 'Maschere' },
  { num: 4, label: 'Salva' },
] as const;

export const NewViewWizard: React.FC<Props> = ({
  open,
  onOpenChange,
  bagModelId,
  modelSlug,
  existingViewsCount,
  usedViewTypes,
  onCreated,
}) => {
  const [step, setStep] = useState(1);

  // Step 1
  const [viewType, setViewType] = useState<string>('front');
  const [customLabel, setCustomLabel] = useState('');
  const [sortOrder, setSortOrder] = useState(existingViewsCount);

  // Step 2 — base image
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [basePreviewUrl, setBasePreviewUrl] = useState<string | null>(null);
  const [baseDims, setBaseDims] = useState<{ w: number; h: number } | null>(null);

  // Step 3 — zones
  const [zones, setZones] = useState<DraftZone[]>([]);

  // Saving
  const [saving, setSaving] = useState(false);

  /* ---------- lifecycle ---------- */

  useEffect(() => {
    if (open) {
      // Suggest the next standard view type that isn't taken yet
      const nextStandard = ['front', 'back', 'side', 'three_quarter', 'top', 'bottom', 'interior']
        .find(t => !usedViewTypes.includes(t));
      setStep(1);
      setViewType(nextStandard ?? 'custom');
      setCustomLabel('');
      setSortOrder(existingViewsCount);
      setBaseFile(null);
      setBasePreviewUrl(null);
      setBaseDims(null);
      setZones([]);
    } else {
      // Cleanup object URLs
      if (basePreviewUrl) URL.revokeObjectURL(basePreviewUrl);
      zones.forEach(z => z.previewUrl && URL.revokeObjectURL(z.previewUrl));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ---------- step 2: base ---------- */

  const handleBaseFile = async (file: File) => {
    if (basePreviewUrl) URL.revokeObjectURL(basePreviewUrl);
    const url = URL.createObjectURL(file);
    setBaseFile(file);
    setBasePreviewUrl(url);
    const dims = await readImageDims(url);
    setBaseDims(dims);
  };

  /* ---------- step 3: zones ---------- */

  const addZone = () => {
    setZones(z => [
      ...z,
      {
        localId: crypto.randomUUID(),
        category: 'fabric',
        zoneType: STANDARD_FABRIC_ZONES[0],
        label: '',
        file: null,
        previewUrl: null,
        naturalW: null,
        naturalH: null,
      },
    ]);
  };

  const removeZone = (localId: string) => {
    setZones(z => {
      const found = z.find(x => x.localId === localId);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return z.filter(x => x.localId !== localId);
    });
  };

  const patchZone = (localId: string, patch: Partial<DraftZone>) => {
    setZones(z => z.map(x => (x.localId === localId ? { ...x, ...patch } : x)));
  };

  const handleZoneFile = async (localId: string, file: File) => {
    const target = zones.find(z => z.localId === localId);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    const url = URL.createObjectURL(file);
    const dims = await readImageDims(url);
    patchZone(localId, {
      file,
      previewUrl: url,
      naturalW: dims.w,
      naturalH: dims.h,
    });
  };

  /* ---------- step validation ---------- */

  const canGoNext = useMemo(() => {
    if (step === 1) {
      if (viewType === 'custom' && !customLabel.trim()) return false;
      return true;
    }
    if (step === 2) return !!baseFile;
    if (step === 3) {
      // Allow to proceed even with 0 zones (operator can add later)
      // but require that any added zone has both type+file
      return zones.every(z => z.file && z.zoneType.trim());
    }
    return true;
  }, [step, viewType, customLabel, baseFile, zones]);

  /** Soft warnings shown in step 3 + step 4 */
  const warnings = useMemo(() => {
    const w: string[] = [];
    if (baseDims && baseFile) {
      // Warn if non-square (most bag views are square 1500x1500 or 2000x2000)
      if (baseDims.w !== baseDims.h) {
        w.push(`Base image non quadrata: ${baseDims.w}×${baseDims.h}`);
      }
    }
    zones.forEach(z => {
      if (z.naturalW && z.naturalH && baseDims) {
        if (z.naturalW !== baseDims.w || z.naturalH !== baseDims.h) {
          w.push(
            `Maschera "${z.label || z.zoneType}": ${z.naturalW}×${z.naturalH} ≠ base ${baseDims.w}×${baseDims.h}`
          );
        }
      }
    });
    // Duplicate zone types
    const seen = new Set<string>();
    zones.forEach(z => {
      if (z.zoneType && seen.has(z.zoneType)) {
        w.push(`Tipo zona duplicato: "${z.zoneType}"`);
      }
      seen.add(z.zoneType);
    });
    return w;
  }, [baseDims, baseFile, zones]);

  /* ---------- save ---------- */

  const handleSave = async () => {
    if (!baseFile || !baseDims) {
      toast.error('Manca la base image');
      return;
    }
    setSaving(true);
    const t = toast.loading('Creazione vista...');
    let createdViewId: string | null = null;
    try {
      // 1) Upload base image
      const baseUrl = await uploadAsset(
        baseFile,
        `models/${modelSlug}/${viewType}`,
        'base_image'
      );

      // 2) Insert bag_view
      const { data: view, error: viewErr } = await supabase
        .from('bag_views')
        .insert({
          bag_model_id: bagModelId,
          view_type: viewType,
          custom_label: viewType === 'custom' ? customLabel.trim() : null,
          base_image_url: baseUrl,
          canvas_width: baseDims.w,
          canvas_height: baseDims.h,
          sort_order: sortOrder,
          is_active: true,
        })
        .select('id')
        .single();
      if (viewErr) throw viewErr;
      createdViewId = view.id;

      // 3) Upload masks + insert mask_zones (sequential to keep error handling simple)
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        if (!z.file) continue;
        const maskUrl = await uploadAsset(
          z.file,
          `models/${modelSlug}/${viewType}/masks`,
          `mask-${z.zoneType}`
        );
        const { error: zoneErr } = await supabase.from('mask_zones').insert({
          bag_view_id: createdViewId,
          zone_category: z.category,
          zone_type: z.zoneType,
          label: z.label.trim() || null,
          mask_image_url: maskUrl,
          sort_order: i,
        });
        if (zoneErr) throw zoneErr;
      }

      toast.success(`Vista creata con ${zones.length} maschere`, { id: t });
      onCreated();
      onOpenChange(false);
    } catch (e) {
      // Best-effort rollback: delete the view if it was created
      if (createdViewId) {
        await supabase.from('bag_views').delete().eq('id', createdViewId);
      }
      toast.error(`Errore: ${(e as Error).message}`, { id: t });
    } finally {
      setSaving(false);
    }
  };

  /* ---------- render ---------- */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuova vista guidata</DialogTitle>
          <DialogDescription>
            4 passi per caricare base + maschere scontornate in modo ordinato.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between gap-2 py-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.num}>
              <div className="flex items-center gap-2 flex-1">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
                    step === s.num
                      ? 'bg-primary text-primary-foreground border-primary'
                      : step > s.num
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
                </div>
                <span
                  className={`text-xs ${
                    step >= s.num ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 ${
                    step > s.num ? 'bg-primary/40' : 'bg-border'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* STEP 1 — info */}
        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo vista</Label>
              <Select value={viewType} onValueChange={setViewType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_TYPES.map(t => (
                    <SelectItem
                      key={t.value}
                      value={t.value}
                      disabled={usedViewTypes.includes(t.value) && t.value !== 'custom'}
                    >
                      {t.label}
                      {usedViewTypes.includes(t.value) && t.value !== 'custom' && ' (già presente)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {viewType === 'custom' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Nome personalizzato *</Label>
                <Input
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                  placeholder="Es. dettaglio_chiusura"
                  className="h-9"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Ordine di visualizzazione</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
                className="h-9"
              />
            </div>
          </div>
        )}

        {/* STEP 2 — base */}
        {step === 2 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs">Base image scontornata (PNG con alpha)</Label>
              <p className="text-[11px] text-muted-foreground">
                Carica la foto della borsa neutra, scontornata, sfondo trasparente.
                Le dimensioni di questa immagine definiranno il canvas della vista.
              </p>
              <FilePicker
                file={baseFile}
                previewUrl={basePreviewUrl}
                onPick={handleBaseFile}
                accept="image/png,image/webp"
                heightClass="h-64"
              />
              {baseDims && (
                <p className="text-xs text-muted-foreground">
                  Canvas rilevato: <strong>{baseDims.w}×{baseDims.h}px</strong>
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 3 — masks */}
        {step === 3 && (
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Aggiungi una riga per ogni maschera scontornata che hai preparato.
                Tutte le maschere dovrebbero avere le stesse dimensioni della base ({baseDims?.w}×{baseDims?.h}).
              </p>
              <Button size="sm" variant="outline" onClick={addZone} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Aggiungi maschera
              </Button>
            </div>

            {zones.length === 0 && (
              <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
                Nessuna maschera. Puoi aggiungerle ora oppure dopo, dall'editor della vista.
              </div>
            )}

            <div className="space-y-2">
              {zones.map((z, idx) => (
                <ZoneRow
                  key={z.localId}
                  zone={z}
                  index={idx}
                  onPatch={patch => patchZone(z.localId, patch)}
                  onRemove={() => removeZone(z.localId)}
                  onFile={file => handleZoneFile(z.localId, file)}
                  baseDims={baseDims}
                />
              ))}
            </div>

            {warnings.length > 0 && <WarningsBox warnings={warnings} />}
          </div>
        )}

        {/* STEP 4 — review */}
        {step === 4 && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Riepilogo vista</Label>
                <div className="border border-border rounded-md p-3 bg-muted/20 text-xs space-y-1">
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>{' '}
                    <strong>{viewType}</strong>
                    {viewType === 'custom' && customLabel && ` (${customLabel})`}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ordine:</span>{' '}
                    <strong>{sortOrder}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Canvas:</span>{' '}
                    <strong>{baseDims?.w}×{baseDims?.h}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Maschere:</span>{' '}
                    <strong>{zones.length}</strong>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Base</Label>
                <div className="border border-border rounded-md aspect-square bg-background overflow-hidden flex items-center justify-center">
                  {basePreviewUrl ? (
                    <img src={basePreviewUrl} alt="base" className="w-full h-full object-contain" />
                  ) : (
                    <ImageOff className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            {zones.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Maschere ({zones.length})</Label>
                <div className="grid grid-cols-4 gap-2">
                  {zones.map(z => (
                    <div key={z.localId} className="space-y-1">
                      <div className="border border-border rounded-md aspect-square bg-background overflow-hidden flex items-center justify-center">
                        {z.previewUrl ? (
                          <img src={z.previewUrl} alt={z.zoneType} className="w-full h-full object-contain" />
                        ) : (
                          <ImageOff className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-[11px] text-center text-muted-foreground truncate">
                        {z.label || z.zoneType}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {warnings.length > 0 && <WarningsBox warnings={warnings} />}
          </div>
        )}

        {/* Footer nav */}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1 || saving}
            className="gap-1.5"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Indietro
          </Button>
          {step < 4 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!canGoNext}
              className="gap-1.5"
            >
              Avanti <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Crea vista
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ===================== sub-components ===================== */

const FilePicker: React.FC<{
  file: File | null;
  previewUrl: string | null;
  onPick: (file: File) => void;
  accept: string;
  heightClass?: string;
}> = ({ file, previewUrl, onPick, accept, heightClass = 'h-32' }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <div
        className={`border-2 border-dashed border-border rounded-md ${heightClass} bg-background flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors`}
        onClick={() => inputRef.current?.click()}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="preview" className="w-full h-full object-contain" />
        ) : (
          <div className="text-center text-muted-foreground">
            <Upload className="h-6 w-6 mx-auto mb-1" />
            <p className="text-xs">Clicca per scegliere un file</p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
      {file && <p className="text-[11px] text-muted-foreground truncate">{file.name}</p>}
    </div>
  );
};

const ZoneRow: React.FC<{
  zone: DraftZone;
  index: number;
  onPatch: (p: Partial<DraftZone>) => void;
  onRemove: () => void;
  onFile: (file: File) => void;
  baseDims: { w: number; h: number } | null;
}> = ({ zone, index, onPatch, onRemove, onFile, baseDims }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dimMismatch =
    zone.naturalW && zone.naturalH && baseDims
      ? zone.naturalW !== baseDims.w || zone.naturalH !== baseDims.h
      : false;

  // Suggested zone_type options based on category
  const zoneOptions =
    zone.category === 'fabric'
      ? STANDARD_FABRIC_ZONES
      : zone.category === 'handle'
      ? STANDARD_HANDLE_ZONES
      : ['detail_zip', 'detail_metal', 'detail_logo', 'detail_other'];

  return (
    <div className="border border-border rounded-md p-2 bg-muted/20 grid grid-cols-12 gap-2 items-center">
      <div className="col-span-1 text-xs text-muted-foreground text-center">#{index + 1}</div>

      {/* Thumbnail */}
      <div
        className="col-span-2 border border-border rounded bg-background h-16 flex items-center justify-center overflow-hidden cursor-pointer relative"
        onClick={() => inputRef.current?.click()}
      >
        {zone.previewUrl ? (
          <img src={zone.previewUrl} alt={zone.zoneType} className="w-full h-full object-contain" />
        ) : (
          <Upload className="h-4 w-4 text-muted-foreground" />
        )}
        {dimMismatch && (
          <div className="absolute top-0.5 right-0.5">
            <AlertTriangle className="h-3 w-3 text-yellow-500 fill-yellow-500/30" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />

      {/* Category */}
      <div className="col-span-2">
        <Select
          value={zone.category}
          onValueChange={(v: ZoneCategory) =>
            onPatch({
              category: v,
              // reset zoneType to first option of new category
              zoneType:
                v === 'fabric'
                  ? STANDARD_FABRIC_ZONES[0]
                  : v === 'handle'
                  ? STANDARD_HANDLE_ZONES[0]
                  : 'detail_zip',
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fabric" className="text-xs">Tessuto</SelectItem>
            <SelectItem value="handle" className="text-xs">Manico</SelectItem>
            <SelectItem value="detail" className="text-xs">Dettaglio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Zone type */}
      <div className="col-span-3">
        <Select value={zone.zoneType} onValueChange={v => onPatch({ zoneType: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {zoneOptions.map(opt => (
              <SelectItem key={opt} value={opt} className="text-xs">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Label */}
      <div className="col-span-3">
        <Input
          value={zone.label}
          onChange={e => onPatch({ label: e.target.value })}
          placeholder="Etichetta (opz.)"
          className="h-8 text-xs"
        />
      </div>

      {/* Remove */}
      <div className="col-span-1 flex justify-end">
        <Button size="sm" variant="ghost" onClick={onRemove} className="h-8 w-8 p-0">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

const WarningsBox: React.FC<{ warnings: string[] }> = ({ warnings }) => (
  <div className="border border-yellow-500/40 bg-yellow-500/10 rounded-md p-3 space-y-1">
    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
      <AlertTriangle className="h-3.5 w-3.5" />
      <p className="text-xs font-medium">
        {warnings.length} avviso{warnings.length === 1 ? '' : 'i'} (non bloccante)
      </p>
    </div>
    <ul className="text-[11px] text-yellow-700 dark:text-yellow-400 list-disc pl-5 space-y-0.5">
      {warnings.map((w, i) => (
        <li key={i}>{w}</li>
      ))}
    </ul>
  </div>
);

/* ===================== utils ===================== */

function readImageDims(url: string): Promise<{ w: number; h: number }> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = url;
  });
}
