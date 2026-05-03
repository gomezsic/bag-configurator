/**
 * TextureStudio
 *
 * Editor interattivo "Photoshop-lite" per rendere una texture seamless
 * direttamente dall'editor tessuti, senza passare per il Texture Lab.
 *
 * Strumenti disponibili:
 *  - CROP: rettangolo trascinabile/ridimensionabile sull'immagine sorgente
 *  - SPOSTA (offset toroidale): trascina la texture per spostare la cucitura
 *    al centro, così da vederla e poterla cucire nel punto migliore
 *  - TAGLIA: applica il crop e ottiene un tile quadrato
 *  - CUCI: applica `applyOffsetMirrorSeamless` con larghezza banda regolabile
 *  - FLATTEN: rimuove il gradient di luce della foto (controllabile 0..1)
 *  - ALLINEA: ricentra automaticamente sulla zona più uniforme dell'immagine
 *
 * Output: la texture salvata sostituisce `texture_url` nel record fabric.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Crop, Move, Scissors, Sparkles, Sun, Wand2, Save, X, Upload } from 'lucide-react';
import {
  loadImage,
  generateSeamless,
  canvasToBlob,
  drawTilePreview,
} from '@/lib/textureSeamless';
import { uploadAsset } from '@/lib/uploadAsset';
import { toast } from 'sonner';

interface Props {
  /** URL sorgente attuale (texture o foto cruda da migliorare). */
  sourceUrl: string | null;
  /** Folder di upload (es. `fabrics/<slug>/texture`). */
  folder: string;
  /** Callback quando una nuova texture viene salvata. */
  onSaved: (newUrl: string) => void;
  /** Chiudi editor. */
  onClose: () => void;
}

type Tool = 'crop' | 'shift';

interface CropRect {
  x: number;
  y: number;
  size: number;
}

