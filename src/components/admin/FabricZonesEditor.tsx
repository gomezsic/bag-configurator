/**
 * FabricZonesEditor
 *
 * Per ogni vista mostra le zone di tessuto (zone_category='fabric') e
 * permette di assegnare a ciascuna:
 *  - una texture override (es. carbonio sui lati, denim sul top)
 *  - scala / rotazione / repeat indipendenti
 *
 * Quando texture_url è NULL la zona eredita il tessuto scelto dall'utente
 * nello step "Tessuto" del configuratore.
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';

interface FabricZone {
  id: string;
  bag_view_id: string;
  zone_type: string;
  label: string | null;
  mask_image_url: string | null;
  texture_url: string | null;
  texture_scale: number;
  texture_rotation: number;
  texture_repeat_mode: string;
  z_index: number;
}

interface ViewRow {
  id: string;
  view_type: string;
  custom_label: string | null;
}

interface FabricRow {
  id: string;
  name: string;
  texture_url: string | null;
  thumbnail_url: string | null;
}

interface Props {
  bagModelId: string;
  modelSlug: string;
}

const REPEAT_MODES = ['repeat', 'clamp', 'mirror'] as const;

const FabricZonesEditor: React.FC<Props> = ({ bagModelId, modelSlug }) => {
  const [views, setViews] = useState<ViewRow[]>([]);
  const [zones, setZones] = useState<FabricZone[]>([]);
  const [fabrics, setFabrics] = useState<FabricRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const [{ data: vData }, { data: fData }] = await Promise.all([
      supabase
        .from('bag_views')
        .select('id, view_type, custom_label')
        .eq('bag_model_id', bagModelId)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('fabrics')
        .select('id, name, texture_url, thumbnail_url')
        .eq('is_active', true)
        .order('sort_order'),
    ]);
    setViews(vData ?? []);
    setFabrics((fData ?? []).filter((f) => f.texture_url));

    const viewIds = (vData ?? []).map((v) => v.id);
    if (viewIds.length === 0) {
      setZones([]);
      return;
    }
    const { data: zData } = await supabase
      .from('mask_zones')
      .select(
        'id, bag_view_id, zone_type, label, mask_image_url, texture_url, texture_scale, texture_rotation, texture_repeat_mode, z_index',
      )
      .in('bag_view_id', viewIds)
      .eq('zone_category', 'fabric')
      .order('sort_order');
    setZones((zData ?? []) as FabricZone[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bagModelId]);

  const updateZone = async (id: string, patch: Partial<FabricZone>) => {
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

  if (views.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Texture per zona di tessuto
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Assegna un tessuto specifico a ciascuna zona (frontale / laterali /
          top). Lascia "Eredita dal configuratore" per usare il tessuto scelto
          dall'utente. Modello: {modelSlug}.
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
                Nessuna zona di tessuto su questa vista.
              </p>
            ) : (
              <div className="space-y-3">
                {viewZones.map((z) => {
                  const currentFabric = fabrics.find((f) => f.texture_url === z.texture_url);
                  return (
                    <div
                      key={z.id}
                      className="grid grid-cols-[64px_1fr] gap-3 items-start border border-border/60 rounded-md p-2"
                    >
                      <div className="w-16 h-16 bg-muted rounded overflow-hidden flex items-center justify-center">
                        {z.mask_image_url ? (
                          <img
                            src={z.mask_image_url}
                            alt={z.label ?? z.zone_type}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">no mask</span>
                        )}
                      </div>

                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-xs font-medium">
                            {z.label ?? z.zone_type}
                          </Label>
                          {z.texture_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] gap-1"
                              onClick={() => updateZone(z.id, { texture_url: null })}
                              disabled={busyId === z.id}
                            >
                              <RotateCcw className="h-3 w-3" />
                              eredita
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">
                              Texture override
                            </Label>
                            <Select
                              value={z.texture_url ?? '__inherit__'}
                              onValueChange={(val) =>
                                updateZone(z.id, {
                                  texture_url: val === '__inherit__' ? null : val,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Eredita dal configuratore">
                                  {currentFabric?.name ?? 'Eredita dal configuratore'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__inherit__">
                                  Eredita dal configuratore
                                </SelectItem>
                                {fabrics.map((f) => (
                                  <SelectItem key={f.id} value={f.texture_url!}>
                                    {f.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-[10px] text-muted-foreground">
                              Repeat
                            </Label>
                            <Select
                              value={z.texture_repeat_mode}
                              onValueChange={(val) =>
                                updateZone(z.id, { texture_repeat_mode: val })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {REPEAT_MODES.map((m) => (
                                  <SelectItem key={m} value={m}>
                                    {m}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Scala</span>
                              <span>{z.texture_scale.toFixed(2)}</span>
                            </div>
                            <Slider
                              value={[z.texture_scale]}
                              min={0.1}
                              max={5}
                              step={0.05}
                              onValueChange={([val]) =>
                                updateZone(z.id, { texture_scale: val })
                              }
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Rotazione</span>
                              <span>{Math.round(z.texture_rotation)}°</span>
                            </div>
                            <Slider
                              value={[z.texture_rotation]}
                              min={-180}
                              max={180}
                              step={1}
                              onValueChange={([val]) =>
                                updateZone(z.id, { texture_rotation: val })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FabricZonesEditor;
