/**
 * CordCollectionManager
 *
 * Gestione del catalogo globale "corde/stili manico":
 *  - lista corde con preview, attivazione, eliminazione, riordino-by-sort
 *  - creazione: scegli style_type (texture upload | pattern_preset esistente)
 *  - per ciascuna corda: chip multi-select dei tipi di manico su cui è abilitata
 *
 * Le corde NON sono legate a un singolo manico: la mappa molti-a-molti vive in
 * cord_handle_compatibility ed è gestita inline su ogni riga.
 */

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uploadAsset } from '@/lib/uploadAsset';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Trash2, Plus, ImageIcon, Loader2 } from 'lucide-react';

interface HandleRow {
  id: string;
  name: string;
}

interface PresetRow {
  id: string;
  name: string;
}

interface CordRow {
  id: string;
  name: string;
  thumbnail_url: string | null;
  style_type: 'texture' | 'pattern_preset';
  texture_url: string | null;
  pattern_preset_id: string | null;
  is_active: boolean;
  sort_order: number;
}

interface CompatRow {
  cord_id: string;
  handle_id: string;
}

const CordCollectionManager: React.FC = () => {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: cords, isLoading } = useQuery({
    queryKey: ['cord-collection'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cord_collection')
        .select('id, name, thumbnail_url, style_type, texture_url, pattern_preset_id, is_active, sort_order')
        .order('sort_order');
      if (error) throw error;
      return data as CordRow[];
    },
  });

  const { data: handles } = useQuery({
    queryKey: ['handles-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('handles')
        .select('id, name')
        .order('sort_order');
      if (error) throw error;
      return data as HandleRow[];
    },
  });

  const { data: presets } = useQuery({
    queryKey: ['handle-presets-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('handle_pattern_presets')
        .select('id, name')
        .order('sort_order');
      if (error) throw error;
      return data as PresetRow[];
    },
  });

  const { data: compat } = useQuery({
    queryKey: ['cord-compat'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cord_handle_compatibility')
        .select('cord_id, handle_id');
      if (error) throw error;
      return data as CompatRow[];
    },
  });

  const compatByCord = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (compat ?? []).forEach((c) => {
      if (!map.has(c.cord_id)) map.set(c.cord_id, new Set());
      map.get(c.cord_id)!.add(c.handle_id);
    });
    return map;
  }, [compat]);

  const updateCord = useMutation({
    mutationFn: async (patch: { id: string } & Partial<CordRow>) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from('cord_collection').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cord-collection'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCord = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cord_collection').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cord-collection'] });
      qc.invalidateQueries({ queryKey: ['cord-compat'] });
      toast.success('Corda eliminata');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCompat = useMutation({
    mutationFn: async ({
      cordId,
      handleId,
      enable,
    }: {
      cordId: string;
      handleId: string;
      enable: boolean;
    }) => {
      if (enable) {
        const { error } = await supabase
          .from('cord_handle_compatibility')
          .insert({ cord_id: cordId, handle_id: handleId });
        if (error && !error.message.includes('duplicate')) throw error;
      } else {
        const { error } = await supabase
          .from('cord_handle_compatibility')
          .delete()
          .eq('cord_id', cordId)
          .eq('handle_id', handleId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cord-compat'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {cords?.length ?? 0} corde nel catalogo · {handles?.length ?? 0} tipi di manico disponibili
        </div>
        <CreateCordDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          presets={presets ?? []}
          handles={handles ?? []}
          nextSort={cords?.length ?? 0}
        />
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Caricamento…</p>}

      {!isLoading && (cords?.length ?? 0) === 0 && (
        <div className="border border-dashed border-border rounded-md p-8 text-center text-sm text-muted-foreground">
          Nessuna corda nel catalogo. Crea la prima con il pulsante "Nuova corda".
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cords?.map((c) => {
          const enabledHandles = compatByCord.get(c.id) ?? new Set<string>();
          return (
            <div key={c.id} className="border border-border rounded-md overflow-hidden bg-card">
              <div className="aspect-[3/2] bg-muted/30 relative">
                {c.texture_url || c.thumbnail_url ? (
                  <img
                    src={c.texture_url ?? c.thumbnail_url ?? ''}
                    alt={c.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <Badge
                  variant="secondary"
                  className="absolute top-2 left-2 text-[10px] uppercase"
                >
                  {c.style_type === 'texture' ? 'Texture' : 'Pattern'}
                </Badge>
              </div>

              <div className="p-2.5 space-y-2">
                <Input
                  value={c.name}
                  onChange={(e) => updateCord.mutate({ id: c.id, name: e.target.value })}
                  className="h-7 text-xs font-medium"
                />

                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Manici compatibili
                  </Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {handles?.map((h) => {
                      const enabled = enabledHandles.has(h.id);
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() =>
                            toggleCompat.mutate({
                              cordId: c.id,
                              handleId: h.id,
                              enable: !enabled,
                            })
                          }
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            enabled
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                          }`}
                        >
                          {h.name}
                        </button>
                      );
                    })}
                    {(handles?.length ?? 0) === 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        Crea prima un manico in Catalogo → Manici
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={c.is_active}
                      onCheckedChange={(v) =>
                        updateCord.mutate({ id: c.id, is_active: v })
                      }
                    />
                    <span className="text-[10px] text-muted-foreground">Attiva</span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      if (confirm(`Eliminare "${c.name}"?`)) deleteCord.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Dialog di creazione ─────────────────────────────────────────────────────

interface CreateProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  presets: PresetRow[];
  handles: HandleRow[];
  nextSort: number;
}

const CreateCordDialog: React.FC<CreateProps> = ({
  open,
  onOpenChange,
  presets,
  handles,
  nextSort,
}) => {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [styleType, setStyleType] = useState<'texture' | 'pattern_preset'>('texture');
  const [presetId, setPresetId] = useState<string>('');
  const [textureFile, setTextureFile] = useState<File | null>(null);
  const [selectedHandles, setSelectedHandles] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setStyleType('texture');
    setPresetId('');
    setTextureFile(null);
    setSelectedHandles(new Set());
  };

  const submit = async () => {
    if (!name.trim()) return toast.error('Inserisci un nome');
    if (styleType === 'texture' && !textureFile) return toast.error('Seleziona un PNG');
    if (styleType === 'pattern_preset' && !presetId) return toast.error('Seleziona un preset');

    setBusy(true);
    try {
      let textureUrl: string | null = null;
      if (styleType === 'texture' && textureFile) {
        textureUrl = await uploadAsset(textureFile, 'cord-textures', textureFile.name);
      }

      const { data: cord, error } = await supabase
        .from('cord_collection')
        .insert({
          name: name.trim(),
          style_type: styleType,
          texture_url: textureUrl,
          pattern_preset_id: styleType === 'pattern_preset' ? presetId : null,
          sort_order: nextSort,
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (selectedHandles.size > 0 && cord) {
        const rows = Array.from(selectedHandles).map((handleId) => ({
          cord_id: cord.id,
          handle_id: handleId,
        }));
        const { error: cErr } = await supabase
          .from('cord_handle_compatibility')
          .insert(rows);
        if (cErr) throw cErr;
      }

      toast.success('Corda creata');
      qc.invalidateQueries({ queryKey: ['cord-collection'] });
      qc.invalidateQueries({ queryKey: ['cord-compat'] });
      reset();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore creazione';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Nuova corda
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuova corda nel catalogo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Corda rossa a righe"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Tipo stile</Label>
            <Select value={styleType} onValueChange={(v) => setStyleType(v as 'texture' | 'pattern_preset')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="texture">Texture (upload PNG)</SelectItem>
                <SelectItem value="pattern_preset">Pattern matematico (preset righe)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {styleType === 'texture' ? (
            <div className="space-y-1">
              <Label className="text-xs">File PNG</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setTextureFile(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Preset righe</Label>
              <Select value={presetId} onValueChange={setPresetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un preset…" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {presets.length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Nessun preset. Creane uno nel tab "Pattern righe".
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Manici compatibili (opzionale, modificabile dopo)</Label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto p-2 border border-border rounded-md">
              {handles.map((h) => {
                const on = selectedHandles.has(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      const next = new Set(selectedHandles);
                      if (on) next.delete(h.id);
                      else next.add(h.id);
                      setSelectedHandles(next);
                    }}
                    className={`text-xs px-2 py-1 rounded-full border ${
                      on
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/30 border-border hover:bg-muted'
                    }`}
                  >
                    {h.name}
                  </button>
                );
              })}
              {handles.length === 0 && (
                <span className="text-[10px] text-muted-foreground">
                  Nessun manico ancora.
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Annulla
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Crea corda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CordCollectionManager;
