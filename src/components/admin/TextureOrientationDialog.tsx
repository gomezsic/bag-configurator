/**
 * TextureOrientationDialog
 *
 * Dialog dedicato per orientare graficamente la texture dentro una mask_zone.
 * Combina:
 *  - una "rosa dei venti" trascinabile per la rotazione (0-360°)
 *  - 3 slider per scala, offset X e offset Y
 *  - un preview live a destra che riempie la maschera con la texture scelta
 *    da una dropdown del catalogo fabrics
 *
 * I valori vengono modificati solo localmente nel dialog. Al click su Salva
 * vengono passati al chiamante via onSave; Annulla scarta tutto.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Compass, RotateCcw, Save } from 'lucide-react';
import { MaskPreview } from './MaskPreview';

export interface TextureOrientationParams {
  texture_rotation: number;
  texture_scale: number;
  texture_offset_x: number;
  texture_offset_y: number;
}

interface ZoneLite {
  id: string;
  zone_type: string;
  zone_category: string;
  mask_image_url: string | null;
  texture_scale: number;
  texture_offset_x: number;
  texture_offset_y: number;
  texture_rotation: number;
  texture_repeat_mode: string;
  label: string | null;
}

interface ViewLite {
  canvas_width: number;
  canvas_height: number;
  base_image_url: string | null;
}

interface FabricOption {
  id: string;
  name: string;
  texture_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone: ZoneLite | null;
  view: ViewLite | null;
  fabrics: FabricOption[];
  /** Fabric id da pre-selezionare (es. quello già scelto come anteprima globale). */
  initialFabricId?: string;
  onSave: (params: TextureOrientationParams) => void;
}

