/**
 * AdminFabrics
 *
 * CRUD per i tessuti del catalogo (tabella `fabrics`).
 * Per ogni tessuto: nome, slug, categoria, texture seamless, thumbnail,
 * pattern_scale, repeat_mode, price_modifier, is_active, sort_order.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, Save } from 'lucide-react';
import { ThumbnailUpload } from '@/components/admin/ThumbnailUpload';
import { TextureRepeatPreview } from '@/components/admin/TextureRepeatPreview';
import { TextureStudio } from '@/components/admin/TextureStudio';
import { FabricColorsEditor } from '@/components/admin/FabricColorsEditor';

interface Fabric {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  texture_url: string | null;
  thumbnail_url: string | null;
  pattern_scale: number;
  repeat_mode: string;
  price_modifier: number;
  is_active: boolean;
  sort_order: number;
}

const emptyFabric: Omit<Fabric, 'id'> = {
  name: '',
  slug: '',
  category: '',
  texture_url: null,
  thumbnail_url: null,
  pattern_scale: 1.0,
  repeat_mode: 'repeat',
  price_modifier: 0,
  is_active: true,
  sort_order: 0,
};

/** Trasforma un nome in slug url-safe: "Velluto Beige!" → "velluto-beige". */
function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Garantisce slug unico: se già usato, appende -2, -3, ... */
function uniqueSlug(base: string, taken: Set<string>): string {
  let s = base || 'tessuto';
  if (!taken.has(s)) return s;
  let i = 2;
  while (taken.has(`${s}-${i}`)) i++;
  return `${s}-${i}`;
}

