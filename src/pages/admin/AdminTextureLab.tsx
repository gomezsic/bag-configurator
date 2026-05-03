/**
 * AdminTextureLab — Generatore di texture seamless da foto reali.
 *
 * Pipeline (un solo algoritmo "Auto" robusto, no scelta tra varianti):
 *  1. Auto-crop sulla zona più uniforme della foto (opzionale, on di default)
 *  2. Lighting flatten controllabile (correzione gradiente di luce)
 *  3. Edge blend wraparound (cuciture distribuite ai bordi, niente croce centrale)
 *
 * Override manuali: 3 slider (luce, ampiezza blend, scala output) + un toggle.
 *
 * Bottone "Migliora con AI" opzionale: passa il tile pre-processato a
 * Gemini Image (via edge function) per ripulire le ultime tracce di cucitura.
 *
 * Preview:
 *  - Originale vs Risultato (1 tile, stessa scala)
 *  - Test cucitura 3×3 (per validare visivamente le giunture)
 *  - Anteprima sulla borsa (texture applicata sopra una bag_view reale)
 */

import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, Save, Wand2, ImageIcon, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  generateSeamless,
  drawTilePreview,
  canvasToBlob,
  canvasToDataURL,
  dataURLToCanvas,
  loadImage,
} from '@/lib/textureSeamless';
import { uploadAsset } from '@/lib/uploadAsset';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const PREVIEW_SIZE = 480;
const SEAM_TEST_SIZE = 720;
const BAG_PREVIEW_SIZE = 720;

