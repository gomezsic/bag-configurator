/**
 * MaskGeneratorDialog
 *
 * Dialog AI per la generazione automatica di maschere di zona tessuto.
 * Flusso:
 *   1. Chiama l'edge function generate-bag-masks (Claude vision)
 *   2. Mostra preview interattiva: poligoni colorati sovrapposti alla base image
 *   3. L'admin può togglare/rinominare le zone
 *   4. "Applica" rasterizza ogni poligono in PNG mask lato browser,
 *      carica su Supabase Storage, crea le mask_zones nel DB
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uploadAsset } from '@/lib/uploadAsset';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Wand2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────────── */

interface Point { x: number; y: number }

interface GeneratedZone {
  zone_type: string;
  label: string;
  polygon: Point[];
  enabled: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bagViewId: string;
  bagModelSlug: string;
  viewType: string;
  canvasWidth: number;
  canvasHeight: number;
  baseImageUrl: string;
  onApplied: () => void;
}

/* ─── Zone color palette ──────────────────────────────────────── */

const ZONE_COLORS: Record<string, string> = {
  fabric_front: 'rgba(59,130,246,0.45)',
  fabric_sides: 'rgba(34,197,94,0.45)',
  fabric_top:   'rgba(234,179,8,0.45)',
  fabric_back:  'rgba(239,68,68,0.45)',
};
const ZONE_STROKE: Record<string, string> = {
  fabric_front: 'rgba(59,130,246,0.9)',
  fabric_sides: 'rgba(34,197,94,0.9)',
  fabric_top:   'rgba(234,179,8,0.9)',
  fabric_back:  'rgba(239,68,68,0.9)',
};
const FALLBACK_FILL   = 'rgba(168,85,247,0.45)';
const FALLBACK_STROKE = 'rgba(168,85,247,0.9)';

const DEFAULT_ZONE_PROPS: Record<string, { category: string; blend_mode: string; z_index: number; sort_order: number }> = {
  fabric_front: { category: 'fabric', blend_mode: 'normal', z_index: 10, sort_order: 0 },
  fabric_sides: { category: 'fabric', blend_mode: 'normal', z_index: 10, sort_order: 1 },
  fabric_top:   { category: 'fabric', blend_mode: 'normal', z_index: 10, sort_order: 2 },
  fabric_back:  { category: 'fabric', blend_mode: 'normal', z_index: 10, sort_order: 3 },
};

/* ─── Helpers ─────────────────────────────────────────────────── */

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: Point[],
  fill: string,
  stroke: string,
  scale: number,
) {
  if (polygon.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x * scale, polygon[0].y * scale);
  for (const pt of polygon.slice(1)) ctx.lineTo(pt.x * scale, pt.y * scale);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Rasterizza un poligono in una PNG mask (bianco = zona tessuto, nero = fuori).
 * Dimensioni = canvasWidth × canvasHeight esatte (per corrispondere alla base image).
 */
function rasterizePolygonMask(
  polygon: Point[],
  width: number,
  height: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas 2D non disponibile'));

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (const pt of polygon.slice(1)) ctx.lineTo(pt.x, pt.y);
    ctx.closePath();
    ctx.fill();

    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')),
      'image/png',
    );
  });
}

/* ─── Main component ──────────────────────────────────────────── */