const AdminFabrics: React.FC = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Fabric | (Omit<Fabric, 'id'> & { id?: string }) | null>(
    null
  );
  const [studioOpen, setStudioOpen] = useState(false);

  const { data: fabrics, isLoading } = useQuery({
    queryKey: ['admin-fabrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fabrics')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as Fabric[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (f: typeof editing) => {
      if (!f) return;
      const trimmedName = (f.name ?? '').trim();
      if (!trimmedName) {
        throw new Error('Inserisci un nome per il tessuto prima di salvare.');
      }
      // Auto-slug: se vuoto deriva dal nome; se duplicato aggiungi suffisso.
      const currentId = 'id' in f && f.id ? f.id : null;
      const taken = new Set(
        (fabrics ?? []).filter(x => x.id !== currentId).map(x => x.slug).filter(Boolean)
      );
      let finalSlug = slugify(f.slug || f.name);
      if (!finalSlug) finalSlug = 'tessuto';
      finalSlug = uniqueSlug(finalSlug, taken);

      const payload = {
        name: trimmedName,
        slug: finalSlug,
        category: f.category,
        texture_url: f.texture_url,
        thumbnail_url: f.thumbnail_url,
        pattern_scale: f.pattern_scale,
        repeat_mode: f.repeat_mode,
        price_modifier: f.price_modifier,
        is_active: f.is_active,
        sort_order: f.sort_order,
      };
      if (currentId) {
        const { error } = await supabase.from('fabrics').update(payload).eq('id', currentId);
        if (error) throw error;
        return currentId;
      } else {
        const { data, error } = await supabase
          .from('fabrics')
          .insert(payload)
          .select('*')
          .single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: async (savedId) => {
      toast.success('Tessuto salvato');
      await qc.invalidateQueries({ queryKey: ['admin-fabrics'] });
      if (savedId && (!editing || !('id' in editing) || !editing.id)) {
        const { data } = await supabase.from('fabrics').select('*').eq('id', savedId).single();
        if (data) setEditing(data as Fabric);
      }
    },
    onError: (e: Error) => {
      const msg = /duplicate key|fabrics_slug_key/i.test(e.message)
        ? 'Slug già usato da un altro tessuto. Modifica il nome o lo slug.'
        : e.message;
      toast.error(msg);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fabrics').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tessuto eliminato');
      qc.invalidateQueries({ queryKey: ['admin-fabrics'] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editingHasId = !!(editing && 'id' in editing && editing.id);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {fabrics?.length ?? 0} tessuti totali. La <strong>texture</strong> deve essere un PNG/JPG{' '}
          <em>seamless</em> (usa Texture Lab se serve renderla tale). La{' '}
          <strong>thumbnail</strong> è l'anteprima 200×200 mostrata nel configuratore.
        </p>
        <Button onClick={() => setEditing({ ...emptyFabric })} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nuovo tessuto
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* List */}
        <div className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
          {fabrics?.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">Nessun tessuto. Creane uno nuovo.</p>
          )}
          {fabrics?.map(f => (
            <div
              key={f.id}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                editing && 'id' in editing && editing.id === f.id
                  ? 'border-primary bg-muted/50'
                  : 'border-border hover:border-muted-foreground'
              }`}
              onClick={() => setEditing(f)}
            >
              <div className="w-10 h-10 rounded-md bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center">
                {f.thumbnail_url || f.texture_url ? (
                  <img
                    src={f.thumbnail_url || f.texture_url || ''}
                    alt={f.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] text-muted-foreground">—</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${f.name?.trim() ? 'text-foreground' : 'italic text-muted-foreground'}`}>
                  {f.name?.trim() || '(senza nome — clicca per modificare)'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {f.slug}
                  {f.category ? ` · ${f.category}` : ''} · scala {f.pattern_scale}{' '}
                  · {f.is_active ? 'attivo' : 'inattivo'}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={e => {
                  e.stopPropagation();
                  if (confirm(`Eliminare "${f.name}"?`)) remove.mutate(f.id);
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
                {editingHasId ? 'Modifica tessuto' : 'Nuovo tessuto'}
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={editing.name}
                    onChange={e => {
                      const name = e.target.value;
                      // Autogenera slug se vuoto o se non è ancora stato salvato
                      const isNew = !('id' in editing) || !editing.id;
                      const shouldAutoSlug = isNew && (!editing.slug || editing.slug === slugify(editing.name));
                      setEditing({
                        ...editing,
                        name,
                        slug: shouldAutoSlug ? slugify(name) : editing.slug,
                      });
                    }}
                    placeholder="Cotone Naturale"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={editing.slug}
                    onChange={e => setEditing({ ...editing, slug: slugify(e.target.value) })}
                    placeholder="auto dal nome"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Input
                    value={editing.category ?? ''}
                    onChange={e => setEditing({ ...editing, category: e.target.value })}
                    placeholder="cotone, lino, neoprene..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modificatore prezzo (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.price_modifier}
                    onChange={e =>
                      setEditing({ ...editing, price_modifier: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Scala pattern</Label>
                  <Input
                    type="number"
                    step="0.05"
                    value={editing.pattern_scale}
                    onChange={e =>
                      setEditing({
                        ...editing,
                        pattern_scale: parseFloat(e.target.value) || 1.0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Repeat mode</Label>
                  <Select
                    value={editing.repeat_mode}
                    onValueChange={v => setEditing({ ...editing, repeat_mode: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="repeat">repeat (tile)</SelectItem>
                      <SelectItem value="cover">cover (single)</SelectItem>
                      <SelectItem value="contain">contain</SelectItem>
                    </SelectContent>
                  </Select>
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
                label="Texture seamless (1024×1024 consigliato, è quella applicata sulla borsa)"
                url={editing.texture_url}
                folder={`fabrics/${editing.slug || 'misc'}/texture`}
                onChange={url => setEditing({ ...editing, texture_url: url })}
              />

              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  Editor inline: <strong className="text-foreground">crop, sposta, taglia, cuci</strong>
                  {' '}per rendere la texture seamless senza uscire da qui.
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStudioOpen(o => !o)}
                  disabled={!editing.texture_url}
                >
                  {studioOpen ? 'Chiudi Studio' : 'Apri Texture Studio'}
                </Button>
              </div>

              {studioOpen && editing.texture_url && (
                <TextureStudio
                  sourceUrl={editing.texture_url}
                  folder={`fabrics/${editing.slug || 'misc'}/texture`}
                  onSaved={url => setEditing({ ...editing, texture_url: url })}
                  onClose={() => setStudioOpen(false)}
                />
              )}

              <TextureRepeatPreview
                url={editing.texture_url}
                patternScale={editing.pattern_scale}
                repeatMode={editing.repeat_mode}
              />

              {editingHasId && (editing as Fabric).id && (
                <FabricColorsEditor
                  parentFabric={{
                    id: (editing as Fabric).id,
                    name: editing.name,
                    slug: editing.slug,
                    category: editing.category,
                    pattern_scale: editing.pattern_scale,
                    repeat_mode: editing.repeat_mode,
                    price_modifier: editing.price_modifier,
                  }}
                  grayscaleTextureUrl={editing.texture_url}
                />
              )}

              <ThumbnailUpload
                label="Thumbnail (anteprima 200×200 nel configuratore)"
                url={editing.thumbnail_url}
                folder={`fabrics/${editing.slug || 'misc'}/thumb`}
                onChange={url => setEditing({ ...editing, thumbnail_url: url })}
              />

              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.is_active}
                  onCheckedChange={v => setEditing({ ...editing, is_active: v })}
                />
                <Label>Attivo (visibile nel configuratore)</Label>
              </div>

              <div className="flex gap-2 pt-2 items-center">
                <Button
                  onClick={() => upsert.mutate(editing)}
                  disabled={upsert.isPending || !editing.name?.trim()}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" /> Salva
                </Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Annulla
                </Button>
                {!editing.name?.trim() && (
                  <span className="text-xs text-destructive">Inserisci un nome per salvare</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFabrics;
