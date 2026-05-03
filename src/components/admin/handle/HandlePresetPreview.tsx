/**
 * HandlePresetPreview
 *
 * Componente di anteprima riusabile per un preset manico.
 * Carica gli asset (mask, eventuali overlay) e renderizza il manico curvato
 * con il preset corrente, su una vista borsa scelta.
 *
 * Modalità:
 *  - "curved": mostra il rendering reale sul canvas della vista (path + mask)
 *  - "flat":   mostra una barra orizzontale con la suddivisione U del preset
 */

import React, { useEffect, useRef, useState } from 'react';
import { renderHandleToCanvas } from '@/engine/handleStripeRenderer';
import { presetToUBands } from '@/engine/handlePreset';
import type { HandlePatternPreset } from '@/engine/handlePreset';
import type { HandlePathDocument } from '@/engine/handlePath';
import { resolveSidePartPathDocument } from '@/engine/sidePartPathFallback';

interface SidePartAsset {
  /** Documento path della fettuccia (canvasWidth/Height = stessi della vista) */
  doc: HandlePathDocument;
  maskUrl: string | null;
  shadowUrl?: string | null;
  highlightUrl?: string | null;
}

interface CurvedPreviewProps {
  mode: 'curved';
  preset: HandlePatternPreset;
  doc: HandlePathDocument;
  baseImageUrl: string | null;
  maskUrl: string | null;
  shadowUrl?: string | null;
  highlightUrl?: string | null;
  detailsUrl?: string | null;
  hardwareUrl?: string | null;
  /** Fettuccine laterali da disegnare con lo stesso preset */
  sideParts?: SidePartAsset[];
  /** Disegna centerline + punti + fascia width sopra il rendering. */
  showCenterline?: boolean;
  className?: string;
}

interface FlatPreviewProps {
  mode: 'flat';
  preset: HandlePatternPreset;
  className?: string;
}

type Props = CurvedPreviewProps | FlatPreviewProps;

function HandlePresetPreview(props: Props) {
  if (props.mode === 'flat') return <FlatPreview {...props} />;
  return <CurvedPreview {...props} />;
}

// ── Flat ────────────────────────────────────────────────────────────────────

const FlatPreview: React.FC<FlatPreviewProps> = ({ preset, className }) => {
  const bands = presetToUBands(preset);
  return (
    <div
      className={`relative w-full h-12 rounded border border-border overflow-hidden bg-muted/30 ${className ?? ''}`}
    >
      {/* margini bianchi laterali */}
      {bands.map((b) => (
        <div
          key={b.index}
          className="absolute top-0 bottom-0"
          style={{
            left: `${b.uLeft * 100}%`,
            width: `${(b.uRight - b.uLeft) * 100}%`,
            background: b.color,
          }}
        />
      ))}
    </div>
  );
};

// ── Curved ──────────────────────────────────────────────────────────────────

function loadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const CurvedPreview: React.FC<CurvedPreviewProps> = ({
  preset,
  doc,
  baseImageUrl,
  maskUrl,
  shadowUrl,
  highlightUrl,
  detailsUrl,
  hardwareUrl,
  sideParts,
  showCenterline,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [base, setBase] = useState<HTMLImageElement | null>(null);
  const [mask, setMask] = useState<HTMLImageElement | null>(null);
  const [shadow, setShadow] = useState<HTMLImageElement | null>(null);
  const [highlight, setHighlight] = useState<HTMLImageElement | null>(null);
  const [details, setDetails] = useState<HTMLImageElement | null>(null);
  const [hardware, setHardware] = useState<HTMLImageElement | null>(null);
  // Side parts: per ognuna {mask, shadow, highlight} caricate
  const [sideAssets, setSideAssets] = useState<
    Array<{ mask: HTMLImageElement | null; shadow: HTMLImageElement | null; highlight: HTMLImageElement | null }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadImage(baseImageUrl),
      loadImage(maskUrl),
      loadImage(shadowUrl),
      loadImage(highlightUrl),
      loadImage(detailsUrl),
      loadImage(hardwareUrl),
    ]).then(([b, m, sh, hi, de, hw]) => {
      if (cancelled) return;
      setBase(b);
      setMask(m);
      setShadow(sh);
      setHighlight(hi);
      setDetails(de);
      setHardware(hw);
    });
    return () => {
      cancelled = true;
    };
  }, [baseImageUrl, maskUrl, shadowUrl, highlightUrl, detailsUrl, hardwareUrl]);

  // Carica asset delle fettuccine in parallelo
  useEffect(() => {
    let cancelled = false;
    if (!sideParts || sideParts.length === 0) {
      setSideAssets([]);
      return;
    }
    Promise.all(
      sideParts.map(async (sp) => {
        const [m, sh, hi] = await Promise.all([
          loadImage(sp.maskUrl),
          loadImage(sp.shadowUrl),
          loadImage(sp.highlightUrl),
        ]);
        return { mask: m, shadow: sh, highlight: hi };
      })
    ).then((res) => {
      if (!cancelled) setSideAssets(res);
    });
    return () => {
      cancelled = true;
    };
  }, [sideParts]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const cw = doc.canvasWidth;
    const ch = doc.canvasHeight;
    const dpr = window.devicePixelRatio || 1;

    // Fit to container preservando aspect ratio
    const rect = container.getBoundingClientRect();
    const scale = Math.min(rect.width / cw, rect.height / ch);
    const displayW = cw * scale;
    const displayH = ch * scale;

    canvas.width = Math.max(1, Math.round(displayW * dpr));
    canvas.height = Math.max(1, Math.round(displayH * dpr));
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    if (base) {
      ctx.drawImage(base, 0, 0, cw, ch);
    } else {
      ctx.fillStyle = 'hsl(220 13% 18%)';
      ctx.fillRect(0, 0, cw, ch);
    }

    if (mask && doc.paths[0]?.points.length >= 2 && cw > 0 && ch > 0) {
      try {
        const handle = renderHandleToCanvas({
          doc,
          preset,
          assets: { mask, shadow, highlight, details, hardware },
        });
        if (handle.width > 0 && handle.height > 0) {
          ctx.drawImage(handle, 0, 0, cw, ch);
        }
      } catch (e) {
        console.warn('[HandlePresetPreview] renderHandleToCanvas failed', e);
      }
    }

    // Disegna le fettuccine laterali con lo stesso preset
    if (sideParts && sideAssets.length === sideParts.length) {
      sideParts.forEach((sp, i) => {
        const a = sideAssets[i];
        if (!a.mask) return;
        const sideDoc = resolveSidePartPathDocument(sp.doc, a.mask, cw, ch, 0);
        if (!sideDoc || sideDoc.canvasWidth <= 0 || sideDoc.canvasHeight <= 0) return;
        try {
          const sideCanvas = renderHandleToCanvas({
            doc: sideDoc,
            preset,
            assets: { mask: a.mask, shadow: a.shadow, highlight: a.highlight, details: null, hardware: null },
          });
          if (sideCanvas.width > 0 && sideCanvas.height > 0) {
            ctx.drawImage(sideCanvas, 0, 0, cw, ch);
          }
        } catch (e) {
          console.warn('[HandlePresetPreview] side renderHandleToCanvas failed', e);
        }
      });
    }

    // Debug overlay: centerline, punti, fascia width
    if (showCenterline) {
      const path = doc.paths[0];
      if (path && path.points.length >= 1) {
        const pts = path.points;

        // Fascia width semitrasparente (bbox ~ width attorno alla centerline)
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)'; // sky-400 / 18%
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const wA = a.width / 2;
          const wB = b.width / 2;
          ctx.beginPath();
          ctx.moveTo(a.x + nx * wA, a.y + ny * wA);
          ctx.lineTo(b.x + nx * wB, b.y + ny * wB);
          ctx.lineTo(b.x - nx * wB, b.y - ny * wB);
          ctx.lineTo(a.x - nx * wA, a.y - ny * wA);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // Centerline
        ctx.save();
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.95)'; // pink-400
        ctx.lineWidth = Math.max(2, cw * 0.0025);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        pts.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();

        // Punti + numerazione
        ctx.save();
        const r = Math.max(4, cw * 0.005);
        ctx.font = `${Math.max(10, cw * 0.012)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        pts.forEach((p, i) => {
          ctx.fillStyle = 'rgba(244, 114, 182, 1)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.fillText(String(i + 1), p.x, p.y - r - 6);
        });
        ctx.restore();

        // Badge n° punti in alto a sinistra
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(8, 8, 130, 28);
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(11, cw * 0.012)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Punti: ${pts.length}`, 16, 22);
        ctx.restore();
      }
    }
  }, [doc, preset, base, mask, shadow, highlight, details, hardware, showCenterline, sideParts, sideAssets]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-muted/20 border border-border rounded overflow-hidden flex items-center justify-center ${className ?? ''}`}
    >
      <canvas ref={canvasRef} />
      {!mask && (
        <p className="absolute text-xs text-muted-foreground">
          Nessuna mask manico per questa vista — assegna gli asset nell'editor manico.
        </p>
      )}
    </div>
  );
};

export default HandlePresetPreview;
