/**
 * AdminHandles
 *
 * Lista dei manici (entità di catalogo). Ogni manico è un "tipo" (es. "Manico
 * lungo a tracolla") che può essere associato a uno o più preset di righe
 * (handle_pattern_presets) tramite la tabella handle_colors.
 *
 * NOTA: il vecchio sistema basato su mapping_id/stripe_count/pattern_scale è
 * stato rimosso. La gestione di geometria (centerline + maschera) si fa nel
 * nuovo /admin/handle-editor/:viewId. I preset di righe in /admin/handle-presets.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';

interface HandleRow {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  is_active: boolean;
  sort_order: number;
}

const AdminHandles: React.FC = () => {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');

  const { data: handles, isLoading } = useQuery({
    queryKey: ['handles-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('handles')
        .select('id, name, slug, category, is_active, sort_order')
        .order('sort_order');
      if (error) throw error;
      return data as HandleRow[];
    },
  });

  const addHandle = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { error } = await supabase.from('handles').insert({
        name,
        slug,
        sort_order: handles?.length ?? 0,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handles-admin'] });
      setNewName('');
      toast.success('Manico creato');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateHandle = useMutation({
    mutationFn: async (h: Partial<HandleRow> & { id: string }) => {
      const { id, ...rest } = h;
      const { error } = await supabase.from('handles').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handles-admin'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteHandle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('handles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handles-admin'] });
      toast.success('Manico eliminato');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 space-y-4 max-w-3xl">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Nuovo manico</Label>
          <Input
            placeholder="Es. Manico tracolla lungo"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="h-9"
          />
        </div>
        <Button
          onClick={() => addHandle.mutate(newName.trim())}
          disabled={!newName.trim() || addHandle.isPending}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Aggiungi
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        I preset di colori/righe si gestiscono in <strong>Preset righe</strong>.
        La geometria (centerline + maschera + overlay) si edita per ogni vista
        della borsa nella sezione <strong>Modelli borsa → Editor manico</strong>.
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Caricamento…</p>}

      <div className="space-y-2">
        {handles?.map(h => (
          <div key={h.id} className="border border-border rounded-md p-3 flex items-center gap-3 bg-muted/20">
            <Input
              value={h.name}
              onChange={e => updateHandle.mutate({ id: h.id, name: e.target.value })}
              className="h-8 flex-1"
            />
            <Input
              value={h.category ?? ''}
              placeholder="Categoria"
              onChange={e => updateHandle.mutate({ id: h.id, category: e.target.value })}
              className="h-8 w-40"
            />
            <div className="flex items-center gap-1.5">
              <Switch
                checked={h.is_active}
                onCheckedChange={v => updateHandle.mutate({ id: h.id, is_active: v })}
              />
              <Label className="text-xs">Attivo</Label>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (confirm(`Eliminare "${h.name}"?`)) deleteHandle.mutate(h.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {handles?.length === 0 && (
          <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
            Nessun manico in catalogo.
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminHandles;
