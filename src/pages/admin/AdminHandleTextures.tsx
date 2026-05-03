/**
 * AdminHandleTextures
 *
 * Pagina per caricare in batch PNG già pronti come "texture pattern" del manico.
 * Ogni file diventa una riga di handle_colors con texture_url valorizzato
 * (in alternativa a pattern_preset_id).
 *
 * Flusso:
 *  - Selezione handle (a quale tipo di manico appartengono le texture)
 *  - Drag & drop multiplo di PNG
 *  - Upload sequenziale su admin-assets/handle-textures/
 *  - Insert su handle_colors (color_name = nome file pulito)
 *  - Lista delle texture esistenti per quel manico, con preview e delete
 */

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uploadAsset } from '@/lib/uploadAsset';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Link } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Upload as UploadIcon, ImageIcon, Loader2 } from 'lucide-react';

interface HandleRow {
  id: string;
  name: string;
}

interface TextureRow {
  id: string;
  handle_id: string;
  color_name: string;
  texture_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const cleanName = (filename: string) =>
  filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();

const AdminHandleTextures: React.FC = () => {
  const qc = useQueryClient();
  const [selectedHandleId, setSelectedHandleId] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  const { data: handles } = useQuery({
    queryKey: ['handles-for-textures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('handles')
        .select('id, name')
        .order('sort_order');
      if (error) throw error;
      return data as HandleRow[];
    },
  });

  // Le texture caricate qui vivono in cord_collection (catalogo globale).
  // Filtriamo per compatibilità con il manico selezionato + style_type=texture.
  const { data: textures, isLoading: loadingTextures } = useQuery({
    queryKey: ['handle-textures-cords', selectedHandleId],
    enabled: !!selectedHandleId,
    queryFn: async () => {
      const { data: compat, error: e1 } = await supabase
        .from('cord_handle_compatibility')
        .select('cord_id')
        .eq('handle_id', selectedHandleId);
      if (e1) throw e1;
      const cordIds = (compat ?? []).map((r) => r.cord_id);
      if (cordIds.length === 0) return [] as TextureRow[];
      const { data, error } = await supabase
        .from('cord_collection')
        .select('id, name, texture_url, is_active, sort_order, style_type')
        .in('id', cordIds)
        .eq('style_type', 'texture')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        handle_id: selectedHandleId,
        color_name: r.name,
        texture_url: r.texture_url,
        is_active: r.is_active,
        sort_order: r.sort_order,
      })) as TextureRow[];
    },
  });

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!selectedHandleId) {
        toast.error('Seleziona prima un manico');
        return;
      }
      const validFiles = files.filter((f) => f.type.startsWith('image/'));
      if (validFiles.length === 0) {
        toast.error('Nessun file immagine valido');
        return;
      }

      setUploadProgress({ done: 0, total: validFiles.length });
      const baseSort = textures?.length ?? 0;
      let success = 0;
      let failed = 0;

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        try {
          const url = await uploadAsset(file, 'handle-textures', file.name);
          // 1) crea la corda nel catalogo globale
          const { data: cord, error: cordErr } = await supabase
            .from('cord_collection')
            .insert({
              name: cleanName(file.name),
              style_type: 'texture',
              texture_url: url,
              sort_order: baseSort + i,
              is_active: true,
            })
            .select('id')
            .single();
          if (cordErr) throw cordErr;
          // 2) abilita immediatamente per il manico selezionato
          const { error: compatErr } = await supabase
            .from('cord_handle_compatibility')
            .insert({ cord_id: cord.id, handle_id: selectedHandleId });
          if (compatErr) throw compatErr;
          success++;
        } catch (e) {
          console.error('Upload failed for', file.name, e);
          failed++;
        }
        setUploadProgress({ done: i + 1, total: validFiles.length });
      }

      setUploadProgress(null);
      qc.invalidateQueries({ queryKey: ['handle-textures-cords', selectedHandleId] });
      qc.invalidateQueries({ queryKey: ['cord-collection'] });

      if (success > 0) toast.success(`${success} texture caricate nel catalogo corde`);
      if (failed > 0) toast.error(`${failed} upload falliti`);
    },
    [selectedHandleId, textures, qc]
  );

  const deleteTexture = useMutation({
    mutationFn: async (id: string) => {
      // elimina dal catalogo globale (cascade rimuove anche le compat)
      const { error } = await supabase.from('cord_collection').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handle-textures-cords', selectedHandleId] });
      qc.invalidateQueries({ queryKey: ['cord-collection'] });
      toast.success('Texture eliminata');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTexture = useMutation({
    mutationFn: async (patch: { id: string } & Partial<TextureRow>) => {
      const { id, color_name, is_active, sort_order } = patch;
      const update: {
        name?: string;
        is_active?: boolean;
        sort_order?: number;
      } = {};
      if (color_name !== undefined) update.name = color_name;
      if (is_active !== undefined) update.is_active = is_active;
      if (sort_order !== undefined) update.sort_order = sort_order;
      const { error } = await supabase.from('cord_collection').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handle-textures-cords', selectedHandleId] });
      qc.invalidateQueries({ queryKey: ['cord-collection'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    void uploadFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    void uploadFiles(files);
    e.target.value = '';
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <div className="text-xs text-muted-foreground border border-border rounded-md p-3 bg-muted/20">
        Carica PNG di texture manico (es. fotografie del tessuto a righe). Ogni
        file diventa un colore selezionabile dall'utente, mappato sulla
        centerline del manico al posto del pattern matematico.
      </div>

      {handles && handles.length === 0 ? (
        <div className="border border-border bg-muted/30 rounded-md p-4 space-y-2">
          <p className="text-sm font-medium text-foreground">
            Nessun manico in catalogo
          </p>
          <p className="text-xs text-muted-foreground">
            Per caricare le texture devi prima creare almeno un tipo di manico
            (es. "Manico tracolla", "Manico corto pelle"). Le texture verranno
            associate a quel manico.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/handle-styles?tab=types">Vai a Tipi di manico → crea il primo</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Manico di destinazione</Label>
            <Select value={selectedHandleId} onValueChange={setSelectedHandleId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleziona un manico…" />
              </SelectTrigger>
              <SelectContent>
                {handles?.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            {textures?.length ?? 0} texture caricate
          </div>
        </div>
      )}

      {/* Dropzone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        } ${!selectedHandleId ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileInput}
          className="hidden"
          disabled={!selectedHandleId || !!uploadProgress}
        />
        <UploadIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">
          Trascina qui i PNG delle texture, oppure clicca per selezionarli
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Upload multiplo · il nome del file diventa il nome del colore
        </p>
        {uploadProgress && (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Caricamento {uploadProgress.done}/{uploadProgress.total}…
          </div>
        )}
      </label>

      {/* Griglia texture esistenti */}
      {selectedHandleId && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Texture esistenti
          </Label>
          {loadingTextures && (
            <p className="text-xs text-muted-foreground">Caricamento…</p>
          )}
          {!loadingTextures && (textures?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
              Nessuna texture per questo manico.
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {textures?.map((t) => (
              <div
                key={t.id}
                className="border border-border rounded-md overflow-hidden bg-muted/20 group"
              >
                <div className="aspect-[2/3] bg-checkered relative overflow-hidden">
                  {t.texture_url ? (
                    <img
                      src={t.texture_url}
                      alt={t.color_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-2 space-y-1.5">
                  <Input
                    value={t.color_name}
                    onChange={(e) =>
                      updateTexture.mutate({ id: t.id, color_name: e.target.value })
                    }
                    className="h-7 text-xs"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={t.is_active}
                        onCheckedChange={(v) =>
                          updateTexture.mutate({ id: t.id, is_active: v })
                        }
                      />
                      <span className="text-[10px] text-muted-foreground">Attiva</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        if (confirm(`Eliminare "${t.color_name}"?`))
                          deleteTexture.mutate(t.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHandleTextures;
