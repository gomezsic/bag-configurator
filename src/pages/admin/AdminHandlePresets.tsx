/**
 * AdminHandlePresets — Editor preset con anteprima curva
 *
 * Layout:
 *  - sinistra: lista preset (creazione, selezione, duplicazione, eliminazione)
 *  - centro: editor del preset selezionato (count, colors, widths, spacing,
 *            margins, grain) + anteprima piatta in cima
 *  - destra: anteprima curva sopra una vista borsa scelta dall'utente
 *
 * I preset sono globali (riusabili tra modelli/viste). La preview curva richiede
 * una bag_view che abbia geometria + mask manico configurati nell'editor manico.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Copy, Save } from 'lucide-react';
import HandlePresetEditor from '@/components/admin/handle/HandlePresetEditor';
import HandlePresetPreview from '@/components/admin/handle/HandlePresetPreview';
import { DEFAULT_PRESET, type HandlePatternPreset } from '@/engine/handlePreset';
import type { HandlePathDocument } from '@/engine/handlePath';

interface PresetRow {
  id: string;
  name: string;
  stripe_count: number;
  preset_json: HandlePatternPreset | null;
  is_active: boolean;
  sort_order: number;
}

const AdminHandlePresets: React.FC = () => {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<HandlePatternPreset | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showCenterline, setShowCenterline] = useState(false);

  // Preview view selector
  const [previewViewId, setPreviewViewId] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: presets } = useQuery({
    queryKey: ['handle-presets-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('handle_pattern_presets')
        .select('id, name, stripe_count, preset_json, is_active, sort_order')
        .order('sort_order');
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as any as PresetRow[];
    },
  });

  // Tutte le viste con geometria manico configurata (mask + path con punti)
  const { data: viewsWithHandle } = useQuery({
    queryKey: ['views-with-handle-geometry'],
    queryFn: async () => {
      const { data: geos, error } = await supabase
        .from('handle_geometries')
        .select('id, bag_view_id, mask_url, shadow_url, highlight_url, details_url, hardware_url, path_json')
        .not('mask_url', 'is', null);
      if (error) throw error;
      if (!geos?.length) return [];

      const viewIds = geos.map((g) => g.bag_view_id);
      const { data: views, error: vErr } = await supabase
        .from('bag_views')
        .select('id, view_type, custom_label, canvas_width, canvas_height, base_image_url, bag_model_id')
        .in('id', viewIds);
      if (vErr) throw vErr;

      const { data: models } = await supabase
        .from('bag_models')
        .select('id, name')
        .in('id', views?.map((v) => v.bag_model_id) ?? []);

      // Carica TUTTE le side parts in un colpo solo, poi raggruppa per geometry
      const { data: sideRows } = await supabase
        .from('handle_side_parts')
        .select('handle_geometry_id, mask_url, shadow_url, highlight_url, path_json, is_active')
        .in('handle_geometry_id', geos.map((g) => g.id))
        .eq('is_active', true);

      return (views ?? []).map((v) => {
        const geo = geos.find((g) => g.bag_view_id === v.id)!;
        const model = models?.find((m) => m.id === v.bag_model_id);
        const sides = (sideRows ?? [])
          .filter((s) => s.handle_geometry_id === geo.id)
          .map((s) => {
            const raw = (s.path_json ?? {}) as Partial<HandlePathDocument>;
            const doc: HandlePathDocument = {
              ...(raw as HandlePathDocument),
              canvasWidth: raw.canvasWidth ?? v.canvas_width,
              canvasHeight: raw.canvasHeight ?? v.canvas_height,
              paths: raw.paths ?? [],
            };
            return {
              doc,
              maskUrl: s.mask_url,
              shadowUrl: s.shadow_url,
              highlightUrl: s.highlight_url,
            };
          });
        return {
          viewId: v.id,
          viewType: v.view_type,
          viewLabel: v.custom_label,
          modelName: model?.name ?? '?',
          baseImageUrl: v.base_image_url,
          canvasWidth: v.canvas_width,
          canvasHeight: v.canvas_height,
          mask_url: geo.mask_url,
          shadow_url: geo.shadow_url,
          highlight_url: geo.highlight_url,
          details_url: geo.details_url,
          hardware_url: geo.hardware_url,
          path_json: geo.path_json as unknown as HandlePathDocument | null,
          sideParts: sides,
        };
      });
    },
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  /**
   * Mantiene allineata una corda nel catalogo globale per ogni preset matematico.
   * - se non esiste una corda con pattern_preset_id = presetId, la crea
   * - se esiste, aggiorna il name per riflettere la rinomina del preset
   * Le compatibilità con i manici restano gestite manualmente nel tab "Corde".
   */
  const upsertCordForPreset = async (presetId: string, presetName: string) => {
    const { data: existing } = await supabase
      .from('cord_collection')
      .select('id')
      .eq('pattern_preset_id', presetId)
      .maybeSingle();
    if (existing?.id) {
      await supabase.from('cord_collection').update({ name: presetName }).eq('id', existing.id);
    } else {
      await supabase.from('cord_collection').insert({
        name: presetName,
        style_type: 'pattern_preset',
        pattern_preset_id: presetId,
        is_active: true,
        sort_order: 0,
      });
    }
    qc.invalidateQueries({ queryKey: ['cord-collection'] });
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createPreset = useMutation({
    mutationFn: async () => {
      const preset = DEFAULT_PRESET(5);
      preset.name = `Nuovo preset ${(presets?.length ?? 0) + 1}`;
      const { data, error } = await supabase
        .from('handle_pattern_presets')
        .insert({
          name: preset.name,
          stripe_count: preset.stripeCount,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          preset_json: preset as any,
          sort_order: presets?.length ?? 0,
        })
        .select('id')
        .single();
      if (error) throw error;
      await upsertCordForPreset(data.id as string, preset.name);
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['handle-presets-full'] });
      setSelectedId(id);
      toast.success('Preset creato e aggiunto al catalogo Corde');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicatePreset = useMutation({
    mutationFn: async (row: PresetRow) => {
      const preset = (row.preset_json ?? DEFAULT_PRESET(row.stripe_count)) as HandlePatternPreset;
      const copy = { ...preset, name: `${preset.name} (copia)` };
      const { data, error } = await supabase
        .from('handle_pattern_presets')
        .insert({
          name: copy.name,
          stripe_count: copy.stripeCount,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          preset_json: copy as any,
          sort_order: (presets?.length ?? 0) + 1,
        })
        .select('id')
        .single();
      if (error) throw error;
      await upsertCordForPreset(data.id as string, copy.name);
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['handle-presets-full'] });
      setSelectedId(id);
      toast.success('Preset duplicato');
    },
  });

  const deletePreset = useMutation({
    mutationFn: async (id: string) => {
      // rimuove anche la corda collegata (e a cascata le sue compatibilità)
      await supabase.from('cord_collection').delete().eq('pattern_preset_id', id);
      const { error } = await supabase.from('handle_pattern_presets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handle-presets-full'] });
      qc.invalidateQueries({ queryKey: ['cord-collection'] });
      setSelectedId(null);
      setDraft(null);
      toast.success('Preset eliminato');
    },
  });

  const savePreset = useMutation({
    mutationFn: async () => {
      if (!selectedId || !draft) return;
      const { error } = await supabase
        .from('handle_pattern_presets')
        .update({
          name: draft.name,
          stripe_count: draft.stripeCount,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          preset_json: draft as any,
        })
        .eq('id', selectedId);
      if (error) throw error;
      await upsertCordForPreset(selectedId, draft.name);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handle-presets-full'] });
      setDirty(false);
      toast.success('Preset salvato e sincronizzato col catalogo Corde');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Sync draft quando cambia selezione ────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !presets) {
      setDraft(null);
      return;
    }
    const row = presets.find((r) => r.id === selectedId);
    if (!row) return;
    const p = (row.preset_json ?? DEFAULT_PRESET(row.stripe_count)) as HandlePatternPreset;
    setDraft({
      ...p,
      name: row.name,
      stripeCount: row.stripe_count,
      stripes: p.stripes ?? DEFAULT_PRESET(row.stripe_count).stripes,
      spacing: p.spacing ?? [],
      edgeMarginLeft: p.edgeMarginLeft ?? 0,
      edgeMarginRight: p.edgeMarginRight ?? 0,
    });
    setDirty(false);
  }, [selectedId, presets]);

  // Auto-seleziona preview view al primo caricamento
  useEffect(() => {
    if (!previewViewId && viewsWithHandle?.length) {
      setPreviewViewId(viewsWithHandle[0].viewId);
    }
  }, [viewsWithHandle, previewViewId]);

  const previewView = useMemo(
    () => viewsWithHandle?.find((v) => v.viewId === previewViewId) ?? null,
    [viewsWithHandle, previewViewId],
  );

  // ── Import / export bulk: rimossi.
  // L'import dei preset avviene SOLO da Admin → Carica File (asset pack ZIP).

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sinistra: lista preset */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border space-y-2">
          <Button
            size="sm"
            className="w-full gap-1"
            onClick={() => createPreset.mutate()}
          >
            <Plus className="h-4 w-4" /> Nuovo preset
          </Button>
          <p className="text-[10px] text-muted-foreground leading-snug">
            I preset si importano in massa caricando un file ZIP da{' '}
            <strong>Carica File</strong>.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {presets?.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-2 py-3 text-center">
              Nessun preset. Creane uno per cominciare.
            </p>
          )}
          {presets?.map((p) => {
            const sel = p.id === selectedId;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`group flex items-center gap-2 px-2 py-2 rounded cursor-pointer text-sm ${
                  sel ? 'bg-primary/15 border border-primary/40' : 'hover:bg-muted/40'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-foreground">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.stripe_count} strisce
                  </p>
                </div>
                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicatePreset.mutate(p);
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Eliminare "${p.name}"?`)) deletePreset.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Centro: editor */}
      <main className="flex-1 overflow-y-auto p-4">
        {!draft && (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Seleziona un preset a sinistra o creane uno nuovo
          </div>
        )}
        {draft && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">{draft.name}</h2>
              <Button
                size="sm"
                onClick={() => savePreset.mutate()}
                disabled={!dirty || savePreset.isPending}
                className="gap-1"
              >
                <Save className="h-4 w-4" />
                {savePreset.isPending ? 'Salvataggio…' : 'Salva preset'}
              </Button>
            </div>

            {/* Anteprima piatta */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Anteprima piatta (proporzioni colori)
              </Label>
              <HandlePresetPreview mode="flat" preset={draft} />
            </div>

            <Separator />

            <HandlePresetEditor
              preset={draft}
              onChange={(p) => {
                setDraft(p);
                setDirty(true);
              }}
            />
          </div>
        )}
      </main>

      {/* Destra: anteprima curva */}
      <aside className="w-[420px] border-l border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border space-y-2">
          <Label className="text-xs">Vista per anteprima curva</Label>
          <Select
            value={previewViewId ?? ''}
            onValueChange={(v) => setPreviewViewId(v)}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Seleziona una vista…" />
            </SelectTrigger>
            <SelectContent>
              {viewsWithHandle?.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  Nessuna vista con geometria manico. Configura la mask e la
                  centerline in /admin/models → Editor manico.
                </div>
              )}
              {viewsWithHandle?.map((v) => (
                <SelectItem key={v.viewId} value={v.viewId}>
                  {v.modelName} — {v.viewLabel ?? v.viewType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between pt-1">
            <Label className="text-xs">Mostra centerline manico</Label>
            <Switch checked={showCenterline} onCheckedChange={setShowCenterline} />
          </div>
        </div>
        <div className="flex-1 p-3 min-h-0">
          {draft && previewView && previewView.path_json ? (
            <HandlePresetPreview
              mode="curved"
              preset={draft}
              doc={previewView.path_json}
              baseImageUrl={previewView.baseImageUrl}
              maskUrl={previewView.mask_url}
              shadowUrl={previewView.shadow_url}
              highlightUrl={previewView.highlight_url}
              detailsUrl={previewView.details_url}
              hardwareUrl={previewView.hardware_url}
              sideParts={previewView.sideParts}
              showCenterline={showCenterline}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground text-center px-4">
              {!draft
                ? 'Seleziona un preset per vedere l\u2019anteprima'
                : 'Seleziona una vista borsa con geometria manico configurata'}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default AdminHandlePresets;
