/**
 * AdminModels
 *
 * CRUD per i modelli borsa con:
 * - lista modelli
 * - editor campi base + thumbnail upload
 * - editor viste (bag_views) con upload base image / overlay e dimensioni canvas
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Save, Upload } from 'lucide-react';
import { ThumbnailUpload } from '@/components/admin/ThumbnailUpload';
import { BagViewsEditor } from '@/components/admin/BagViewsEditor';
import OverlayZonesEditor from '@/components/admin/OverlayZonesEditor';
import FabricZonesEditor from '@/components/admin/FabricZonesEditor';

interface BagModel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  is_active: boolean;
  sort_order: number;
  thumbnail_url: string | null;
}

const emptyModel: Omit<BagModel, 'id'> = {
  name: '',
  slug: '',
  description: '',
  base_price: 0,
  is_active: true,
  sort_order: 0,
  thumbnail_url: null,
};

const AdminModels: React.FC = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BagModel | (Omit<BagModel, 'id'> & { id?: string }) | null>(
    null
  );

  const { data: models, isLoading } = useQuery({
    queryKey: ['admin-bag-models'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bag_models')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as BagModel[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (m: typeof editing) => {
      if (!m) return;
      if ('id' in m && m.id) {
        const { error } = await supabase
          .from('bag_models')
          .update({
            name: m.name,
            slug: m.slug,
            description: m.description,
            base_price: m.base_price,
            is_active: m.is_active,
            sort_order: m.sort_order,
            thumbnail_url: m.thumbnail_url,
          })
          .eq('id', m.id);
        if (error) throw error;
        return m.id;
      } else {
        const { data, error } = await supabase
          .from('bag_models')
          .insert({
            name: m.name,
            slug: m.slug,
            description: m.description,
            base_price: m.base_price,
            is_active: m.is_active,
            sort_order: m.sort_order,
            thumbnail_url: m.thumbnail_url,
          })
          .select('*')
          .single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: async (savedId) => {
      toast.success('Modello salvato');
      await qc.invalidateQueries({ queryKey: ['admin-bag-models'] });
      // Manteniamo aperto l'editor con l'id appena creato così l'utente
      // può subito caricare le viste neutre.
      if (savedId && (!editing || !('id' in editing) || !editing.id)) {
        const { data } = await supabase.from('bag_models').select('*').eq('id', savedId).single();
        if (data) setEditing(data as BagModel);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bag_models').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Modello eliminato');
      qc.invalidateQueries({ queryKey: ['admin-bag-models'] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editingHasId = !!(editing && 'id' in editing && editing.id);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {models?.length ?? 0} modelli totali. Per ogni modello puoi caricare la borsa neutra
          (base image) per ognuna delle viste.
        </p>
        <Button onClick={() => setEditing({ ...emptyModel })} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nuovo modello
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* List */}
        <div className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
          {models?.map(m => (
            <div
              key={m.id}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                editing && 'id' in editing && editing.id === m.id
                  ? 'border-primary bg-muted/50'
                  : 'border-border hover:border-muted-foreground'
              }`}
              onClick={() => setEditing(m)}
            >
              <div className="w-10 h-10 rounded-md bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center">
                {m.thumbnail_url ? (
                  <img src={m.thumbnail_url} alt={m.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">—</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {m.slug} · €{m.base_price} · {m.is_active ? 'attivo' : 'inattivo'}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={e => {
                  e.stopPropagation();
                  if (confirm(`Eliminare "${m.name}"?`)) remove.mutate(m.id);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        {/* Editor */}
        {editing && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-base font-semibold text-foreground">
                {editingHasId ? 'Modifica modello' : 'Nuovo modello'}
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Travel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={editing.slug}
                    onChange={e => setEditing({ ...editing, slug: e.target.value })}
                    placeholder="travel"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Textarea
                  value={editing.description ?? ''}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prezzo base (€)</Label>
                  <Input
                    type="number"
                    value={editing.base_price}
                    onChange={e =>
                      setEditing({ ...editing, base_price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ordine</Label>
                  <Input
                    type="number"
                    value={editing.sort_order}
                    onChange={e =>
                      setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <ThumbnailUpload
                label="Thumbnail modello (per step 1 configuratore)"
                url={editing.thumbnail_url}
                folder={`models/${editing.slug || 'misc'}/thumb`}
                onChange={url => setEditing({ ...editing, thumbnail_url: url })}
              />

              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.is_active}
                  onCheckedChange={v => setEditing({ ...editing, is_active: v })}
                />
                <Label>Attivo</Label>
              </div>

              <div className="flex gap-2 pt-2 flex-wrap">
                <Button
                  onClick={() => upsert.mutate(editing)}
                  disabled={upsert.isPending}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" /> Salva
                </Button>
                {editingHasId && (
                  <Button asChild variant="outline" className="gap-2">
                    <Link
                      to={`/admin/upload?bagModelId=${(editing as BagModel).id}&bagModelName=${encodeURIComponent(editing.name || editing.slug || 'borsa')}`}
                    >
                      <Upload className="h-4 w-4" /> Carica file (ZIP)
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Annulla
                </Button>
              </div>
            </div>

            {/* Viste: disponibili solo dopo che il modello è stato creato */}
            {editingHasId ? (
              <>
                <div className="bg-card border border-border rounded-xl p-5">
                  <BagViewsEditor
                    bagModelId={(editing as BagModel).id}
                    modelSlug={editing.slug || 'misc'}
                  />
                </div>
                <div className="bg-card border border-border rounded-xl p-5">
                  <FabricZonesEditor
                    bagModelId={(editing as BagModel).id}
                    modelSlug={editing.slug || 'misc'}
                  />
                </div>
                <div className="bg-card border border-border rounded-xl p-5">
                  <OverlayZonesEditor
                    bagModelId={(editing as BagModel).id}
                    modelSlug={editing.slug || 'misc'}
                  />
                </div>
              </>
            ) : (
              <div className="bg-muted/30 border border-dashed border-border rounded-xl p-5 text-center text-sm text-muted-foreground">
                Salva prima il modello per poter aggiungere le viste e caricare la borsa neutra.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminModels;
