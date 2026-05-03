/**
 * MaskSlotUploader
 *
 * Uploader "a slot" per il nuovo flusso semplificato di import borsa.
 * 7 slot fissi (1 originale + 6 maschere autoritative).
 *
 * Funzionamento:
 *  - Drag-drop di una cartella o di un set di file → autoassegnazione per nome
 *  - Drag-drop su singolo slot → assegnazione manuale
 *  - Click su slot → file picker per quello slot
 *  - Conferma → commit verso bag_view + mask_zones
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  Upload,
  X,
  AlertCircle,
  Play,
  ImageIcon,
  Folder,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  SLOT_DEFINITIONS,
  emptySlotState,
  autoAssignFiles,
  detectSlotForFile,
  commitSlotImport,
  type SlotKey,
  type SlotState,
  type SlotCommitProgress,
  type SlotCommitResult,
  type SlotCommitTarget,
} from '@/lib/maskSlotImport';

interface Props {
  target: SlotCommitTarget;
  onCompleted?: (r: SlotCommitResult) => void;
}

interface SlotPreview {
  url: string;
  width?: number;
  height?: number;
}

const MaskSlotUploader: React.FC<Props> = ({ target, onCompleted }) => {
  const [slots, setSlots] = useState<SlotState>(emptySlotState());
  const [previews, setPreviews] = useState<Record<SlotKey, SlotPreview | null>>(
    () =>
      SLOT_DEFINITIONS.reduce((acc, s) => {
        acc[s.key] = null;
        return acc;
      }, {} as Record<SlotKey, SlotPreview | null>),
  );
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress] = useState<SlotCommitProgress | null>(null);
  const [completed, setCompleted] = useState<SlotCommitResult | null>(null);
  const [globalDrag, setGlobalDrag] = useState(false);

  // Genera/cleanup preview URLs
  useEffect(() => {
    const next: Record<SlotKey, SlotPreview | null> = { ...previews };
    let dirty = false;
    for (const def of SLOT_DEFINITIONS) {
      const f = slots[def.key];
      const cur = previews[def.key];
      if (f && (!cur || (cur as { _file?: File } & SlotPreview)._file !== f)) {
        const url = URL.createObjectURL(f);
        const img = new Image();
        img.onload = () => {
          setPreviews((p) => ({
            ...p,
            [def.key]: {
              url,
              width: img.naturalWidth,
              height: img.naturalHeight,
              _file: f,
            } as SlotPreview & { _file: File },
          }));
        };
        img.src = url;
        next[def.key] = { url, _file: f } as SlotPreview & { _file: File };
        dirty = true;
      } else if (!f && cur) {
        URL.revokeObjectURL(cur.url);
        next[def.key] = null;
        dirty = true;
      }
    }
    if (dirty) setPreviews(next);
    // cleanup on unmount
    return () => {
      // noop: revokes managed by setPreviews above
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  const requiredOk = useMemo(
    () => SLOT_DEFINITIONS.filter((d) => d.required).every((d) => !!slots[d.key]),
  [slots]);
  const filledCount = useMemo(
    () => SLOT_DEFINITIONS.filter((d) => !!slots[d.key]).length,
    [slots],
  );

  const handleFilesBatch = useCallback(
    (files: File[]) => {
      const { next, assigned, unassigned } = autoAssignFiles(files, slots);
      setSlots(next);
      if (assigned.length > 0) {
        toast.success(
          `${assigned.length} file riconosciut${assigned.length === 1 ? 'o' : 'i'} e assegnat${assigned.length === 1 ? 'o' : 'i'}`,
        );
      }
      if (unassigned.length > 0) {
        toast.message(
          `${unassigned.length} file non riconosciut${unassigned.length === 1 ? 'o' : 'i'} dal nome`,
          { description: 'Trascina manualmente nello slot corretto' },
        );
      }
    },
    [slots],
  );

  const handleSlotFile = useCallback((key: SlotKey, file: File) => {
    setSlots((s) => ({ ...s, [key]: file }));
  }, []);

  const handleSlotClear = useCallback((key: SlotKey) => {
    setSlots((s) => ({ ...s, [key]: null }));
  }, []);

  const onGlobalDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setGlobalDrag(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        /\.(png|jpe?g|webp)$/i.test(f.name),
      );
      if (files.length > 0) handleFilesBatch(files);
    },
    [handleFilesBatch],
  );

  const onCommit = useCallback(async () => {
    if (!requiredOk) {
      toast.error('Compila tutti gli slot obbligatori');
      return;
    }
    setCommitting(true);
    setProgress(null);
    try {
      const result = await commitSlotImport(slots, target, setProgress);
      setCompleted(result);
      toast.success(
        `Import completato: ${result.uploadedFiles} file, ${result.zonesCreated} zone`,
      );
      onCompleted?.(result);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCommitting(false);
    }
  }, [requiredOk, slots, target, onCompleted]);

  const onReset = useCallback(() => {
    setSlots(emptySlotState());
    setCompleted(null);
    setProgress(null);
  }, []);

  if (completed) {
    return (
      <div className="border border-border rounded-lg p-6 bg-card space-y-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Importazione completata
            </h3>
            <p className="text-xs text-muted-foreground">
              {completed.uploadedFiles} file caricati ·{' '}
              {completed.zonesCreated} zone create ·{' '}
              {completed.baseImageUpdated ? 'originale aggiornato' : 'originale invariato'} ·{' '}
              {completed.handleMaskUploaded ? 'maschera manico aggiornata' : 'manico invariato'}
              {completed.staleHandleOverlaysCleared
                ? ' · overlay manico obsoleti rimossi'
                : ''}
              {completed.fallbackSidePartsApplied
                ? ` · ${completed.fallbackSidePartsApplied} fettuccine ricostruite da preset`
                : ''}
              {completed.rescaledHandlePath ? ' · path manico riscalato' : ''}
            </p>
          </div>
        </div>
        <Separator />
        <Button size="sm" variant="ghost" onClick={onReset} className="gap-1">
          <Upload className="h-3 w-3" /> Carica un altro set
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setGlobalDrag(true);
      }}
      onDragLeave={() => setGlobalDrag(false)}
      onDrop={onGlobalDrop}
      className={`space-y-4 rounded-lg p-4 transition-colors ${
        globalDrag ? 'bg-primary/5 ring-2 ring-primary' : ''
      }`}
    >
      {/* Header con bulk file picker */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium text-foreground">
            Trascina i 7 file qui (auto-riconoscimento dal nome)
          </p>
          <p className="text-xs text-muted-foreground">
            Oppure trascina ogni file nello slot corretto · {filledCount} / 7 compilati
          </p>
        </div>
        <div className="flex gap-2">
          <label>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesBatch(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
            <Button size="sm" variant="outline" asChild>
              <span className="cursor-pointer">
                <ImageIcon className="h-4 w-4 mr-1" /> Scegli file
              </span>
            </Button>
          </label>
          <label>
            <input
              type="file"
              multiple
              className="hidden"
              // @ts-expect-error webkitdirectory non in tipi standard
              webkitdirectory=""
              onChange={(e) => {
                if (e.target.files) handleFilesBatch(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
            <Button size="sm" variant="outline" asChild>
              <span className="cursor-pointer">
                <Folder className="h-4 w-4 mr-1" /> Cartella
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Griglia slot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {SLOT_DEFINITIONS.map((def) => (
          <SlotCard
            key={def.key}
            def={def}
            file={slots[def.key]}
            preview={previews[def.key]}
            onFile={(f) => handleSlotFile(def.key, f)}
            onClear={() => handleSlotClear(def.key)}
          />
        ))}
      </div>

      {/* Progress + commit */}
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

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {requiredOk ? (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Slot obbligatori compilati
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" /> Mancano slot obbligatori
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onReset} disabled={committing}>
            Svuota
          </Button>
          <Button
            size="sm"
            onClick={onCommit}
            disabled={!requiredOk || committing}
            className="gap-1"
          >
            <Play className="h-4 w-4" />
            {committing ? 'Importazione…' : 'Importa'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Card slot singolo ─────────────────────────────────────────────────────

interface SlotCardProps {
  def: typeof SLOT_DEFINITIONS[number];
  file: File | null;
  preview: SlotPreview | null;
  onFile: (file: File) => void;
  onClear: () => void;
}

const SlotCard: React.FC<SlotCardProps> = ({ def, file, preview, onFile, onClear }) => {
  const [drag, setDrag] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDrag(false);
      const f = Array.from(e.dataTransfer.files).find((ff) =>
        /\.(png|jpe?g|webp)$/i.test(ff.name),
      );
      if (f) onFile(f);
    },
    [onFile],
  );

  const detected = file ? detectSlotForFile(file) : null;
  const mismatch = file && detected && detected !== def.key;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={`relative border rounded-lg p-3 bg-card transition-colors ${
        drag
          ? 'border-primary ring-2 ring-primary'
          : file
            ? 'border-emerald-500/60'
            : def.required
              ? 'border-border'
              : 'border-dashed border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate flex items-center gap-1">
            {def.label}
            {def.required && <span className="text-destructive">*</span>}
          </p>
          <p className="text-[10px] text-muted-foreground line-clamp-1">
            {def.description}
          </p>
        </div>
        {file && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive shrink-0"
            aria-label="Rimuovi file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <label className="block cursor-pointer">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
        <div
          className={`aspect-square rounded border bg-muted/30 flex items-center justify-center overflow-hidden ${
            preview ? '' : 'border-dashed'
          }`}
        >
          {preview ? (
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url(${preview.url})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                // checker pattern dietro per visualizzare alpha
                backgroundColor: '#fff',
              }}
            />
          ) : (
            <div className="text-center">
              <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Trascina o clicca</p>
            </div>
          )}
        </div>
      </label>

      {file && (
        <div className="mt-2 space-y-0.5">
          <p className="text-[10px] text-muted-foreground truncate" title={file.name}>
            {file.name}
          </p>
          {preview?.width && (
            <p className="text-[10px] text-muted-foreground font-mono">
              {preview.width}×{preview.height}
            </p>
          )}
          {mismatch && (
            <p className="text-[10px] text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" /> Nome suggerisce slot diverso
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MaskSlotUploader;
