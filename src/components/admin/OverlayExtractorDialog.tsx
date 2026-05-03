/**
 * OverlayExtractorDialog
 *
 * Dialog interattivo per estrarre i 3 overlay (ombre, luci, dettagli) dalla
 * base image di una vista. Mostra un preview live di tutti e 3 i PNG mentre
 * l'operatore regola le 6 soglie con slider, poi salva su Supabase solo al
 * click del bottone finale.
 *
 * Le soglie corrispondono a quelle definite in src/lib/overlayExtractor.ts:
 * - shadowThreshold (0-255)        luminosità sotto la quale → ombra
 * - highlightThreshold (0-255)     luminosità sopra la quale → luce
 * - detailSaturationThreshold (0-255) saturazione minima per "dettaglio metallico"
 * - shadowStrength (0-1)           moltiplicatore alpha ombre
 * - highlightStrength (0-1)        moltiplicatore alpha luci
 * - featherPx (0-6)                soft blur applicato a tutte e 3 le mappe
 *
 * Le estrazioni sono debounced (250 ms) per non saturare la CPU mentre si
 * trascinano gli slider.
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
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save, RotateCcw, Wand2, Sparkles } from 'lucide-react';
import {
  extractOverlaysFromBase,
  DEFAULT_EXTRACT_PARAMS,
  EXTRACT_PRESETS,
  type ExtractParams,
  type ExtractedOverlays,
} from '@/lib/overlayExtractor';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Tinte sample per simulare velocemente un tessuto colorato uniforme. */
const SAMPLE_COLORS = [
  { label: 'Rosso', hex: '#b8312f' },
  { label: 'Blu', hex: '#1f4d8c' },
  { label: 'Verde oliva', hex: '#5a6b3a' },
  { label: 'Senape', hex: '#c89a3a' },
  { label: 'Cammello', hex: '#a88058' },
  { label: 'Grigio', hex: '#7a7a7a' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseImageUrl: string | null;
  /** Called with the three uploaded URLs after Save. */
  onSave: (out: ExtractedOverlays) => Promise<void> | void;
}

const PREVIEW_BG = '#888'; // medium grey checkerboard alternative

export const OverlayExtractorDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  baseImageUrl,
  onSave,
}) => {
  const [params, setParams] = useState<ExtractParams>(DEFAULT_EXTRACT_PARAMS);
  const [preview, setPreview] = useState<ExtractedOverlays | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  /** Sample texture per la preview composita. 'color:HEX' = tinta unita. */
  const [sampleSource, setSampleSource] = useState<string>('color:#b8312f');

  // Carica catalogo fabrics per offrire texture vere come sample
  const { data: fabrics } = useQuery({
    queryKey: ['fabrics-sample-overlay-extractor'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fabrics')
        .select('id, name, texture_url')
        .eq('is_active', true)
        .not('texture_url', 'is', null)
        .order('sort_order', { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Reset on open
  useEffect(() => {
    if (open) {
      setParams(DEFAULT_EXTRACT_PARAMS);
      setPreview(null);
    }
  }, [open]);

  // Debounced extraction whenever params or baseImageUrl change
  useEffect(() => {
    if (!open || !baseImageUrl) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      setExtracting(true);
      try {
        const out = await extractOverlaysFromBase(baseImageUrl, params);
        // Discard if a newer request started in the meantime
        if (myReq === reqIdRef.current) setPreview(out);
      } catch (e) {
        console.error('Extraction failed', e);
      } finally {
        if (myReq === reqIdRef.current) setExtracting(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [params, baseImageUrl, open]);

  const update = (patch: Partial<ExtractParams>) =>
    setParams(p => ({ ...p, ...patch }));

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      await onSave(preview);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" /> Estrai overlay dalla base image
          </DialogTitle>
          <DialogDescription>
            Regola le 6 soglie con gli slider. La preview si aggiorna in tempo reale.
            Clicca <strong>Salva</strong> per caricare i 3 PNG su Lovable Cloud.
          </DialogDescription>
        </DialogHeader>

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Preset rapidi:
          </span>
          {Object.entries(EXTRACT_PRESETS).map(([key, p]) => (
            <Button
              key={key}
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => setParams(p.params)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* Preview grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PreviewTile
            label="Base"
            src={baseImageUrl ?? null}
            bg="#fff"
          />
          <PreviewTile
            label="Ombre (multiply)"
            src={preview?.shadowsDataUrl ?? null}
            bg={PREVIEW_BG}
            loading={extracting && !preview}
          />
          <PreviewTile
            label="Luci (screen)"
            src={preview?.highlightsDataUrl ?? null}
            bg={PREVIEW_BG}
            loading={extracting && !preview}
          />
          <PreviewTile
            label="Dettagli"
            src={preview?.detailsDataUrl ?? null}
            bg={PREVIEW_BG}
            loading={extracting && !preview}
          />
        </div>

        {/* Composite preview: applica la pipeline reale (tessuto colorato + ombre × luci × dettagli)
            così vedi subito come reagiscono le maschere su una texture qualunque. */}
        <div className="border border-border rounded-md p-3 bg-muted/30 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs font-medium">Anteprima resa finale</Label>
            <span className="text-[11px] text-muted-foreground">
              tessuto + ombre × luci + dettagli (stesso ordine del configuratore)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Sample texture:</span>
            {SAMPLE_COLORS.map(c => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setSampleSource(`color:${c.hex}`)}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  sampleSource === `color:${c.hex}` ? 'border-foreground scale-110' : 'border-border'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.label}
              />
            ))}
            {fabrics?.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSampleSource(`url:${f.texture_url}`)}
                className={`h-6 w-6 rounded-full border-2 overflow-hidden transition ${
                  sampleSource === `url:${f.texture_url}` ? 'border-foreground scale-110' : 'border-border'
                }`}
                title={f.name}
              >
                <img
                  src={f.texture_url ?? ''}
                  alt={f.name}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
          <CompositePreview
            baseImageUrl={baseImageUrl}
            shadowsUrl={preview?.shadowsDataUrl ?? null}
            highlightsUrl={preview?.highlightsDataUrl ?? null}
            detailsUrl={preview?.detailsDataUrl ?? null}
            sampleSource={sampleSource}
          />
          <p className="text-[11px] text-muted-foreground">
            Cambia colore/texture: la composizione si aggiorna ma le maschere restano invariate.
            Se zip e ferramenta scompaiono cambiando colore → alza "Soglia dettagli scuri".
          </p>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
          <SliderRow
            label="Soglia ombre (luminosità max)"
            help="Pixel più scuri di questa soglia diventano ombre"
            value={params.shadowThreshold}
            min={20}
            max={200}
            step={1}
            onChange={v => update({ shadowThreshold: v })}
            displayUnit=""
          />
          <SliderRow
            label="Soglia luci (luminosità min)"
            help="Pixel più chiari di questa soglia diventano luci"
            value={params.highlightThreshold}
            min={150}
            max={250}
            step={1}
            onChange={v => update({ highlightThreshold: v })}
            displayUnit=""
          />
          <SliderRow
            label="Soglia saturazione dettagli"
            help="Pixel con saturazione superiore (zip colorati, cuoio)"
            value={params.detailSaturationThreshold}
            min={5}
            max={120}
            step={1}
            onChange={v => update({ detailSaturationThreshold: v })}
            displayUnit=""
          />
          <SliderRow
            label="Soglia dettagli scuri (zip neri, metalli)"
            help="Cattura anche pixel scuri non saturi: zip neri, ferramenta brunita. 0 = disabilita"
            value={params.detailDarkThreshold}
            min={0}
            max={120}
            step={1}
            onChange={v => update({ detailDarkThreshold: v })}
            displayUnit=""
          />
          <SliderRow
            label="Feather (sfocatura bordi)"
            help="Soft edge applicato a tutte le 3 mappe"
            value={params.featherPx}
            min={0}
            max={6}
            step={0.5}
            onChange={v => update({ featherPx: v })}
            displayUnit=" px"
          />
          <SliderRow
            label="Intensità dettagli"
            help="Opacità mappa dettagli (zip e ferramenta)"
            value={params.detailStrength}
            min={0}
            max={1}
            step={0.05}
            onChange={v => update({ detailStrength: v })}
            displayPrecision={2}
            displayUnit=""
          />
          <SliderRow
            label="Intensità ombre"
            help="Moltiplicatore opacità mappa ombre"
            value={params.shadowStrength}
            min={0}
            max={1}
            step={0.05}
            onChange={v => update({ shadowStrength: v })}
            displayPrecision={2}
            displayUnit=""
          />
          <SliderRow
            label="Intensità luci"
            help="Moltiplicatore opacità mappa luci"
            value={params.highlightStrength}
            min={0}
            max={1}
            step={0.05}
            onChange={v => update({ highlightStrength: v })}
            displayPrecision={2}
            displayUnit=""
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row pt-2">
          <Button
            variant="ghost"
            onClick={() => setParams(DEFAULT_EXTRACT_PARAMS)}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Ripristina default
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annulla
          </Button>
          <Button
            onClick={handleSave}
            disabled={!preview || extracting || saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Salva i 3 PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* -------------------- subcomponents -------------------- */

const PreviewTile: React.FC<{
  label: string;
  src: string | null;
  bg: string;
  loading?: boolean;
}> = ({ label, src, bg, loading }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <div
      className="border border-border rounded-md aspect-square relative overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: bg }}
    >
      {src ? (
        <img src={src} alt={label} className="w-full h-full object-contain" />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
      {loading && (
        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
    </div>
  </div>
);

const SliderRow: React.FC<{
  label: string;
  help: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  displayUnit?: string;
  displayPrecision?: number;
}> = ({ label, help, value, min, max, step, onChange, displayUnit = '', displayPrecision = 0 }) => {
  const display = useMemo(
    () => value.toFixed(displayPrecision) + displayUnit,
    [value, displayPrecision, displayUnit]
  );
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
      <p className="text-[11px] text-muted-foreground leading-tight">{help}</p>
    </div>
  );
};

/* -------------------- composite preview -------------------- */

/**
 * Renderizza in un canvas la pipeline finale del configuratore:
 *   1. Tessuto colorato (tinta unita o texture pattern) clippato dalla silhouette
 *   2. Ombre in blend "multiply"
 *   3. Luci in blend "screen"
 *   4. Dettagli in blend "source-over" (zip, metalli)
 */
const CompositePreview: React.FC<{
  baseImageUrl: string | null;
  shadowsUrl: string | null;
  highlightsUrl: string | null;
  detailsUrl: string | null;
  sampleSource: string;
}> = ({ baseImageUrl, shadowsUrl, highlightsUrl, detailsUrl, sampleSource }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!baseImageUrl) return;

    (async () => {
      setRendering(true);
      try {
        const base = await loadImg(baseImageUrl);
        const w = base.naturalWidth;
        const h = base.naturalHeight;
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // === Step 1: costruisci una silhouette mask dal canale luma della base ===
        // I pixel quasi-bianchi (sfondo) diventano trasparenti, gli altri opachi.
        // Lavoriamo su un canvas off-screen per non sporcare il canvas finale.
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = w;
        maskCanvas.height = h;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) return;
        maskCtx.drawImage(base, 0, 0, w, h);
        const maskData = maskCtx.getImageData(0, 0, w, h);
        const md = maskData.data;
        for (let i = 0; i < md.length; i += 4) {
          const r = md[i], g = md[i + 1], b = md[i + 2];
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          // Sfondo: pixel molto chiari (>240) e quasi neutri → fuori
          const isBackground = luma > 240;
          if (isBackground) {
            md[i + 3] = 0;
          } else if (luma > 220) {
            // Bordo sfumato: alpha proporzionale
            md[i + 3] = Math.round(((240 - luma) / 20) * 255);
          } else {
            md[i + 3] = 255;
          }
        }
        maskCtx.putImageData(maskData, 0, 0);

        // === Step 2: riempi il canvas finale con la texture/colore SOLO dentro la silhouette ===
        ctx.clearRect(0, 0, w, h);

        if (sampleSource.startsWith('color:')) {
          ctx.fillStyle = sampleSource.slice(6);
          ctx.fillRect(0, 0, w, h);
        } else if (sampleSource.startsWith('url:')) {
          try {
            const tex = await loadImg(sampleSource.slice(4));
            const pattern = ctx.createPattern(tex, 'repeat');
            if (pattern) {
              ctx.fillStyle = pattern;
              ctx.fillRect(0, 0, w, h);
            }
          } catch {
            ctx.fillStyle = '#888';
            ctx.fillRect(0, 0, w, h);
          }
        }

        // === Step 3: applica le 3 maschere SOPRA il tessuto, ma sempre dentro silhouette ===
        if (shadowsUrl) {
          const sh = await loadImg(shadowsUrl);
          ctx.globalCompositeOperation = 'multiply';
          ctx.drawImage(sh, 0, 0, w, h);
        }
        if (highlightsUrl) {
          const hi = await loadImg(highlightsUrl);
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(hi, 0, 0, w, h);
        }
        if (detailsUrl) {
          const de = await loadImg(detailsUrl);
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(de, 0, 0, w, h);
        }

        // === Step 4: clip finale alla silhouette (rimuove tutto ciò che è fuori borsa) ===
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      } catch (e) {
        console.error('Composite preview failed', e);
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseImageUrl, shadowsUrl, highlightsUrl, detailsUrl, sampleSource]);

  return (
    <div className="relative w-full bg-white rounded-md overflow-hidden border border-border">
      {baseImageUrl ? (
        <canvas
          ref={canvasRef}
          className="block w-full h-auto max-h-[360px] object-contain mx-auto"
        />
      ) : (
        <div className="aspect-[3/2] flex items-center justify-center text-xs text-muted-foreground">
          Carica prima una base image
        </div>
      )}
      {rendering && baseImageUrl && (
        <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
    </div>
  );
};

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('img load failed'));
    img.src = url;
  });
}
