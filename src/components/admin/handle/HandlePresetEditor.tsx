/**
 * HandlePresetEditor
 *
 * Form completo per editare un singolo preset:
 *  - count selector (3 / 4 / 5 / custom)
 *  - lista strisce: color picker + width normalizzata
 *  - spacing fra coppie consecutive
 *  - margini sinistro/destro
 *  - toggle grain + opacity
 *  - validazione sum width + spacing + margini
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus } from 'lucide-react';
import type { HandlePatternPreset } from '@/engine/handlePreset';

interface Props {
  preset: HandlePatternPreset;
  onChange: (p: HandlePatternPreset) => void;
}

const HandlePresetEditor: React.FC<Props> = ({ preset, onChange }) => {
  const setStripeCount = (n: number) => {
    const count = Math.max(1, Math.min(12, n));
    const w = (1 - (preset.edgeMarginLeft || 0) - (preset.edgeMarginRight || 0)) / count;
    const stripes = Array.from({ length: count }, (_, i) => ({
      color: preset.stripes[i]?.color ?? (i % 2 === 0 ? '#e2188f' : '#f1eadb'),
      width: w,
    }));
    const spacing = Array.from({ length: Math.max(0, count - 1) }, (_, i) => preset.spacing[i] ?? 0);
    onChange({ ...preset, stripeCount: count, stripes, spacing });
  };

  const updateStripe = (i: number, patch: Partial<{ color: string; width: number }>) => {
    onChange({
      ...preset,
      stripes: preset.stripes.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    });
  };

  const updateSpacing = (i: number, v: number) => {
    onChange({
      ...preset,
      spacing: preset.spacing.map((s, idx) => (idx === i ? v : s)),
    });
  };

  const total =
    (preset.edgeMarginLeft || 0) +
    (preset.edgeMarginRight || 0) +
    preset.spacing.reduce((a, b) => a + b, 0) +
    preset.stripes.reduce((a, s) => a + s.width, 0);

  return (
    <div className="space-y-4">
      {/* Header: name + count */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
        <div>
          <Label className="text-xs">Nome preset</Label>
          <Input
            value={preset.name}
            onChange={(e) => onChange({ ...preset, name: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
        <div className="text-xs text-muted-foreground">Strisce:</div>
        {[3, 4, 5].map((n) => (
          <Button
            key={n}
            size="sm"
            variant={preset.stripeCount === n ? 'default' : 'outline'}
            className="w-10"
            onClick={() => setStripeCount(n)}
          >
            {n}
          </Button>
        ))}
      </div>

      {/* Margini */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">
            Margine sx ({(preset.edgeMarginLeft * 100).toFixed(0)}%)
          </Label>
          <Slider
            value={[preset.edgeMarginLeft]}
            min={0}
            max={0.4}
            step={0.005}
            onValueChange={(v) => onChange({ ...preset, edgeMarginLeft: v[0] })}
          />
        </div>
        <div>
          <Label className="text-xs">
            Margine dx ({(preset.edgeMarginRight * 100).toFixed(0)}%)
          </Label>
          <Slider
            value={[preset.edgeMarginRight]}
            min={0}
            max={0.4}
            step={0.005}
            onValueChange={(v) => onChange({ ...preset, edgeMarginRight: v[0] })}
          />
        </div>
      </div>

      {/* Strisce */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Strisce ({preset.stripeCount})
        </Label>
        {preset.stripes.map((s, i) => (
          <div
            key={i}
            className="grid grid-cols-[24px_56px_1fr_64px_28px] gap-2 items-center"
          >
            <span className="text-xs font-mono text-muted-foreground text-center">
              {i + 1}
            </span>
            <input
              type="color"
              value={s.color}
              onChange={(e) => updateStripe(i, { color: e.target.value })}
              className="h-8 w-full rounded border border-border bg-transparent cursor-pointer"
            />
            <Slider
              value={[s.width]}
              min={0.02}
              max={0.6}
              step={0.005}
              onValueChange={(v) => updateStripe(i, { width: v[0] })}
            />
            <Input
              value={s.color}
              onChange={(e) => updateStripe(i, { color: e.target.value })}
              className="h-7 px-1 text-xs font-mono"
            />
            <span className="text-[10px] text-muted-foreground text-right font-mono">
              {(s.width * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>

      {/* Spacing */}
      {preset.spacing.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Spazi fra strisce
          </Label>
          {preset.spacing.map((sp, i) => (
            <div key={i} className="grid grid-cols-[60px_1fr_50px] gap-2 items-center">
              <span className="text-xs text-muted-foreground">
                {i + 1}↔{i + 2}
              </span>
              <Slider
                value={[sp]}
                min={0}
                max={0.2}
                step={0.005}
                onValueChange={(v) => updateSpacing(i, v[0])}
              />
              <span className="text-[10px] text-muted-foreground text-right font-mono">
                {(sp * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Grain */}
      <div className="border border-border rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Grana tessuto</Label>
          <Switch
            checked={!!preset.grainEnabled}
            onCheckedChange={(v) => onChange({ ...preset, grainEnabled: v })}
          />
        </div>
        {preset.grainEnabled && (
          <div>
            <Label className="text-[10px] text-muted-foreground">
              Opacità grana ({((preset.grainOpacity ?? 0) * 100).toFixed(0)}%)
            </Label>
            <Slider
              value={[preset.grainOpacity ?? 0.18]}
              min={0}
              max={0.6}
              step={0.01}
              onValueChange={(v) => onChange({ ...preset, grainOpacity: v[0] })}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Texture grana caricata a livello globale (Fase successiva). Per ora usa effetto leggero solid multiply.
            </p>
          </div>
        )}
      </div>

      {/* Validazione totale */}
      <div
        className={`text-xs px-3 py-2 rounded font-mono ${
          Math.abs(total - 1) < 0.001
            ? 'bg-emerald-500/10 text-emerald-400'
            : total > 1
              ? 'bg-destructive/10 text-destructive'
              : 'bg-amber-500/10 text-amber-500'
        }`}
      >
        Σ width + spacing + margini = {(total * 100).toFixed(1)}% / 100% (verrà
        normalizzato in render)
      </div>
    </div>
  );
};

export default HandlePresetEditor;