export const TextureOrientationDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  zone,
  view,
  fabrics,
  initialFabricId,
  onSave,
}) => {
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [fabricId, setFabricId] = useState<string>('');

  // Reset on open with current zone values
  useEffect(() => {
    if (open && zone) {
      setRotation(((zone.texture_rotation % 360) + 360) % 360);
      setScale(zone.texture_scale);
      setOffsetX(zone.texture_offset_x);
      setOffsetY(zone.texture_offset_y);
      // Prefer the suggested fabric, otherwise first available
      const valid = fabrics.find(f => f.id === initialFabricId && f.texture_url);
      setFabricId(valid?.id ?? fabrics.find(f => f.texture_url)?.id ?? '');
    }
  }, [open, zone, initialFabricId, fabrics]);

  const previewFabric = useMemo(
    () => fabrics.find(f => f.id === fabricId) ?? null,
    [fabrics, fabricId]
  );

  // Build the zone-with-overrides for the live preview
  const previewZone = useMemo<ZoneLite | null>(() => {
    if (!zone) return null;
    return {
      ...zone,
      texture_rotation: rotation,
      texture_scale: scale,
      texture_offset_x: offsetX,
      texture_offset_y: offsetY,
    };
  }, [zone, rotation, scale, offsetX, offsetY]);

  const handleSave = () => {
    onSave({
      texture_rotation: rotation,
      texture_scale: scale,
      texture_offset_x: offsetX,
      texture_offset_y: offsetY,
    });
    onOpenChange(false);
  };

  const handleReset = () => {
    setRotation(0);
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  if (!zone || !view) return null;

  const zoneLabel = zone.label || zone.zone_type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Compass className="h-4 w-4" /> Orienta texture · {zoneLabel}
          </DialogTitle>
          <DialogDescription>
            Trascina la rosa dei venti per ruotare. Usa gli slider per scalare e spostare.
            La preview a destra è in tempo reale.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          {/* CONTROLS */}
          <div className="space-y-5">
            {/* Texture picker */}
            <div className="space-y-1.5">
              <Label className="text-xs">Texture di prova</Label>
              <Select value={fabricId} onValueChange={setFabricId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Scegli un tessuto..." />
                </SelectTrigger>
                <SelectContent>
                  {fabrics
                    .filter(f => f.texture_url)
                    .map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Compass rotation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Rotazione</Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {Math.round(rotation)}°
                </span>
              </div>
              <CompassControl value={rotation} onChange={setRotation} />
              <Slider
                value={[rotation]}
                min={0}
                max={360}
                step={1}
                onValueChange={([v]) => setRotation(v)}
              />
              <div className="flex items-center gap-1 flex-wrap">
                {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                  <Button
                    key={deg}
                    size="sm"
                    variant={Math.round(rotation) === deg ? 'default' : 'outline'}
                    onClick={() => setRotation(deg)}
                    className="h-6 px-2 text-[10px]"
                  >
                    {deg}°
                  </Button>
                ))}
              </div>
            </div>

            {/* Scale */}
            <SliderRow
              label="Dimensione"
              unit="×"
              precision={2}
              value={scale}
              min={0.1}
              max={5}
              step={0.05}
              onChange={setScale}
            />

            {/* Offset X */}
            <SliderRow
              label="Offset X"
              unit=" px"
              precision={0}
              value={offsetX}
              min={-500}
              max={500}
              step={1}
              onChange={setOffsetX}
            />

            {/* Offset Y */}
            <SliderRow
              label="Offset Y"
              unit=" px"
              precision={0}
              value={offsetY}
              min={-500}
              max={500}
              step={1}
              onChange={setOffsetY}
            />
          </div>

          {/* LIVE PREVIEW */}
          <div className="space-y-2">
            <Label className="text-xs">Anteprima sulla maschera</Label>
            <div className="border border-border rounded-md overflow-hidden bg-background">
              {previewZone && (
                <MaskPreview
                  view={view}
                  zones={[previewZone]}
                  maskOpacity={1}
                  fabric={previewFabric}
                  mode="textured"
                />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Solo questa zona viene mostrata texturizzata. Le altre zone della vista
              restano neutre per non distrarre.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 pt-2">
          <Button variant="ghost" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSave} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Applica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ===================== Compass control ===================== */

/**
 * Cerchio interattivo: trascini ovunque sopra di esso e l'angolo viene
 * calcolato come arctan2 rispetto al centro. La freccia indica la direzione.
 * 0° = nord, ruota in senso orario (convenzione cartografica), che corrisponde
 * anche al senso visuale che ci si aspetta dalla rotazione di una texture.
 */
const CompassControl: React.FC<{ value: number; onChange: (v: number) => void }> = ({
  value,
  onChange,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const updateFromPointer = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    // atan2: 0 rad = east. We want 0° = north and CW positive.
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    deg = ((deg % 360) + 360) % 360;
    onChange(Math.round(deg));
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => updateFromPointer(e.clientX, e.clientY);
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  return (
    <div className="flex justify-center py-2">
      <div
        ref={ref}
        onPointerDown={e => {
          setDragging(true);
          updateFromPointer(e.clientX, e.clientY);
        }}
        className="relative w-40 h-40 rounded-full border-2 border-border bg-muted/30 cursor-grab active:cursor-grabbing select-none touch-none"
        role="slider"
        aria-label="Rotazione texture"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(value)}
      >
        {/* Cardinal labels */}
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-muted-foreground">
          N · 0°
        </span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
          E · 90°
        </span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-muted-foreground">
          S · 180°
        </span>
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
          O · 270°
        </span>

        {/* Tick marks every 45° */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
          <div
            key={deg}
            className="absolute top-1/2 left-1/2 w-px h-3 bg-border origin-bottom"
            style={{
              transform: `translate(-50%, -100%) rotate(${deg}deg) translateY(-3.5rem)`,
            }}
          />
        ))}

        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-foreground" />

        {/* Arrow */}
        <div
          className="absolute top-1/2 left-1/2 origin-bottom pointer-events-none"
          style={{
            width: 4,
            height: 60,
            transform: `translate(-50%, -100%) rotate(${value}deg)`,
            transformOrigin: '50% 100%',
          }}
        >
          <div className="w-full h-full bg-primary rounded-t-full" />
          {/* Arrow head */}
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: '8px solid hsl(var(--primary))',
            }}
          />
        </div>
      </div>
    </div>
  );
};

/* ===================== slider row ===================== */

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  precision?: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, unit = '', precision = 0, onChange }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <span className="text-xs font-mono text-muted-foreground">
        {value.toFixed(precision)}
        {unit}
      </span>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => onChange(v)}
    />
  </div>
);
