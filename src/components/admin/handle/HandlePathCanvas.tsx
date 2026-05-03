/**
 * HandlePathCanvas
 *
 * Canvas interattivo per editare la centerline di un manico.
 *
 * Funzionalità:
 *  - mostra il PNG mask del manico (se presente) come sfondo
 *  - click vicino a un segmento esistente → inserisce un punto FRA i due
 *    estremi del segmento (gli indici successivi si scalano da soli)
 *  - click su area lontana da ogni segmento → aggiunge un nuovo punto in coda
 *  - alt+click → forza l'inserimento su segmento con soglia più stretta
 *  - drag su un punto → sposta il punto
 *  - shift+click su un punto → cancella il punto
 *  - mostra la polilinea che connette i punti
 *  - mostra una "strip" (banda) di anteprima usando la width per punto
 *  - zoom con la rotellina, pan con drag su area vuota + spazio (oppure tasto medio)
 *  - selezione punto attivo (cerchio evidenziato) per editare width
 *
 * Tutto il rendering è Canvas 2D, deterministico, senza AI.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  HandlePathDocument,
  HandlePoint,
  findNearestPointIndex,
  findNearestSegmentIndex,
} from '@/engine/handlePath';

interface Props {
  doc: HandlePathDocument;
  maskUrl: string | null;
  baseImageUrl?: string | null;
  selectedIndex: number | null;
  onChange: (doc: HandlePathDocument) => void;
  onSelectIndex: (idx: number | null) => void;
  defaultWidth: number;
  showMask: boolean;
  showStrip: boolean;
}

const HIT_THRESHOLD_CSS = 14; // px schermo per hit-test punti
const SEGMENT_THRESHOLD_CSS = 10; // soglia "stretta" per Alt+click esplicito
const SEGMENT_THRESHOLD_AUTO_CSS = 28; // soglia "generosa" per auto-insert al click semplice

const HandlePathCanvas: React.FC<Props> = ({
  doc,
  maskUrl,
  baseImageUrl,
  selectedIndex,
  onChange,
  onSelectIndex,
  defaultWidth,
  showMask,
  showStrip,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskImgRef = useRef<HTMLImageElement | null>(null);
  const baseImgRef = useRef<HTMLImageElement | null>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [panning, setPanning] = useState<{ x: number; y: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  // Carica mask. Reset immediato quando l'URL cambia o diventa null,
  // così cambiando tab (Manico → Fettuccia) non resta visibile la mask precedente.
  useEffect(() => {
    maskImgRef.current = null;
    draw();
    if (!maskUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      maskImgRef.current = img;
      draw();
    };
    img.src = maskUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maskUrl]);

  // Carica base image (sfondo borsa) opzionale
  useEffect(() => {
    if (!baseImageUrl) {
      baseImgRef.current = null;
      draw();
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      baseImgRef.current = img;
      draw();
    };
    img.src = baseImageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseImageUrl]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setContainerSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Fit to container quando cambia mask o canvas size
  useEffect(() => {
    if (!doc.canvasWidth || !doc.canvasHeight) return;
    const sx = containerSize.w / doc.canvasWidth;
    const sy = containerSize.h / doc.canvasHeight;
    const s = Math.min(sx, sy) * 0.95;
    if (!isFinite(s) || s <= 0) return;
    setScale(s);
    setOffset({
      x: (containerSize.w - doc.canvasWidth * s) / 2,
      y: (containerSize.h - doc.canvasHeight * s) / 2,
    });
  }, [doc.canvasWidth, doc.canvasHeight, containerSize.w, containerSize.h]);

  const path = doc.paths[0];

  // Conversioni coordinate
  const toCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        x: (sx - offset.x) / scale,
        y: (sy - offset.y) / scale,
      };
    },
    [offset.x, offset.y, scale],
  );

  // Disegno
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerSize.w * dpr;
    canvas.height = containerSize.h * dpr;
    canvas.style.width = `${containerSize.w}px`;
    canvas.style.height = `${containerSize.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Sfondo neutro
    ctx.fillStyle = 'hsl(220 13% 13%)';
    ctx.fillRect(0, 0, containerSize.w, containerSize.h);

    // Cornice canvas logico
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Background bag photo (opzionale)
    if (baseImgRef.current) {
      ctx.globalAlpha = 0.45;
      ctx.drawImage(baseImgRef.current, 0, 0, doc.canvasWidth, doc.canvasHeight);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'hsl(220 13% 18%)';
      ctx.fillRect(0, 0, doc.canvasWidth, doc.canvasHeight);
    }

    // Mask sovrapposta
    if (showMask && maskImgRef.current) {
      ctx.globalAlpha = baseImgRef.current ? 0.55 : 0.85;
      ctx.drawImage(maskImgRef.current, 0, 0, doc.canvasWidth, doc.canvasHeight);
      ctx.globalAlpha = 1;
    }

    // Strip preview (banda larga in base alle width per punto)
    if (showStrip && path && path.points.length >= 2) {
      drawStrip(ctx, path.points);
    }

    // Centerline: stessa curva lisciata usata dalla banda, non segmenti grezzi.
    // Così i tratti 8-9-10 si comportano come 12-13-14-15 e non creano
    // triangoli/strati visivi sopra la linea centrale.
    if (path && path.points.length > 0) {
      drawCenterline(ctx, path.points);
    }

    // Punti
    if (path) {
      path.points.forEach((p, i) => {
        const isSel = i === selectedIndex;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (isSel ? 7 : 5) / scale, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? 'hsl(0 84% 60%)' : 'hsl(48 96% 53%)';
        ctx.fill();
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeStyle = 'hsl(220 13% 8%)';
        ctx.stroke();

        // numero punto
        ctx.fillStyle = 'hsl(220 13% 8%)';
        ctx.font = `${10 / scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i + 1}`, p.x, p.y);
      });
    }

    ctx.restore();
  }, [
    containerSize.w,
    containerSize.h,
    offset.x,
    offset.y,
    scale,
    doc.canvasWidth,
    doc.canvasHeight,
    showMask,
    showStrip,
    path,
    selectedIndex,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  const sampleSmoothPath = (points: HandlePoint[], samplesPerSegment = 18) => {
    if (points.length < 2) return points.map((p) => ({ ...p }));

    const clamp = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
    const catmull = (a: number, b: number, c: number, d: number, t: number) => {
      const t2 = t * t;
      const t3 = t2 * t;
      return 0.5 * (
        2 * b +
        (-a + c) * t +
        (2 * a - 5 * b + 4 * c - d) * t2 +
        (-a + 3 * b - 3 * c + d) * t3
      );
    };

    const out: HandlePoint[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = clamp(i - 1);
      const p1 = clamp(i);
      const p2 = clamp(i + 1);
      const p3 = clamp(i + 2);
      const last = i === points.length - 2;
      for (let s = 0; s < samplesPerSegment + (last ? 1 : 0); s++) {
        const t = s / samplesPerSegment;
        out.push({
          x: catmull(p0.x, p1.x, p2.x, p3.x, t),
          y: catmull(p0.y, p1.y, p2.y, p3.y, t),
          width: catmull(p0.width, p1.width, p2.width, p3.width, t),
        });
      }
    }
    return out;
  };

  const drawCenterline = (ctx: CanvasRenderingContext2D, points: HandlePoint[]) => {
    const smooth = sampleSmoothPath(points, 18);
    if (smooth.length === 0) return;

    ctx.lineWidth = 2 / scale;
    ctx.strokeStyle = 'hsl(199 89% 60%)';
    ctx.beginPath();
    smooth.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  };

  const drawStrip = (ctx: CanvasRenderingContext2D, points: HandlePoint[]) => {
    // Calcola due polyline laterali offset perpendicolari sulla curva lisciata,
    // non sui segmenti grezzi tra punti. Questo evita triangoli/strati sopra
    // la centerline quando un punto viene inserito in curva (es. 8-9-10).
    const smooth = sampleSmoothPath(points, 18);
    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];

    for (let i = 0; i < smooth.length; i++) {
      const prev = smooth[i - 1] ?? smooth[i];
      const next = smooth[i + 1] ?? smooth[i];
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const len = Math.sqrt(tx * tx + ty * ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      const w = (smooth[i].width ?? 50) / 2;
      left.push({ x: smooth[i].x + nx * w, y: smooth[i].y + ny * w });
      right.push({ x: smooth[i].x - nx * w, y: smooth[i].y - ny * w });
    }
    ctx.beginPath();
    left.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fillStyle = 'hsla(199, 89%, 60%, 0.18)';
    ctx.fill();
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = 'hsla(199, 89%, 60%, 0.6)';
    ctx.stroke();
  };

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent) => {
    const isMiddle = e.button === 1;
    const isAlt = e.altKey;
    const isShift = e.shiftKey;
    const { x, y } = toCanvasCoords(e.clientX, e.clientY);

    if (isMiddle || (e.button === 0 && e.metaKey) || (e.button === 0 && e.ctrlKey)) {
      setPanning({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }

    if (e.button !== 0) return;

    // hit test punti
    const threshold = HIT_THRESHOLD_CSS / scale;
    const hitIdx = findNearestPointIndex(path.points, x, y, threshold);

    if (hitIdx >= 0) {
      if (isShift) {
        // delete
        const newPts = path.points.filter((_, i) => i !== hitIdx);
        commitPoints(newPts);
        onSelectIndex(null);
        return;
      }
      onSelectIndex(hitIdx);
      setDraggingIdx(hitIdx);
      return;
    }

    // Inserimento intelligente:
    //  - Alt+click → soglia "stretta" su qualunque segmento (anche corto/lontano)
    //  - click semplice → soglia "generosa": se sei vicino a un segmento esistente
    //    inserisco LÌ (gli indici successivi si scalano automaticamente),
    //    altrimenti appendo in coda. Così editi senza dover mai usare Alt.
    if (path.points.length >= 2) {
      const threshold = isAlt
        ? SEGMENT_THRESHOLD_CSS / scale
        : SEGMENT_THRESHOLD_AUTO_CSS / scale;
      const segIdx = findNearestSegmentIndex(path.points, x, y, threshold);
      if (segIdx >= 0) {
        const w = (path.points[segIdx].width + path.points[segIdx + 1].width) / 2;
        const newPts = [...path.points];
        newPts.splice(segIdx + 1, 0, { x, y, width: w });
        commitPoints(newPts);
        // Selezioniamo il punto appena inserito; gli indici successivi (segIdx+2…)
        // si rinumerano da soli al prossimo render della lista.
        onSelectIndex(segIdx + 1);
        setDraggingIdx(segIdx + 1);
        return;
      }
    }

    // Append in coda solo se siamo davvero lontani da ogni segmento esistente
    const newPts = [...path.points, { x, y, width: defaultWidth }];
    commitPoints(newPts);
    onSelectIndex(newPts.length - 1);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (panning) {
      setOffset({ x: e.clientX - panning.x, y: e.clientY - panning.y });
      return;
    }
    if (draggingIdx === null) return;
    const { x, y } = toCanvasCoords(e.clientX, e.clientY);
    const newPts = path.points.map((p, i) =>
      i === draggingIdx ? { ...p, x, y } : p,
    );
    commitPoints(newPts);
  };

  const onMouseUp = () => {
    setDraggingIdx(null);
    setPanning(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    const newScale = Math.max(0.05, Math.min(8, scale * (1 + delta)));
    // zoom verso il cursore
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const cx = (sx - offset.x) / scale;
    const cy = (sy - offset.y) / scale;
    const newOffsetX = sx - cx * newScale;
    const newOffsetY = sy - cy * newScale;
    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  const commitPoints = (points: HandlePoint[]) => {
    onChange({
      ...doc,
      paths: doc.paths.map((p, i) => (i === 0 ? { ...p, points } : p)),
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-background border border-border rounded-md overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: draggingIdx !== null ? 'grabbing' : panning ? 'grabbing' : 'crosshair' }}
      />
      <div className="absolute top-2 left-2 text-[10px] text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded border border-border">
        Click = nuovo punto · Alt+click su linea = inserisci · Shift+click su punto = cancella · Drag = sposta · Wheel = zoom · Ctrl/Cmd+drag = pan
      </div>
      <div className="absolute top-2 right-2 text-[10px] font-mono text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded border border-border">
        zoom {(scale * 100).toFixed(0)}% · {path?.points.length ?? 0} punti
      </div>
    </div>
  );
};

export default HandlePathCanvas;