export const MaskGeneratorDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  bagViewId,
  bagModelSlug,
  viewType,
  canvasWidth,
  canvasHeight,
  baseImageUrl,
  onApplied,
}) => {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'idle' | 'generating' | 'preview' | 'applying' | 'done'>('idle');
  const [zones, setZones] = useState<GeneratedZone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applyProgress, setApplyProgress] = useState<{ done: number; total: number } | null>(null);

  /* Reset quando il dialog viene riaperto */
  useEffect(() => {
    if (open) {
      setPhase('idle');
      setZones([]);
      setError(null);
      setApplyProgress(null);
    }
  }, [open]);

  /* Disegna il preview ogni volta che zones o phase cambiano */
  const drawPreview = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const scale = canvas.width / canvasWidth;
      for (const z of zones) {
        if (!z.enabled) continue;
        const fill   = ZONE_COLORS[z.zone_type]   ?? FALLBACK_FILL;
        const stroke = ZONE_STROKE[z.zone_type]   ?? FALLBACK_STROKE;
        drawPolygon(ctx, z.polygon, fill, stroke, scale);
      }
    };
    img.src = baseImageUrl;
  }, [zones, baseImageUrl, canvasWidth]);

  useEffect(() => {
    if (phase === 'preview') drawPreview();
  }, [phase, drawPreview]);

  /* ── Step 1: chiama l'edge function ── */
  const handleGenerate = async () => {
    setPhase('generating');
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('generate-bag-masks', {
        body: { bagViewId },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });

      if (res.error) throw new Error(res.error.message);
      const payload = res.data as { ok: boolean; zones: Omit<GeneratedZone, 'enabled'>[] };
      if (!payload?.ok || !payload.zones) throw new Error('Risposta edge function non valida');

      setZones(payload.zones.map(z => ({ ...z, enabled: true })));
      setPhase('preview');
    } catch (e) {
      setError((e as Error).message);
      setPhase('idle');
    }
  };

  /* ── Step 2: rasterizza + upload + crea mask_zones ── */
  const handleApply = async () => {
    const enabledZones = zones.filter(z => z.enabled);
    if (enabledZones.length === 0) {
      toast.error('Abilita almeno una zona prima di applicare.');
      return;
    }

    setPhase('applying');
    setApplyProgress({ done: 0, total: enabledZones.length });

    let applied = 0;
    const errors: string[] = [];

    for (const zone of enabledZones) {
      try {
        // 1. Rasterizza il poligono in PNG mask
        const blob = await rasterizePolygonMask(zone.polygon, canvasWidth, canvasHeight);
        const file = new File([blob], `mask-${zone.zone_type}.png`, { type: 'image/png' });

        // 2. Upload su Supabase Storage
        const maskUrl = await uploadAsset(
          file,
          `models/${bagModelSlug}/${viewType}/masks`,
          `mask-${zone.zone_type}-${Date.now()}`,
        );

        // 3. Crea o aggiorna mask_zone nel DB
        const props = DEFAULT_ZONE_PROPS[zone.zone_type] ?? {
          category: 'fabric', blend_mode: 'normal', z_index: 10, sort_order: applied,
        };

        // Prima controlla se esiste già una zona con lo stesso zone_type per questa view
        const { data: existing } = await supabase
          .from('mask_zones')
          .select('id')
          .eq('bag_view_id', bagViewId)
          .eq('zone_type', zone.zone_type)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('mask_zones')
            .update({ mask_image_url: maskUrl, label: zone.label })
            .eq('id', existing.id);
        } else {
          await supabase.from('mask_zones').insert({
            bag_view_id: bagViewId,
            zone_type: zone.zone_type,
            zone_category: props.category,
            label: zone.label,
            mask_image_url: maskUrl,
            blend_mode: props.blend_mode,
            z_index: props.z_index,
            sort_order: props.sort_order,
            texture_scale: 1.5,
            texture_repeat_mode: 'repeat',
          });
        }

        applied++;
        setApplyProgress({ done: applied, total: enabledZones.length });
      } catch (e) {
        errors.push(`${zone.label}: ${(e as Error).message}`);
      }
    }

    if (errors.length > 0) {
      toast.error(`Alcune zone non applicate:\n${errors.join('\n')}`, { duration: 8000 });
    }
    if (applied > 0) {
      toast.success(`${applied} zona/e applicate correttamente.`);
      onApplied();
    }
    setPhase('done');
  };

  /* ── Render ── */

  const previewSize = 480;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Generazione maschere AI
          </DialogTitle>
          <DialogDescription>
            Claude analizza la foto della borsa e identifica le zone di tessuto.
            Controlla il preview, abilita/disabilita le zone, poi clicca Applica.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_260px] gap-4">

          {/* Preview canvas */}
          <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30 flex items-center justify-center"
               style={{ minHeight: previewSize }}>
            {phase === 'idle' && (
              <div className="text-center text-sm text-muted-foreground space-y-2 p-8">
                <Wand2 className="h-10 w-10 mx-auto opacity-30" />
                <p>Clicca <strong>Genera zone</strong> per avviare l'analisi AI.</p>
              </div>
            )}
            {phase === 'generating' && (
              <div className="text-center text-sm text-muted-foreground space-y-3 p-8">
                <Loader2 className="h-8 w-8 mx-auto animate-spin" />
                <p>Claude sta analizzando la borsa…</p>
                <p className="text-xs opacity-60">Ci vogliono ~10 secondi</p>
              </div>
            )}
            {(phase === 'preview' || phase === 'applying' || phase === 'done') && (
              <canvas
                ref={previewRef}
                width={previewSize}
                height={Math.round(previewSize * canvasHeight / canvasWidth)}
                className="max-w-full max-h-[60vh] object-contain"
              />
            )}
          </div>

          {/* Zone list */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Zone identificate
            </p>
            {phase === 'idle' || phase === 'generating' ? (
              <p className="text-xs text-muted-foreground italic">
                {phase === 'generating' ? 'In attesa…' : 'Nessuna zona ancora.'}
              </p>
            ) : (
              zones.length === 0 ? (
                <p className="text-xs text-destructive">Nessuna zona trovata. Riprova.</p>
              ) : (
                <div className="space-y-2">
                  {zones.map((z, i) => (
                    <div
                      key={`${z.zone_type}-${i}`}
                      className="rounded-md border border-border p-2 space-y-1.5 bg-background"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 border"
                          style={{
                            background: ZONE_COLORS[z.zone_type] ?? FALLBACK_FILL,
                            borderColor: ZONE_STROKE[z.zone_type] ?? FALLBACK_STROKE,
                          }}
                        />
                        <span className="text-[11px] font-mono text-muted-foreground flex-1">
                          {z.zone_type}
                        </span>
                        <Switch
                          checked={z.enabled}
                          onCheckedChange={val => {
                            setZones(prev => prev.map((p, j) => j === i ? { ...p, enabled: val } : p));
                            drawPreview();
                          }}
                          disabled={phase === 'applying' || phase === 'done'}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-muted-foreground">Label</Label>
                        <Input
                          value={z.label}
                          onChange={e => setZones(prev =>
                            prev.map((p, j) => j === i ? { ...p, label: e.target.value } : p)
                          )}
                          className="h-6 text-xs"
                          disabled={phase === 'applying' || phase === 'done'}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {z.polygon.length} punti
                      </p>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Progress bar during apply */}
        {phase === 'applying' && applyProgress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Caricamento maschere…</span>
              <span>{applyProgress.done}/{applyProgress.total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(applyProgress.done / applyProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Done banner */}
        {phase === 'done' && (
          <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/5 px-3 py-2 text-xs text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Maschere applicate. Le zone tessuto sono ora visibili nel pannello Zone Tessuto.
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>

          {(phase === 'idle' || phase === 'preview') && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={phase === 'generating'}
              className="gap-1.5"
            >
              {phase === 'generating' ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando…</>
              ) : (
                <><Wand2 className="h-3.5 w-3.5" /> {zones.length > 0 ? 'Rigenera' : 'Genera zone'}</>
              )}
            </Button>
          )}

          {phase === 'preview' && zones.some(z => z.enabled) && (
            <Button
              size="sm"
              onClick={handleApply}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Applica {zones.filter(z => z.enabled).length} zona/e
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