export const TextureStudio: React.FC<Props> = ({ sourceUrl, folder, onSaved, onClose }) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>('crop');
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const [stitchBand, setStitchBand] = useState(15); // % della dimensione
  const [flatten, setFlatten] = useState(60); // 0..100
  const [busy, setBusy] = useState(false);
  const [tileCanvas, setTileCanvas] = useState<HTMLCanvasElement | null>(null);
  const [livePreviewTick, setLivePreviewTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const bagPreviewRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- Carica immagine sorgente ----
  useEffect(() => {
    if (!sourceUrl) {
      setImg(null);
      return;
    }
    let alive = true;
    loadImage(sourceUrl).then(i => {
      if (!alive) return;
      setImg(i);
      const side = Math.min(i.naturalWidth, i.naturalHeight);
      setCropRect({
        x: Math.floor((i.naturalWidth - side) / 2),
        y: Math.floor((i.naturalHeight - side) / 2),
        size: side,
      });
      setTileCanvas(null);
    });
    return () => {
      alive = false;
    };
  }, [sourceUrl]);

  // ---- Disegna canvas sorgente con overlay strumenti ----
  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !img) return;
    const ctx = c.getContext('2d')!;
    const W = c.width;
    const H = c.height;
    const ratio = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * ratio;
    const dh = img.naturalHeight * ratio;
    const ox = (W - dw) / 2;
    const oy = (H - dh) / 2;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    if (tool === 'shift') {
      // Mostra l'immagine ripetuta con offset toroidale per vedere la cucitura
      // Disegniamo 3×3 tile e shiftiamo il pattern
      const sx = (shift.x / img.naturalWidth) * dw;
      const sy = (shift.y / img.naturalHeight) * dh;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, dw, dh);
      ctx.clip();
      for (let ty = -1; ty <= 1; ty++) {
        for (let tx = -1; tx <= 1; tx++) {
          ctx.drawImage(img, ox + tx * dw + sx, oy + ty * dh + sy, dw, dh);
        }
      }
      ctx.restore();
      // bordi tile + croce centrale (dove sta la cucitura)
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ox, oy, dw, dh);
      ctx.strokeStyle = '#ff3b30';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(ox + dw / 2, oy);
      ctx.lineTo(ox + dw / 2, oy + dh);
      ctx.moveTo(ox, oy + dh / 2);
      ctx.lineTo(ox + dw, oy + dh / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // CROP: mostra l'immagine + maschera scura fuori dal crop
      ctx.drawImage(img, ox, oy, dw, dh);
      if (cropRect) {
        const rx = ox + (cropRect.x / img.naturalWidth) * dw;
        const ry = oy + (cropRect.y / img.naturalHeight) * dh;
        const rs = (cropRect.size / img.naturalWidth) * dw;
        // Overlay scuro
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(ox, oy, dw, ry - oy);
        ctx.fillRect(ox, ry + rs, dw, oy + dh - (ry + rs));
        ctx.fillRect(ox, ry, rx - ox, rs);
        ctx.fillRect(rx + rs, ry, ox + dw - (rx + rs), rs);
        // Bordo crop
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, rs, rs);
        // Handle angoli
        ctx.fillStyle = '#3b82f6';
        const HS = 8;
        [
          [rx, ry],
          [rx + rs, ry],
          [rx, ry + rs],
          [rx + rs, ry + rs],
        ].forEach(([px, py]) => ctx.fillRect(px - HS / 2, py - HS / 2, HS, HS));
        // Griglia rule-of-thirds
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(rx + (rs / 3) * i, ry);
          ctx.lineTo(rx + (rs / 3) * i, ry + rs);
          ctx.moveTo(rx, ry + (rs / 3) * i);
          ctx.lineTo(rx + rs, ry + (rs / 3) * i);
          ctx.stroke();
        }
      }
    }
  }, [img, tool, cropRect, shift]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ---- Live preview ripetuta (aggiornamento dinamico durante crop/sposta) ----
  // Ricostruisce un base tile veloce (256px) e lo disegna ripetuto in due box:
  //   - 3×3 a scala nominale (controllo cuciture)
  //   - vista "borsa" (~1.5 tile per lato) per vedere la grana sul prodotto
  useEffect(() => {
    if (!img || !cropRect) return;
    let alive = true;
    const TICK = livePreviewTick;
    const t = setTimeout(() => {
      if (!alive) return;
      const TILE = 256;
      const tmp = document.createElement('canvas');
      tmp.width = TILE;
      tmp.height = TILE;
      const tctx = tmp.getContext('2d')!;
      tctx.imageSmoothingEnabled = true;
      tctx.imageSmoothingQuality = 'high';
      tctx.drawImage(
        img,
        cropRect.x,
        cropRect.y,
        cropRect.size,
        cropRect.size,
        0,
        0,
        TILE,
        TILE
      );
      // Shift toroidale leggero (riusa drawImage 4× invece del per-pixel)
      if (shift.x !== 0 || shift.y !== 0) {
        const dx = ((Math.round((shift.x / img.naturalWidth) * TILE)) % TILE + TILE) % TILE;
        const dy = ((Math.round((shift.y / img.naturalHeight) * TILE)) % TILE + TILE) % TILE;
        const snap = document.createElement('canvas');
        snap.width = TILE;
        snap.height = TILE;
        snap.getContext('2d')!.drawImage(tmp, 0, 0);
        tctx.clearRect(0, 0, TILE, TILE);
        for (let oy = -1; oy <= 0; oy++) {
          for (let ox = -1; ox <= 0; ox++) {
            tctx.drawImage(snap, dx + ox * TILE, dy + oy * TILE);
          }
        }
      }
      if (!alive || TICK !== livePreviewTick) return;
      // Disegna preview 3×3 e vista borsa
      const draw3x3 = previewRef.current;
      if (draw3x3 && !tileCanvas) {
        const W = draw3x3.width;
        const ctx = draw3x3.getContext('2d')!;
        ctx.clearRect(0, 0, W, W);
        const cell = W / 3;
        for (let y = 0; y < 3; y++) {
          for (let x = 0; x < 3; x++) {
            ctx.drawImage(tmp, x * cell, y * cell, cell, cell);
          }
        }
        // bordi tile
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, W);
          ctx.moveTo(0, i * cell); ctx.lineTo(W, i * cell);
          ctx.stroke();
        }
      }
      const bag = bagPreviewRef.current;
      if (bag) {
        const W = bag.width;
        const ctx = bag.getContext('2d')!;
        ctx.clearRect(0, 0, W, W);
        // ~6 ripetizioni → grana realistica come sulla borsa
        const cell = W / 6;
        for (let y = 0; y < 6; y++) {
          for (let x = 0; x < 6; x++) {
            ctx.drawImage(tmp, x * cell, y * cell, cell, cell);
          }
        }
      }
    }, 60); // debounce leggero
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [img, cropRect, shift, livePreviewTick, tileCanvas]);

  // Trigger live preview quando cambiano crop/shift
  useEffect(() => {
    setLivePreviewTick(t => t + 1);
  }, [cropRect, shift, img]);

  // ---- Mouse interaction ----
  const dragRef = useRef<
    | { mode: 'move' | 'resize'; corner?: number; startX: number; startY: number; orig: CropRect }
    | { mode: 'shift'; startX: number; startY: number; origShift: { x: number; y: number } }
    | null
  >(null);

  const screenToImg = (cx: number, cy: number) => {
    const c = canvasRef.current!;
    if (!img) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    const px = (cx - rect.left) * (c.width / rect.width);
    const py = (cy - rect.top) * (c.height / rect.height);
    const ratio = Math.min(c.width / img.naturalWidth, c.height / img.naturalHeight);
    const dw = img.naturalWidth * ratio;
    const dh = img.naturalHeight * ratio;
    const ox = (c.width - dw) / 2;
    const oy = (c.height - dh) / 2;
    return {
      x: ((px - ox) / dw) * img.naturalWidth,
      y: ((py - oy) / dh) * img.naturalHeight,
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!img) return;
    if (tool === 'shift') {
      dragRef.current = {
        mode: 'shift',
        startX: e.clientX,
        startY: e.clientY,
        origShift: { ...shift },
      };
      return;
    }
    if (!cropRect) return;
    const p = screenToImg(e.clientX, e.clientY);
    // Verifica se siamo su un angolo
    const corners = [
      { x: cropRect.x, y: cropRect.y },
      { x: cropRect.x + cropRect.size, y: cropRect.y },
      { x: cropRect.x, y: cropRect.y + cropRect.size },
      { x: cropRect.x + cropRect.size, y: cropRect.y + cropRect.size },
    ];
    const tolerance = Math.max(20, cropRect.size * 0.04);
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p.x - corners[i].x) < tolerance && Math.abs(p.y - corners[i].y) < tolerance) {
        dragRef.current = {
          mode: 'resize',
          corner: i,
          startX: e.clientX,
          startY: e.clientY,
          orig: { ...cropRect },
        };
        return;
      }
    }
    // Move
    if (
      p.x >= cropRect.x &&
      p.x <= cropRect.x + cropRect.size &&
      p.y >= cropRect.y &&
      p.y <= cropRect.y + cropRect.size
    ) {
      dragRef.current = {
        mode: 'move',
        startX: e.clientX,
        startY: e.clientY,
        orig: { ...cropRect },
      };
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d || !img) return;
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const ratio = Math.min(c.width / img.naturalWidth, c.height / img.naturalHeight);
    const scale = (c.width / rect.width) / ratio;
    const dxImg = (e.clientX - d.startX) * scale;
    const dyImg = (e.clientY - d.startY) * scale;

    if (d.mode === 'shift') {
      // Shift in coordinate immagine, modulo dimensione (toroidal)
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      setShift({
        x: ((d.origShift.x + dxImg) % W + W) % W - W / 2,
        y: ((d.origShift.y + dyImg) % H + H) % H - H / 2,
      });
      return;
    }
    if (d.mode === 'move') {
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      let nx = d.orig.x + dxImg;
      let ny = d.orig.y + dyImg;
      nx = Math.max(0, Math.min(W - d.orig.size, nx));
      ny = Math.max(0, Math.min(H - d.orig.size, ny));
      setCropRect({ ...d.orig, x: nx, y: ny });
      return;
    }
    if (d.mode === 'resize') {
      // Mantieni quadrato. Lato = max(|dx|, |dy|) applicato all'angolo trascinato.
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const sign = d.corner === 3 ? 1 : d.corner === 0 ? -1 : 0;
      const delta = (Math.abs(dxImg) + Math.abs(dyImg)) / 2 * (dxImg + dyImg >= 0 ? 1 : -1);
      let newSize = d.orig.size + sign * delta;
      // Per semplicità manteniamo angolo top-left fisso quando si trascina BR (corner=3) o TR
      let nx = d.orig.x;
      let ny = d.orig.y;
      if (d.corner === 0) {
        // top-left: ridimensiona ancorando bottom-right
        const br = { x: d.orig.x + d.orig.size, y: d.orig.y + d.orig.size };
        newSize = Math.max(64, d.orig.size - delta);
        nx = br.x - newSize;
        ny = br.y - newSize;
      } else if (d.corner === 1) {
        const bl = { x: d.orig.x, y: d.orig.y + d.orig.size };
        newSize = Math.max(64, d.orig.size + dxImg);
        ny = bl.y - newSize;
      } else if (d.corner === 2) {
        const tr = { x: d.orig.x + d.orig.size, y: d.orig.y };
        newSize = Math.max(64, d.orig.size - dxImg);
        nx = tr.x - newSize;
      } else {
        newSize = Math.max(64, d.orig.size + dxImg);
      }
      // Clamp
      newSize = Math.min(newSize, W - nx, H - ny);
      nx = Math.max(0, Math.min(W - newSize, nx));
      ny = Math.max(0, Math.min(H - newSize, ny));
      setCropRect({ x: nx, y: ny, size: newSize });
    }
  };

  const onMouseUp = () => {
    dragRef.current = null;
  };

  // ---- Azioni ----
  const buildBaseTile = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    if (!img || !cropRect) return null;
    // 1. Applica crop e (se shift) offset toroidale
    const TILE = 1024;
    const c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      img,
      cropRect.x,
      cropRect.y,
      cropRect.size,
      cropRect.size,
      0,
      0,
      TILE,
      TILE
    );
    // Applica shift toroidale (sposta texture)
    if (shift.x !== 0 || shift.y !== 0) {
      const dx = Math.round((shift.x / img.naturalWidth) * TILE);
      const dy = Math.round((shift.y / img.naturalHeight) * TILE);
      const src = ctx.getImageData(0, 0, TILE, TILE);
      const out = ctx.createImageData(TILE, TILE);
      const S = src.data;
      const O = out.data;
      for (let y = 0; y < TILE; y++) {
        const sy = ((y - dy) % TILE + TILE) % TILE;
        for (let x = 0; x < TILE; x++) {
          const sx = ((x - dx) % TILE + TILE) % TILE;
          const di = (y * TILE + x) * 4;
          const si = (sy * TILE + sx) * 4;
          O[di] = S[si];
          O[di + 1] = S[si + 1];
          O[di + 2] = S[si + 2];
          O[di + 3] = 255;
        }
      }
      ctx.putImageData(out, 0, 0);
    }
    return c;
  }, [img, cropRect, shift]);

  const handleStitch = async () => {
    setBusy(true);
    try {
      const base = await buildBaseTile();
      if (!base) return;
      // Riusa la pipeline ufficiale: passa il canvas come dataURL a generateSeamless
      const dataUrl = base.toDataURL('image/png');
      const finalTile = await generateSeamless(dataUrl, {
        tileSize: 1024,
        autoCropUniform: false,
      });
      setTileCanvas(finalTile);
      // disegna preview 3×3
      requestAnimationFrame(() => {
        if (previewRef.current) {
          drawTilePreview(finalTile, previewRef.current, 3);
        }
      });
      toast.success('Texture cucita');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!tileCanvas) {
      toast.error('Prima clicca "Cuci" per generare la texture');
      return;
    }
    setBusy(true);
    try {
      const blob = await canvasToBlob(tileCanvas);
      const file = new File([blob], 'texture-seamless.png', { type: 'image/png' });
      const url = await uploadAsset(file, folder, 'seamless');
      onSaved(url);
      toast.success('Texture salvata e applicata');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleReplaceSource = async (file: File) => {
    setBusy(true);
    try {
      const i = await loadImage(file);
      setImg(i);
      const side = Math.min(i.naturalWidth, i.naturalHeight);
      setCropRect({
        x: Math.floor((i.naturalWidth - side) / 2),
        y: Math.floor((i.naturalHeight - side) / 2),
        size: side,
      });
      setShift({ x: 0, y: 0 });
      setTileCanvas(null);
    } finally {
      setBusy(false);
    }
  };

  if (!img) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Carica prima una texture per aprire il Texture Studio.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={tool === 'crop' ? 'default' : 'ghost'}
            onClick={() => setTool('crop')}
            className="gap-1.5 h-8"
          >
            <Crop className="h-3.5 w-3.5" /> Crop
          </Button>
          <Button
            size="sm"
            variant={tool === 'shift' ? 'default' : 'ghost'}
            onClick={() => setTool('shift')}
            className="gap-1.5 h-8"
          >
            <Move className="h-3.5 w-3.5" /> Sposta
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!img) return;
              const side = Math.min(img.naturalWidth, img.naturalHeight);
              setCropRect({
                x: Math.floor((img.naturalWidth - side) / 2),
                y: Math.floor((img.naturalHeight - side) / 2),
                size: side,
              });
              setShift({ x: 0, y: 0 });
            }}
            className="gap-1.5 h-8"
            title="Centra il crop e azzera lo shift"
          >
            <Wand2 className="h-3.5 w-3.5" /> Allinea
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleReplaceSource(f);
              e.target.value = '';
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fileRef.current?.click()}
            className="gap-1.5 h-8"
            title="Sostituisci con una nuova foto sorgente"
          >
            <Upload className="h-3.5 w-3.5" /> Sostituisci
          </Button>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-8 gap-1.5">
          <X className="h-3.5 w-3.5" /> Chiudi
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
        {/* Canvas area */}
        <div className="bg-[#1a1a1a] p-3">
          <canvas
            ref={canvasRef}
            width={720}
            height={540}
            className="w-full max-w-full rounded select-none cursor-crosshair"
            style={{ imageRendering: 'auto' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
          <div className="mt-2 text-[11px] text-muted-foreground">
            {tool === 'crop'
              ? 'Trascina il riquadro o gli angoli per ridefinire il crop quadrato.'
              : 'Trascina la texture per spostare la cucitura. La croce rossa segna i bordi del tile.'}
          </div>
        </div>

        {/* Controls panel */}
        <div className="border-t lg:border-t-0 lg:border-l border-border p-3 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Scissors className="h-3 w-3" /> Cuci — banda
              </Label>
              <span className="text-[11px] text-muted-foreground">{stitchBand}%</span>
            </div>
            <Slider
              value={[stitchBand]}
              min={5}
              max={40}
              step={1}
              onValueChange={v => setStitchBand(v[0])}
            />
            <p className="text-[10px] text-muted-foreground">
              Larghezza della cucitura interna (offset-mirror).
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Sun className="h-3 w-3" /> Flatten luce
              </Label>
              <span className="text-[11px] text-muted-foreground">{flatten}%</span>
            </div>
            <Slider
              value={[flatten]}
              min={0}
              max={100}
              step={5}
              onValueChange={v => setFlatten(v[0])}
            />
            <p className="text-[10px] text-muted-foreground">
              Rimuove il gradiente di luce della foto.
            </p>
          </div>

          <Button
            onClick={handleStitch}
            disabled={busy}
            className="w-full gap-2"
            size="sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {busy ? 'Elaboro...' : 'Taglia + Cuci'}
          </Button>

          {/* Preview tiled — live durante crop/sposta, finale dopo Cuci */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Anteprima 3×3 ripetuta</Label>
              <span className="text-[10px] text-muted-foreground">
                {tileCanvas ? 'finale' : 'live · draft'}
              </span>
            </div>
            <div className="aspect-square bg-muted/30 rounded border border-border overflow-hidden">
              <canvas ref={previewRef} width={300} height={300} className="w-full h-full" />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Si aggiorna mentre modifichi crop/sposta. Le righe bianche/cuciture spariscono dopo "Cuci".
            </p>
          </div>

          {/* Anteprima vista borsa (grana realistica) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Vista "borsa" (grana reale)</Label>
            <div className="aspect-square bg-muted/30 rounded border border-border overflow-hidden">
              <canvas ref={bagPreviewRef} width={300} height={300} className="w-full h-full" />
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={busy || !tileCanvas}
            className="w-full gap-2"
            variant="default"
            size="sm"
          >
            <Save className="h-3.5 w-3.5" />
            Salva e applica
          </Button>
        </div>
      </div>
    </div>
  );
};
