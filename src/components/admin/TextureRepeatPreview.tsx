/**
 * TextureRepeatPreview
 *
 * Mostra come una texture seamless si ripete su un'area ampia (tile multipli),
 * per verificare a colpo d'occhio se ci sono righe/cuciture visibili.
 *
 * Tre viste:
 *  - Tile 3×3 alla scala nominale
 *  - Tile fitto (preview "borsa" zoom-out, ~6×6)
 *  - Tile singolo (controllo del bordo)
 */

import React, { useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';

interface Props {
  url: string | null;
  /** Scala pattern del tessuto (1.0 = dimensione nominale del tile). */
  patternScale?: number;
  /** Modalità repeat (solo informativo qui — la preview ripete sempre). */
  repeatMode?: string;
}

export const TextureRepeatPreview: React.FC<Props> = ({
  url,
  patternScale = 1,
  repeatMode = 'repeat',
}) => {
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!url) {
      setNaturalSize(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setNaturalSize(null);
    img.src = url;
  }, [url]);

  if (!url) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
        Carica una texture per vedere l'anteprima della ripetizione.
      </div>
    );
  }

  // Dimensioni di tile nei vari box (in px CSS).
  // - scaledTile: ~3×3 tile per quadrato (controllo cucitura)
  // - bagTile: simula come appare la grana sulla borsa reale; tile più piccolo = grana più fine.
  // Modulati dalla scala pattern del tessuto.
  const baseTile = 96; // px
  const scaledTile = Math.max(24, Math.round(baseTile * patternScale));
  const bagTile = Math.max(40, Math.round(110 * patternScale));

  const sharedBg: React.CSSProperties = {
    backgroundImage: `url(${url})`,
    backgroundRepeat: 'repeat',
    imageRendering: 'auto',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Anteprima ripetizione (tile reali)</Label>
        <span className="text-[11px] text-muted-foreground">
          {naturalSize ? `${naturalSize.w}×${naturalSize.h}px` : '—'} · scala {patternScale} · {repeatMode}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Tile 3×3 a scala nominale */}
        <div className="space-y-1.5">
          <div
            className="w-full aspect-square rounded-md border border-border overflow-hidden bg-muted/20"
            style={{ ...sharedBg, backgroundSize: `${scaledTile}px ${scaledTile}px` }}
            aria-label="Anteprima tile a scala nominale"
          />
          <p className="text-[11px] text-muted-foreground text-center">
            Scala nominale (~{scaledTile}px)
          </p>
        </div>

        {/* Vista "borsa" — tile più grande per vedere la grana come appare sul prodotto reale */}
        <div className="space-y-1.5">
          <div
            className="w-full aspect-square rounded-md border border-border overflow-hidden bg-muted/20"
            style={{ ...sharedBg, backgroundSize: `${bagTile}px ${bagTile}px` }}
            aria-label="Anteprima tile vista borsa"
          />
          <p className="text-[11px] text-muted-foreground text-center">
            Vista "borsa" (~{bagTile}px) — grana reale
          </p>
        </div>

        {/* Tile singolo per ispezionare il bordo */}
        <div className="space-y-1.5">
          <div className="w-full aspect-square rounded-md border border-border overflow-hidden bg-muted/20 flex items-center justify-center">
            <img
              src={url}
              alt="Tile singolo"
              className="max-w-full max-h-full object-contain"
              style={{ imageRendering: 'auto' }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Tile singolo (bordo)
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Se vedi <strong>righe verticali/orizzontali</strong> regolari nei tile ripetuti, la texture
        non è perfettamente seamless: passa per il <em>Texture Lab</em> per rigenerarla.
      </p>
    </div>
  );
};
