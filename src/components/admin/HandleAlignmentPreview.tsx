/**
 * HandleAlignmentPreview
 *
 * Pannello che mostra l'anteprima dell'allineamento manici dopo un import.
 * - Toggle "Originale" vs "Render completo"
 *   · Originale = base_image_url della view (foto sfondo trasparente, senza
 *     overlay manici / side parts / texture).
 *   · Render completo = scena composta dal motore con maschere, manico,
 *     side parts e overlay attuali.
 * - Modalità "Confronto" (split view) per vedere entrambi affiancati.
 * - Modalità "Sovrapposto" con slider opacità per allineare a occhio.
 *
 * Pensato per essere mostrato subito dopo un import in /admin/upload.
 */

import React, { useState, useMemo } from 'react';
import { useRenderingData } from '@/hooks/useRenderingData';
import { BagCanvas } from '@/components/BagCanvas';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Eye, EyeOff, Layers, ArrowLeftRight, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface HandleAlignmentPreviewProps {
  bagModelId: string;
  bagViewId: string;
  viewType?: string;
  /** Forza il refresh (es. timestamp dell'import). Ricarica gli asset. */
  refreshKey?: string | number;
}

type Mode = 'toggle' | 'split' | 'overlay';

export const HandleAlignmentPreview: React.FC<HandleAlignmentPreviewProps> = ({
  bagModelId,
  bagViewId,
  viewType = 'front',
  refreshKey,
}) => {
  const [mode, setMode] = useState<Mode>('toggle');
  const [showAfter, setShowAfter] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [debugCenterline, setDebugCenterline] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const queryClient = useQueryClient();

  const { scene, isLoading, error } = useRenderingData({
    bagModelId,
    viewType,
    fabricId: null,
    handleId: null,
    handleColorId: null,
    embroideryId: null,
  });

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        'analyze-handle-geometry',
        { body: { bagViewId } },
      );
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      toast.success(
        `Geometria rigenerata: manico ${data.mainPoints} punti, side L=${data.sideLoops.left} R=${data.sideLoops.right}`,
      );
      // Invalida tutte le query rendering per forzare re-fetch dei nuovi path_json
      await queryClient.invalidateQueries({ queryKey: ['bag-view'] });
      await queryClient.invalidateQueries({ queryKey: ['handle-geometry'] });
      await queryClient.invalidateQueries({ queryKey: ['handle-side-parts'] });
      await queryClient.invalidateQueries({ queryKey: ['rendering-scene'] });
    } catch (e) {
      toast.error(`Analisi AI fallita: ${(e as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // Aggiungiamo il refreshKey come busting agli URL per forzare reload
  const baseImageUrl = useMemo(() => {
    const url = scene?.view.baseImageUrl;
    if (!url) return null;
    return refreshKey ? `${url}${url.includes('?') ? '&' : '?'}t=${refreshKey}` : url;
  }, [scene?.view.baseImageUrl, refreshKey]);

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg p-6 bg-card">
        <p className="text-sm text-muted-foreground">Caricamento anteprima allineamento…</p>
      </div>
    );
  }

  if (error || !scene) {
    return (
      <div className="border border-destructive/40 rounded-lg p-6 bg-destructive/5">
        <p className="text-sm text-foreground">
          Impossibile caricare l'anteprima: {error?.message ?? 'view non trovata'}
        </p>
      </div>
    );
  }

  const canvasInfo = `${scene.view.canvasWidth}×${scene.view.canvasHeight}px`;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Anteprima allineamento manici
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Canvas {canvasInfo} · {scene.view.maskZones.length} zone ·{' '}
            {scene.view.handleGeometry?.sideParts.length ?? 0} side parts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="gap-1.5"
          >
            {analyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {analyzing ? 'Analisi AI…' : 'Rigenera con AI'}
          </Button>
          <Button
            size="sm"
            variant={debugCenterline ? 'default' : 'outline'}
            onClick={() => setDebugCenterline((v) => !v)}
            className="gap-1.5"
          >
            {debugCenterline ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Centerline
          </Button>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="px-5 pt-4">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="toggle" className="gap-1.5 text-xs">
            <ArrowLeftRight className="h-3 w-3" />
            Toggle
          </TabsTrigger>
          <TabsTrigger value="split" className="text-xs">
            Affiancati
          </TabsTrigger>
          <TabsTrigger value="overlay" className="text-xs">
            Sovrapposto
          </TabsTrigger>
        </TabsList>

        {/* Modalità 1: toggle prima/dopo */}
        <TabsContent value="toggle" className="mt-4 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <Button
              size="sm"
              variant={!showAfter ? 'default' : 'outline'}
              onClick={() => setShowAfter(false)}
            >
              Originale
            </Button>
            <Button
              size="sm"
              variant={showAfter ? 'default' : 'outline'}
              onClick={() => setShowAfter(true)}
            >
              Render completo
            </Button>
            <span className="text-xs text-muted-foreground ml-2">
              {showAfter
                ? 'Maschere + manico + side parts + overlay'
                : 'Solo base_image_url (foto pulita)'}
            </span>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center min-h-[400px]">
            {showAfter ? (
              <BagCanvas
                scene={scene}
                maxDisplayWidth={600}
                maxDisplayHeight={600}
                debugCenterline={debugCenterline}
              />
            ) : (
              <OriginalImage url={baseImageUrl} canvasInfo={canvasInfo} />
            )}
          </div>
        </TabsContent>

        {/* Modalità 2: split */}
        <TabsContent value="split" className="mt-4 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Originale
              </p>
              <div className="bg-muted/30 rounded-lg p-3 flex items-center justify-center min-h-[300px]">
                <OriginalImage url={baseImageUrl} canvasInfo={canvasInfo} maxSize={400} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Render completo
              </p>
              <div className="bg-muted/30 rounded-lg p-3 flex items-center justify-center min-h-[300px]">
                <BagCanvas
                  scene={scene}
                  maxDisplayWidth={400}
                  maxDisplayHeight={400}
                  debugCenterline={debugCenterline}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Modalità 3: sovrapposto con opacità */}
        <TabsContent value="overlay" className="mt-4 pb-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground w-32">
                Opacità render
              </span>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[overlayOpacity]}
                onValueChange={(v) => setOverlayOpacity(v[0] ?? 0.5)}
                className="flex-1 max-w-md"
              />
              <span className="text-xs tabular-nums text-foreground w-10">
                {Math.round(overlayOpacity * 100)}%
              </span>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center min-h-[400px] relative">
              <div className="relative" style={{ maxWidth: 600, width: '100%' }}>
                <OriginalImage url={baseImageUrl} canvasInfo={canvasInfo} maxSize={600} />
                <div
                  className="absolute inset-0 pointer-events-none flex items-center justify-center"
                  style={{ opacity: overlayOpacity }}
                >
                  <BagCanvas
                    scene={scene}
                    maxDisplayWidth={600}
                    maxDisplayHeight={600}
                    debugCenterline={debugCenterline}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Trascina lo slider per confrontare visivamente la posizione dei manici
              renderizzati con quelli nella foto originale.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const OriginalImage: React.FC<{
  url: string | null;
  canvasInfo: string;
  maxSize?: number;
}> = ({ url, canvasInfo, maxSize = 600 }) => {
  if (!url) {
    return (
      <div className="text-sm text-muted-foreground p-8 text-center">
        Nessuna base_image_url impostata sulla view.
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={`Originale ${canvasInfo}`}
      style={{ maxWidth: `${maxSize}px`, maxHeight: `${maxSize}px`, width: '100%', height: 'auto' }}
      className="block object-contain"
    />
  );
};

export default HandleAlignmentPreview;
