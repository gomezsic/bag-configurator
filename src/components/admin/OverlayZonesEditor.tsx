/**
 * OverlayZonesEditor
 *
 * Pannello admin per gestire le mask_zones di categoria 'overlay' di un
 * modello (es. Cerniera, hardware decorativi).
 *
 * Funzionalità:
 *  - elenco zone overlay raggruppate per view
 *  - colore di tinta (tint_color) modificabile via color picker
 *  - opacity / blend_mode modificabili
 *  - upload PNG per sostituire la maschera
 *  - rimozione della zona
 *
 * Le zone overlay vengono renderizzate dal layerComposer recolorate con
 * tint_color quando è valorizzato (alpha del PNG preservato).
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uploadAsset } from '@/lib/uploadAsset';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Trash2, Upload } from 'lucide-react';

interface OverlayZone {
  id: string;
  bag_view_id: string;
  zone_type: string;
  label: string | null;
  mask_image_url: string | null;
  tint_color: string | null;
  blend_mode: string;
  z_index: number;
}

interface ViewRow {
  id: string;
  view_type: string;
  custom_label: string | null;
}

interface Props {
  bagModelId: string;
  modelSlug: string;
}

const OverlayZonesEditor: React.FC<Props> = ({ bagModelId, modelSlug }) => {
  const [views, setViews] = useState<ViewRow[]>([]);
  const [zones, setZones] = useState<OverlayZone[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data: vData } = await supabase
      .from('bag_views')
      .select('id, view_type, custom_label')
      .eq('bag_model_id', bagModelId)
      .eq('is_active', true)
      .order('sort_order');
    const viewIds = (vData ?? []).map((v) => v.id);
    setViews(vData ?? []);

    if (viewIds.length === 0) {
      setZones([]);
      return;
    }
    const { data: zData } = await supabase
      .from('mask_zones')
      .select('id, bag_view_id, zone_type, label, mask_image_url, tint_color, blend_mode, z_index')
      .in('bag_view_id', viewIds)
      .eq('zone_category', 'overlay')
      .order('z_index');
    setZones((zData ?? []) as OverlayZone[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bagModelId]);

  const updateZone = async (id: string, patch: Partial<OverlayZone>) => {
    setBusyId(id);
    const { error } = await supabase.from('mask_zones').update(patch).eq('id', id);
    setBusyId(null);
    if (error) {
      toast.error('Errore aggiornamento');
      console.error(error);
      return;
    }
    setZones((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  };

  const replaceMask = async (zone: OverlayZone, file: File) => {
    try {
      setBusyId(zone.id);
      const url = await uploadAsset(file, `views/${zone.bag_view_id}/zones`, `${zone.zone_type}_mask`);
      await updateZone(zone.id, { mask_image_url: url });
      toast.success('Maschera aggiornata');
    } catch (e) {
      console.error(e);
      toast.error('Errore upload');
    } finally {
      setBusyId(null);
    }
  };

  const deleteZone = async (id: string) => {
    if (!confirm('Eliminare questa zona overlay?')) return;
    setBusyId(id);
    const { error } = await supabase.from('mask_zones').delete().eq('id', id);
    setBusyId(null);
    if (error) {
      toast.error('Errore eliminazione');
      return;
    }
    setZones((zs) => zs.filter((z) => z.id !== id));
    toast.success('Zona eliminata');
  };

  if (views.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Cerniera & overlay statici
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Zone con maschera PNG colorata uniformemente. Modello: {modelSlug}.
        </p>
      </div>

      {views.map((v) => {
        const viewZones = zones.filter((z) => z.bag_view_id === v.id);
        return (
          <div key={v.id} className="border border-border rounded-lg p-3 bg-card">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Vista: {v.custom_label ?? v.view_type}
            </div>
            {viewZones.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nessuna zona overlay configurata su questa vista.
              </p>
            ) : (
              <div className="space-y-3">
                {viewZones.map((z) => (
                  <div
                    key={z.id}
                    className="grid grid-cols-[64px_1fr_auto] gap-3 items-center border border-border/60 rounded-md p-2"
                  >
                    <div className="w-16 h-16 bg-muted rounded overflow-hidden flex items-center justify-center">
                      {z.mask_image_url ? (
                        <img
                          src={z.mask_image_url}
                          alt={z.label ?? z.zone_type}
                          className="w-full h-full object-contain"
                          style={{
                            backgroundColor: z.tint_color ?? 'transparent',
                          }}
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">vuoto</span>
                      )}
                    </div>

                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium">
                          {z.label ?? z.zone_type}
                        </Label>
                        <span className="text-[10px] text-muted-foreground">
                          z-index {z.z_index}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Colore
                          </Label>
                          <input
                            type="color"
                            value={z.tint_color ?? '#d8d4cc'}
                            onChange={(e) => updateZone(z.id, { tint_color: e.target.value })}
                            disabled={busyId === z.id}
                            className="h-7 w-10 rounded border border-border cursor-pointer"
                          />
                          <Input
                            value={z.tint_color ?? ''}
                            onChange={(e) =>
                              updateZone(z.id, {
                                tint_color: e.target.value.trim() || null,
                              })
                            }
                            placeholder="#d8d4cc o vuoto"
                            className="h-7 text-xs w-28"
                          />
                          {z.tint_color && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => updateZone(z.id, { tint_color: null })}
                            >
                              originale
                            </Button>
                          )}
                        </div>

                        <label className="inline-flex">
                          <input
                            type="file"
                            accept="image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) replaceMask(z, f);
                              e.currentTarget.value = '';
                            }}
                          />
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={busyId === z.id}
                          >
                            <span>
                              <Upload className="h-3 w-3" />
                              Sostituisci PNG
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteZone(z.id)}
                      disabled={busyId === z.id}
                      title="Elimina zona"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default OverlayZonesEditor;
