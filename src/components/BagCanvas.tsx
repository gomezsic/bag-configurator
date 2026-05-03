/**
 * BagCanvas
 * 
 * React component that renders a bag configuration using the 2D layer engine.
 * Handles asset preloading, canvas setup, and re-rendering on selection changes.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { RenderScene } from '@/engine/types';
import { preloadSceneAssets } from '@/engine/assetLoader';
import { composeScene } from '@/engine/layerComposer';

interface BagCanvasProps {
  scene: RenderScene | null;
  className?: string;
  maxDisplayWidth?: number;
  maxDisplayHeight?: number;
  onRenderComplete?: () => void;
  onRenderError?: (error: Error) => void;
  /**
   * Se true disegna un overlay di debug sul manico:
   * - centerline (linea continua)
   * - punti del path con indice
   * - fascia semitrasparente che rappresenta la larghezza locale
   * Funziona solo se `scene.view.handleGeometry?.pathDocument` è valido.
   */
  debugCenterline?: boolean;
}

export const BagCanvas: React.FC<BagCanvasProps> = ({
  scene,
  className = '',
  maxDisplayWidth = 800,
  maxDisplayHeight = 800,
  onRenderComplete,
  onRenderError,
  debugCenterline = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const render = useCallback(async () => {
    if (!scene || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { view, selection } = scene;

    // Set canvas internal resolution
    canvas.width = view.canvasWidth;
    canvas.height = view.canvasHeight;

    setIsRendering(true);
    setRenderError(null);

    try {
      // Collect all URLs to preload
      const maskUrls = view.maskZones
        .map(z => z.maskImageUrl)
        .filter((u): u is string => !!u);

      const localOverlayUrls = view.maskZones
        .map(z => z.localOverlayUrl)
        .filter((u): u is string => !!u);

      // Per-zone texture overrides (es. lato/top con un tessuto diverso dal frontale)
      const zoneTextureUrls = view.maskZones
        .map(z => z.textureUrl)
        .filter((u): u is string => !!u);

      // Preload all assets
      const overlayUrls = view.overlays?.map(o => o.url).filter(Boolean) ?? [];

      // Handle geometry assets (mask + shadow + highlight + details + hardware)
      const handleAssetUrls = view.handleGeometry
        ? [
            view.handleGeometry.maskUrl,
            view.handleGeometry.shadowUrl,
            view.handleGeometry.highlightUrl,
            view.handleGeometry.detailsUrl,
            view.handleGeometry.hardwareUrl,
            // Side parts (fettuccine laterali): mask + overlay propri
            ...view.handleGeometry.sideParts.flatMap((sp) => [
              sp.maskUrl,
              sp.shadowUrl,
              sp.highlightUrl,
            ]),
          ].filter((u): u is string => !!u)
        : [];

      console.log('[BagCanvas] Loading assets...', {
        baseImageUrl: view.baseImageUrl,
        maskUrls,
        fabricTextureUrl: selection.fabricTextureUrl?.substring(0, 60),
        handleAssets: handleAssetUrls.length,
      });

      const assets = await preloadSceneAssets(
        view.baseImageUrl,
        view.overlayUrl,
        maskUrls,
        localOverlayUrls,
        selection.fabricTextureUrl,
        selection.handleTextureUrl,
        selection.embroideryImageUrl,
        [...overlayUrls, ...handleAssetUrls, ...zoneTextureUrls]
      );

      console.log('[BagCanvas] Assets loaded:', assets.size, 'images');

      // Compose the scene
      composeScene(ctx, scene, assets);

      // Optional: debug overlay (centerline + points + width strip)
      if (debugCenterline) {
        drawCenterlineDebug(ctx, scene);
      }

      onRenderComplete?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Render failed');
      setRenderError(error.message);
      onRenderError?.(error);
      console.error('[BagCanvas] Render error:', error);
    } finally {
      setIsRendering(false);
    }
  }, [scene, debugCenterline, onRenderComplete, onRenderError]);

  // Re-render when scene changes
  useEffect(() => {
    render();
  }, [render]);

  // Calculate display size maintaining aspect ratio
  const aspectRatio = scene
    ? scene.view.canvasWidth / scene.view.canvasHeight
    : 1;

  let displayWidth = maxDisplayWidth;
  let displayHeight = displayWidth / aspectRatio;

  if (displayHeight > maxDisplayHeight) {
    displayHeight = maxDisplayHeight;
    displayWidth = displayHeight * aspectRatio;
  }

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          imageRendering: 'auto',
        }}
        className="block"
      />
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-sm text-muted-foreground">Rendering...</div>
        </div>
      )}
      {renderError && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
          <div className="text-sm text-destructive px-4 text-center">{renderError}</div>
        </div>
      )}
      {!scene && !isRendering && (
        <div
          className="flex items-center justify-center bg-muted rounded-lg"
          style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
        >
          <div className="text-sm text-muted-foreground">Nessun modello selezionato</div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Debug overlay: centerline + punti + larghezza locale (fascia semitrasparente)
// ─────────────────────────────────────────────────────────────────────────────

interface HandlePoint { x: number; y: number; width: number }
interface HandlePathLite { id: string; points: HandlePoint[] }
interface PathDocLite { name?: string; canvasWidth: number; canvasHeight: number; paths: HandlePathLite[] }

function drawCenterlineDebug(ctx: CanvasRenderingContext2D, scene: RenderScene): void {
  const geom = scene.view.handleGeometry;
  if (!geom) return;

  // Disegna doc principale + ogni side part
  const docs: Array<{ doc: PathDocLite; label: string; color: string }> = [];
  const main = geom.pathDocument as PathDocLite | null;
  if (main?.paths?.length) docs.push({ doc: main, label: 'main', color: '#22d3ee' });
  for (const sp of geom.sideParts ?? []) {
    const d = sp.pathDocument as PathDocLite | null;
    if (d?.paths?.length) docs.push({ doc: d, label: sp.partId, color: '#f472b6' });
  }
  if (!docs.length) return;

  ctx.save();
  for (const { doc, color } of docs) {
    for (const path of doc.paths) {
      if (!path.points?.length) continue;

      // 1. Fascia di larghezza locale (semitrasparente)
      ctx.fillStyle = `${color}33`; // alpha ~20%
      for (const p of path.points) {
        if (!Number.isFinite(p.width) || p.width <= 0) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Centerline
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      path.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // 3. Punti + indice
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      path.points.forEach((p, i) => {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.fillText(String(i + 1), p.x, p.y - 28);
      });
    }
  }
  ctx.restore();
}

