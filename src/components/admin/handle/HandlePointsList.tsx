/**
 * HandlePointsList
 *
 * Lista numerica modificabile dei punti della centerline. Permette di:
 *  - selezionare un punto (sync col canvas)
 *  - editare numericamente x, y, width
 *  - cancellare un punto
 *  - reorder via frecce su/giù
 *  - "↔ centra sulla mask": riposiziona x sul baricentro dell'alpha
 *    della maschera lungo la riga del punto (perpendicolare alla tangente locale)
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronUp, ChevronDown, Trash2, Crosshair } from 'lucide-react';
import { HandlePathDocument } from '@/engine/handlePath';
import { toast } from 'sonner';

interface Props {
  doc: HandlePathDocument;
  selectedIndex: number | null;
  onChange: (doc: HandlePathDocument) => void;
  onSelectIndex: (idx: number | null) => void;
  /** URL della maschera del manico (alpha = manico). Serve per "centra sulla mask". */
  maskUrl?: string | null;
}

/** Carica un'immagine cross-origin in HTMLImageElement. */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

/**
 * Estrae i pixel alpha della mask in un OffscreenCanvas-like buffer.
 * Cache singletona per evitare ri-decode ad ogni click.
 */
const maskCache: Map<string, { w: number; h: number; data: Uint8ClampedArray }> = new Map();
async function getMaskAlpha(url: string) {
  const cached = maskCache.get(url);
  if (cached) return cached;
  const img = await loadImage(url);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas ctx');
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  const entry = { w: c.width, h: c.height, data: id.data };
  maskCache.set(url, entry);
  return entry;
}