const AdminTextureLab: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);

  // Parametri pipeline (solo override manuali — il preset di default è già buono)
  const [lightingFlatten, setLightingFlatten] = useState(0.6);
  const [edgeBlend, setEdgeBlend] = useState(0.15);
  const [tileSize, setTileSize] = useState(1024);
  const [autoCropUniform, setAutoCropUniform] = useState(true);

  const [processing, setProcessing] = useState(false);
  const [resultCanvas, setResultCanvas] = useState<HTMLCanvasElement | null>(null);

  // AI assist
  const [aiBusy, setAiBusy] = useState(false);

  // Form per il nuovo fabric
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPriceMod, setNewPriceMod] = useState(0);
  const [saving, setSaving] = useState(false);

  const sourcePreviewRef = useRef<HTMLCanvasElement>(null);
  const resultPreviewRef = useRef<HTMLCanvasElement>(null);
  const tilePreviewRef = useRef<HTMLCanvasElement>(null);
  const bagPreviewRef = useRef<HTMLCanvasElement>(null);

  /* ------- Caricamento file ------- */
  const handleFile = async (f: File) => {
    setFile(f);
    setResultCanvas(null);
    setNewName(f.name.replace(/\.[^.]+$/, '') + ' (seamless)');
    try {
      const img = await loadImage(f);
      setSourceImg(img);
    } catch {
      toast.error('Impossibile caricare l\'immagine');
    }
  };

  /* ------- Preview sorgente: 1 tile a piena scala ------- */
  useEffect(() => {
    if (!sourceImg || !sourcePreviewRef.current) return;
    const c = sourcePreviewRef.current;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, c.width, c.height);
    // Crop quadrato centrale per parità con il risultato
    const W = sourceImg.naturalWidth;
    const H = sourceImg.naturalHeight;
    const side = Math.min(W, H);
    const sx = (W - side) / 2;
    const sy = (H - side) / 2;
    ctx.drawImage(sourceImg, sx, sy, side, side, 0, 0, c.width, c.height);
  }, [sourceImg]);

  /* ------- Generazione texture seamless ------- */
  const runProcess = async () => {
    if (!sourceImg) return;
    setProcessing(true);
    try {
      const out = await generateSeamless(sourceImg, {
        tileSize,
        autoCropUniform,
      });
      setResultCanvas(out);
      drawAllPreviews(out);
    } catch (e) {
      console.error(e);
      toast.error('Errore durante la generazione');
    } finally {
      setProcessing(false);
    }
  };

  const drawAllPreviews = (out: HTMLCanvasElement) => {
    if (resultPreviewRef.current) {
      const c = resultPreviewRef.current;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(out, 0, 0, c.width, c.height);
    }
    if (tilePreviewRef.current) {
      drawTilePreview(out, tilePreviewRef.current, 3);
    }
  };

  // Auto-run al cambio sorgente o parametri (debounced)
  useEffect(() => {
    if (!sourceImg) return;
    const t = setTimeout(() => {
      runProcess();
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceImg, lightingFlatten, edgeBlend, tileSize, autoCropUniform]);

  /* ------- Preview sulla borsa ------- */
  const bagView = useQuery({
    queryKey: ['admin-texture-lab-bag-view'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bag_views')
        .select('id, base_image_url, canvas_width, canvas_height, view_type')
        .eq('is_active', true)
        .not('base_image_url', 'is', null)
        .order('sort_order')
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const drawBag = async () => {
      if (!resultCanvas || !bagPreviewRef.current || !bagView.data?.base_image_url) return;
      const baseImg = await loadImage(bagView.data.base_image_url).catch(() => null);
      if (!baseImg) return;
      const c = bagPreviewRef.current;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      // Pattern texturizzato di sfondo
      const pattern = ctx.createPattern(resultCanvas, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, c.width, c.height);
      }
      // Base image della borsa sopra (multiply per dare la forma)
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(baseImg, 0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(baseImg, 0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'source-over';
    };
    drawBag();
  }, [resultCanvas, bagView.data?.base_image_url]);

  /* ------- AI assist ------- */
  const handleAiEnhance = async () => {
    if (!resultCanvas) return;
    setAiBusy(true);
    try {
      const dataUrl = canvasToDataURL(resultCanvas);
      const { data, error } = await supabase.functions.invoke('enhance-texture', {
        body: { imageDataUrl: dataUrl },
      });
      if (error) throw new Error(error.message || 'AI request failed');
      if (data?.error) throw new Error(data.error);
      const aiUrl: string | undefined = data?.imageDataUrl;
      if (!aiUrl) throw new Error('Risposta AI vuota');
      const enhanced = await dataURLToCanvas(aiUrl);
      // Riapplichiamo l'edge blend per garantire la perfetta tile-ability
      // anche dopo che l'AI ha rimaneggiato i pixel.
      const finalC = await generateSeamless(
        await loadImage(canvasToDataURL(enhanced)),
        {
          tileSize: enhanced.width,
          autoCropUniform: false,
        }
      );
      setResultCanvas(finalC);
      drawAllPreviews(finalC);
      toast.success('Texture migliorata con AI');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Errore AI');
    } finally {
      setAiBusy(false);
    }
  };

  /* ------- Salvataggio nuovo fabric ------- */
  const handleSave = async () => {
    if (!resultCanvas) {
      toast.error('Genera prima la texture');
      return;
    }
    if (!newName.trim()) {
      toast.error('Inserisci un nome per il nuovo tessuto');
      return;
    }
    setSaving(true);
    try {
      const blob = await canvasToBlob(resultCanvas);
      const seamlessFile = new File(
        [blob],
        `${newName.toLowerCase().replace(/\s+/g, '-')}.png`,
        { type: 'image/png' }
      );
      const url = await uploadAsset(seamlessFile, 'seamless-textures', newName);

      const slug =
        newName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') +
        '-' +
        Date.now().toString(36);

      const { error } = await supabase.from('fabrics').insert({
        name: newName.trim(),
        slug,
        category: newCategory.trim() || null,
        texture_url: url,
        thumbnail_url: url,
        price_modifier: newPriceMod,
        repeat_mode: 'repeat',
        pattern_scale: 1,
        is_active: true,
      });
      if (error) throw error;

      toast.success(`Nuovo tessuto "${newName}" creato`);
      setNewName('');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Wand2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Texture Lab — Seamless Generator</h2>
      </div>
      <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
        Carica una foto di tessuto. Lo strumento individua la zona più uniforme, normalizza la
        luce e fonde i bordi opposti per ottenere una texture <strong>tile-able senza giunture</strong>.
        Tutti i parametri hanno già un preset robusto: regola solo se serve.
      </p>

      {/* Upload */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {file ? 'Cambia immagine' : 'Carica foto tessuto'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {file && (
            <span className="text-xs text-muted-foreground truncate">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </span>
          )}
        </div>
      </Card>

      {sourceImg && (
        <>
          {/* Controlli — pochi e semplici */}
          <Card className="p-4 grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex justify-between">
                Correzione luce
                <span className="text-muted-foreground">{Math.round(lightingFlatten * 100)}%</span>
              </Label>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[lightingFlatten]}
                onValueChange={v => setLightingFlatten(v[0])}
              />
              <p className="text-[11px] text-muted-foreground leading-snug">
                Rimuove il gradiente di luce della foto. Alza per foto con ombre o vignettatura.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex justify-between">
                Ampiezza fusione bordi
                <span className="text-muted-foreground">{Math.round(edgeBlend * 100)}%</span>
              </Label>
              <Slider
                min={0.05}
                max={0.4}
                step={0.01}
                value={[edgeBlend]}
                onValueChange={v => setEdgeBlend(v[0])}
              />
              <p className="text-[11px] text-muted-foreground leading-snug">
                Larghezza della cornice in cui i bordi opposti si fondono. Più alta = transizione più morbida.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Auto-crop zona uniforme</Label>
                <Switch checked={autoCropUniform} onCheckedChange={setAutoCropUniform} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex justify-between">
                  Dim. tile
                  <span className="text-muted-foreground">{tileSize}px</span>
                </Label>
                <Slider
                  min={512}
                  max={2048}
                  step={128}
                  value={[tileSize]}
                  onValueChange={v => setTileSize(v[0])}
                />
              </div>
            </div>
          </Card>

          {/* AI assist bar */}
          <Card className="p-3 flex items-center gap-3 flex-wrap">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
              Le giunture residue sono ancora visibili? Lascia che l'AI ripulisca il tile mantenendo
              colore e pattern.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAiEnhance}
              disabled={!resultCanvas || aiBusy || processing}
              className="gap-2"
            >
              {aiBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Migliora con AI
            </Button>
          </Card>

          {/* Preview: 2 colonne grandi affiancate */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <ImageIcon className="h-3.5 w-3.5" />
                Originale (1 tile)
              </div>
              <canvas
                ref={sourcePreviewRef}
                width={PREVIEW_SIZE}
                height={PREVIEW_SIZE}
                className="w-full aspect-square border border-border bg-muted/30"
              />
              <p className="text-[11px] text-muted-foreground">
                Crop quadrato centrale della foto sorgente.
              </p>
            </Card>

            <Card className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Wand2 className="h-3.5 w-3.5 text-primary" />
                Risultato seamless (1 tile · {tileSize}px)
                {processing && (
                  <Loader2 className="h-3 w-3 animate-spin ml-auto text-muted-foreground" />
                )}
              </div>
              <canvas
                ref={resultPreviewRef}
                width={PREVIEW_SIZE}
                height={PREVIEW_SIZE}
                className="w-full aspect-square border border-border bg-muted/30"
              />
              <p className="text-[11px] text-muted-foreground">
                Texture processata, pronta per essere ripetuta.
              </p>
            </Card>
          </div>

          {/* Test cucitura: 3×3 — il vero validatore */}
          <Card className="p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
              Test cucitura (3×3) — qui devi NON vedere ripetizioni
            </div>
            <canvas
              ref={tilePreviewRef}
              width={SEAM_TEST_SIZE}
              height={SEAM_TEST_SIZE}
              className="w-full max-w-[720px] mx-auto aspect-square border border-border bg-muted/30 block"
            />
            <p className="text-[11px] text-muted-foreground text-center">
              Se non distingui le 9 tile = la texture è seamless.
            </p>
          </Card>

          {/* Anteprima sulla borsa */}
          {bagView.data && (
            <Card className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Wand2 className="h-3.5 w-3.5 text-primary" />
                Anteprima sulla borsa ({bagView.data.view_type})
              </div>
              <canvas
                ref={bagPreviewRef}
                width={BAG_PREVIEW_SIZE}
                height={BAG_PREVIEW_SIZE}
                className="w-full max-w-[720px] mx-auto aspect-square border border-border bg-muted/30 block"
              />
              <p className="text-[11px] text-muted-foreground text-center">
                Texture applicata come pattern sulla forma della borsa, per giudicare la scala finale.
              </p>
            </Card>
          )}

          {/* Save form */}
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Salva come nuovo tessuto</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Neoprene Turchese (seamless)"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria (opzionale)</Label>
                <Input
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  placeholder="neoprene / cotone / ..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modifier prezzo (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newPriceMod}
                  onChange={e => setNewPriceMod(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!resultCanvas || saving}
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salva nuovo tessuto
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminTextureLab;
