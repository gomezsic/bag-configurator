/**
 * HandleSideLoopUploader
 *
 * Pannello per caricare le maschere delle fettuccine laterali (side loops).
 * Supporta DUE modalità:
 *  - "PNG unico" → un solo file contiene già sia la fettuccina sinistra che
 *    la destra; lo stesso URL viene scritto su entrambi i record
 *    (side_loop_left + side_loop_right). Caso più comune.
 *  - "PNG separati" → file distinti per left e right.
 *
 * Le centerline restano comunque indipendenti (left/right) e si modificano
 * dal selettore in alto della pagina editor.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { uploadAsset } from '@/lib/uploadAsset';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';

type PartId = 'side_loop_left' | 'side_loop_right';

interface SideLoopRow {
  id: string;
  part_id: string;
  mask_url: string | null;
  shadow_url: string | null;
  highlight_url: string | null;
}

interface Props {
  geometryId: string;
}

const PART_IDS: PartId[] = ['side_loop_left', 'side_loop_right'];

const HandleSideLoopUploader: React.FC<Props> = ({ geometryId }) => {
  const [rows, setRows] = useState<SideLoopRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'shared' | 'split'>('shared');
  const sharedInputRef = useRef<HTMLInputElement>(null);
  const leftInputRef = useRef<HTMLInputElement>(null);
  const rightInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('handle_side_parts')
      .select('id, part_id, mask_url, shadow_url, highlight_url')
      .eq('handle_geometry_id', geometryId);
    if (error) {
      console.error(error);
      return;
    }
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryId]);

  const left = useMemo(() => rows.find((r) => r.part_id === 'side_loop_left') ?? null, [rows]);
  const right = useMemo(() => rows.find((r) => r.part_id === 'side_loop_right') ?? null, [rows]);

  /** Garantisce che esista un record per il partId richiesto, lo restituisce. */
  const ensureRow = async (partId: PartId): Promise<SideLoopRow> => {
    const existing = rows.find((r) => r.part_id === partId);
    if (existing) return existing;
    const { data, error } = await supabase
      .from('handle_side_parts')
      .insert({
        handle_geometry_id: geometryId,
        part_id: partId,
        path_json: { paths: [] },
        sort_order: partId === 'side_loop_left' ? 0 : 1,
      })
      .select('id, part_id, mask_url, shadow_url, highlight_url')
      .single();
    if (error) throw error;
    return data as SideLoopRow;
  };

  const writeMask = async (partId: PartId, url: string | null) => {
    const row = await ensureRow(partId);
    const { error } = await supabase
      .from('handle_side_parts')
      .update({ mask_url: url })
      .eq('id', row.id);
    if (error) throw error;
  };

  /** Upload condiviso: stesso PNG su entrambe le parti. */
  const handleSharedFile = async (file: File) => {
    try {
      setBusy(true);
      const url = await uploadAsset(file, `handles/${geometryId}/side`, `side_loops_shared_mask`);
      await Promise.all(PART_IDS.map((p) => writeMask(p, url)));
      toast.success('Fettuccine laterali caricate (PNG unico)');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Errore upload fettuccine');
    } finally {
      setBusy(false);
      if (sharedInputRef.current) sharedInputRef.current.value = '';
    }
  };

  /** Upload separato per una singola parte. */
  const handleSplitFile = async (partId: PartId, file: File) => {
    try {
      setBusy(true);
      const url = await uploadAsset(file, `handles/${geometryId}/side`, `${partId}_mask`);
      await writeMask(partId, url);
      toast.success(`${partId === 'side_loop_left' ? 'Sinistra' : 'Destra'} caricata`);
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Errore upload');
    } finally {
      setBusy(false);
      if (leftInputRef.current) leftInputRef.current.value = '';
      if (rightInputRef.current) rightInputRef.current.value = '';
    }
  };

  const handleClearAll = async () => {
    try {
      setBusy(true);
      await Promise.all(PART_IDS.map((p) => writeMask(p, null)));
      toast.success('Maschere fettuccine rimosse');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Errore');
    } finally {
      setBusy(false);
    }
  };

  // Detect se left e right puntano allo stesso URL → modalità shared
  const sharedUrl = left?.mask_url && left.mask_url === right?.mask_url ? left.mask_url : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
          Fettuccine laterali
        </h3>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={mode === 'shared' ? 'default' : 'outline'}
            className="h-6 text-[10px] px-2"
            onClick={() => setMode('shared')}
          >
            PNG unico
          </Button>
          <Button
            size="sm"
            variant={mode === 'split' ? 'default' : 'outline'}
            className="h-6 text-[10px] px-2"
            onClick={() => setMode('split')}
          >
            Separati
          </Button>
        </div>
      </div>

      {mode === 'shared' ? (
        <div className="border border-border rounded-md p-2 bg-card flex items-center gap-3">
          <div className="w-16 h-16 bg-muted rounded overflow-hidden flex items-center justify-center shrink-0">
            {sharedUrl ? (
              <img src={sharedUrl} alt="Side loops" className="w-full h-full object-contain" />
            ) : (
              <span className="text-[10px] text-muted-foreground">vuoto</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Label className="text-xs font-medium">Sinistra + Destra (un solo file)</Label>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              Il PNG contiene entrambe le fettuccine. Stesso URL su left e right.
            </p>
            <div className="flex gap-1 mt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                disabled={busy}
                onClick={() => sharedInputRef.current?.click()}
              >
                <Upload className="h-3 w-3" />
                {sharedUrl ? 'Sostituisci' : 'Carica PNG'}
              </Button>
              {(left?.mask_url || right?.mask_url) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  disabled={busy}
                  onClick={handleClearAll}
                  title="Rimuovi entrambe"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <input
              ref={sharedInputRef}
              type="file"
              accept="image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSharedFile(f);
              }}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {(['side_loop_left', 'side_loop_right'] as PartId[]).map((pid) => {
            const row = pid === 'side_loop_left' ? left : right;
            const value = row?.mask_url ?? null;
            const ref = pid === 'side_loop_left' ? leftInputRef : rightInputRef;
            const label = pid === 'side_loop_left' ? 'Side loop left' : 'Side loop right';
            return (
              <div
                key={pid}
                className="border border-border rounded-md p-2 bg-card flex items-center gap-3"
              >
                <div className="w-16 h-16 bg-muted rounded overflow-hidden flex items-center justify-center shrink-0">
                  {value ? (
                    <img src={value} alt={label} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">vuoto</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Label className="text-xs font-medium">{label}</Label>
                  <div className="flex gap-1 mt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      disabled={busy}
                      onClick={() => ref.current?.click()}
                    >
                      <Upload className="h-3 w-3" />
                      {value ? 'Sostituisci' : 'Carica'}
                    </Button>
                    {value && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        disabled={busy}
                        onClick={() => writeMask(pid, null).then(load)}
                        title="Rimuovi"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <input
                    ref={ref}
                    type="file"
                    accept="image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSplitFile(pid, f);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HandleSideLoopUploader;