const HandlePointsList: React.FC<Props> = ({
  doc,
  selectedIndex,
  onChange,
  onSelectIndex,
  maskUrl,
}) => {
  const path = doc.paths[0];
  if (!path) return null;

  const updatePoint = (i: number, patch: Partial<{ x: number; y: number; width: number }>) => {
    const points = path.points.map((p, idx) =>
      idx === i ? { ...p, ...patch } : p,
    );
    onChange({ ...doc, paths: doc.paths.map((p, k) => (k === 0 ? { ...p, points } : p)) });
  };

  const removePoint = (i: number) => {
    const points = path.points.filter((_, idx) => idx !== i);
    onChange({ ...doc, paths: doc.paths.map((p, k) => (k === 0 ? { ...p, points } : p)) });
    if (selectedIndex === i) onSelectIndex(null);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= path.points.length) return;
    const points = [...path.points];
    [points[i], points[j]] = [points[j], points[i]];
    onChange({ ...doc, paths: doc.paths.map((p, k) => (k === 0 ? { ...p, points } : p)) });
    onSelectIndex(j);
  };

  /**
   * Centra il punto i sul baricentro dell'alpha della maschera.
   * Strategia in 2 step:
   *  1) prova lo scan lungo la normale alla curva (caso ideale: punto già vicino al manico)
   *  2) se la normale non incrocia alpha, fa uno scan radiale a raggio crescente
   *     per trovare il pixel opaco più vicino ovunque, poi ricentra lì.
   */
  const centerOnMask = async (i: number) => {
    if (!maskUrl) {
      toast.error('Mask non disponibile per questo manico');
      return;
    }
    try {
      const { w, h, data } = await getMaskAlpha(maskUrl);
      const points = path.points;
      const p = points[i];
      const alphaAt = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return 0;
        return data[(y * w + x) * 4 + 3];
      };

      // ── Origine dello scan: punto corrente, oppure pixel opaco più vicino ──
      let cx = p.x;
      let cy = p.y;

      if (alphaAt(Math.round(cx), Math.round(cy)) < 16) {
        // Scan radiale a raggio crescente per trovare la mask
        let found = false;
        const maxR = Math.max(w, h);
        outer: for (let r = 4; r < maxR; r += 4) {
          const steps = Math.max(16, Math.round(r * 0.5));
          for (let k = 0; k < steps; k++) {
            const ang = (k / steps) * Math.PI * 2;
            const sx = Math.round(p.x + Math.cos(ang) * r);
            const sy = Math.round(p.y + Math.sin(ang) * r);
            if (alphaAt(sx, sy) >= 64) {
              cx = sx;
              cy = sy;
              found = true;
              break outer;
            }
          }
        }
        if (!found) {
          toast.error('Nessuna alpha trovata nella mask. Controlla il file.');
          return;
        }
      }

      // ── Tangente locale dai vicini ──
      const prev = points[i - 1] ?? p;
      const next = points[i + 1] ?? p;
      let tx = next.x - prev.x;
      let ty = next.y - prev.y;
      const tlen = Math.hypot(tx, ty) || 1;
      tx /= tlen;
      ty /= tlen;
      const nx = -ty;
      const ny = tx;

      // Range generoso: usa width o 200px come fallback
      const maxDist = Math.max(200, (p.width || 60) * 2);
      const samples = 201;

      let sumA = 0;
      let sumOff = 0;
      let firstHit: number | null = null;
      let lastHit: number | null = null;

      for (let s = 0; s < samples; s++) {
        const t = (s / (samples - 1)) * 2 - 1;
        const off = t * maxDist;
        const sx = Math.round(cx + nx * off);
        const sy = Math.round(cy + ny * off);
        const a = alphaAt(sx, sy);
        if (a < 16) continue;
        sumA += a;
        sumOff += off * a;
        if (firstHit === null) firstHit = off;
        lastHit = off;
      }

      if (sumA === 0 || firstHit === null || lastHit === null) {
        // Fallback finale: usa direttamente il pixel trovato dal radial scan
        updatePoint(i, { x: cx, y: cy });
        toast.success(`Punto ${i + 1} agganciato alla mask (width invariata)`);
        return;
      }

      const offCentroid = sumOff / sumA;
      const newX = cx + nx * offCentroid;
      const newY = cy + ny * offCentroid;
      const localWidth = Math.max(8, lastHit - firstHit);

      updatePoint(i, { x: newX, y: newY, width: localWidth });
      toast.success(`Punto ${i + 1} centrato (width ≈ ${Math.round(localWidth)}px)`);
    } catch (e) {
      console.error(e);
      toast.error('Impossibile leggere la mask (CORS o file mancante)');
    }
  };

  return (
    <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
      {path.points.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-2 py-3">
          Nessun punto. Clicca sul canvas per aggiungerne.
        </p>
      )}
      {path.points.map((p, i) => {
        const sel = i === selectedIndex;
        return (
          <div
            key={i}
            className={`grid grid-cols-[24px_1fr_1fr_1fr_auto] gap-1 items-center px-1 py-1 rounded text-xs ${
              sel ? 'bg-primary/15 border border-primary/40' : 'hover:bg-muted/40'
            }`}
            onMouseDown={() => onSelectIndex(i)}
          >
            <span className="text-center font-mono text-muted-foreground">{i + 1}</span>
            <Input
              type="number"
              value={Math.round(p.x)}
              className="h-7 px-1 text-xs"
              onChange={(e) => updatePoint(i, { x: parseFloat(e.target.value) || 0 })}
              title="x"
            />
            <Input
              type="number"
              value={Math.round(p.y)}
              className="h-7 px-1 text-xs"
              onChange={(e) => updatePoint(i, { y: parseFloat(e.target.value) || 0 })}
              title="y"
            />
            <Input
              type="number"
              value={Math.round(p.width)}
              className="h-7 px-1 text-xs"
              onChange={(e) => updatePoint(i, { width: parseFloat(e.target.value) || 0 })}
              title="width"
            />
            <div className="flex">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  centerOnMask(i);
                }}
                title="Centra sulla mask (riposiziona sul baricentro alpha lungo la normale)"
                disabled={!maskUrl}
              >
                <Crosshair className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, -1)}>
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, 1)}>
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive"
                onClick={() => removePoint(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HandlePointsList;
