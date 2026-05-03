/**
 * FabricColorsEditor
 *
 * CRUD inline dei colori di un tessuto B/N (modalità "matrice + multiply").
 * Mostra una preview live per ogni colore: la texture grayscale viene
 * moltiplicata in canvas per il hex selezionato, senza generare PNG nuovi.
 *
 * Lo step "Tessuto" del configuratore mostrerà gli stessi swatch.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Palette, Save, Sparkles, Loader2 } from 'lucide-react';
import { getMultipliedTexture } from '@/lib/textureMultiply';
import { uploadAsset } from '@/lib/uploadAsset';
// textureSeamless rimosso: la generazione seamless ora avviene via edge function AI

const AI_ENHANCE_TIMEOUT_MS = 90000;

interface FabricColor {
  id: string;
  fabric_id: string;
  name: string;
  hex: string;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
  derived_fabric_id: string | null;
}

interface ParentFabric {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  pattern_scale: number;
  repeat_mode: string;
  price_modifier: number;
}

interface Props {
  parentFabric: ParentFabric;
  /** URL della texture B/N seamless usata come matrice di tutte le varianti. */
  grayscaleTextureUrl: string | null;
}

const ColorSwatch: React.FC<{ url: string | null; hex: string; size?: number }> = ({
  url,
  hex,
  size = 56,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!url) {
      setReady(false);
      return;
    }
    let alive = true;
    getMultipliedTexture(url, hex, { size: 128 }).then(c => {
      if (!alive || !ref.current) return;
      const ctx = ref.current.getContext('2d')!;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(c, 0, 0, size, size);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [url, hex, size]);

  return (
    <div
      className="rounded-md border border-border overflow-hidden bg-muted/30 shrink-0"
      style={{ width: size, height: size, backgroundColor: hex }}
      title={hex}
    >
      {url && (
        <canvas
          ref={ref}
          width={size}
          height={size}
          style={{ display: ready ? 'block' : 'none' }}
        />
      )}
    </div>
  );
};

/** Trasforma "Velluto Rosso" → "velluto-rosso". */
function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error('AI non ha risposto entro 90 secondi: operazione annullata.')), ms);
  });
}

/** Genera + carica una texture multiplied PNG full-res e ritorna l'URL pubblico. */
async function buildAndUploadDerivedTexture(
  grayscaleUrl: string,
  hex: string,
  parentSlug: string,
  colorName: string
): Promise<string> {
  // Genera a piena risoluzione (size undefined = nativa)
  const canvas = await getMultipliedTexture(grayscaleUrl, hex, { size: 1024 });
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  );
  const file = new File([blob], `${slugify(colorName) || 'color'}.png`, { type: 'image/png' });
  return uploadAsset(file, `fabrics/${parentSlug || 'misc'}/derived`, slugify(colorName) || 'color');
}

export const FabricColorsEditor: React.FC<Props> = ({ parentFabric, grayscaleTextureUrl }) => {
  const qc = useQueryClient();
  const fabricId = parentFabric.id;

  const { data: colors, isLoading } = useQuery({
    queryKey: ['fabric-colors', fabricId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fabric_colors')
        .select('*')
        .eq('fabric_id', fabricId)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as FabricColor[];
    },
    enabled: !!fabricId,
  });

  /**
   * Crea/aggiorna il record in `fabrics` derivato da un colore.
   * - se non esiste, crea nuovo fabric autonomo (compare nello step Tessuto)
   * - se esiste già (derived_fabric_id), aggiorna nome + texture multiplied
   */
  async function syncDerivedFabric(c: FabricColor): Promise<string | null> {
    if (!grayscaleTextureUrl) {
      toast.error('Carica prima la texture B/N seamless del tessuto base.');
      return null;
    }
    if (!c.name?.trim()) {
      toast.error('Dai un nome al colore prima di sincronizzarlo.');
      return null;
    }
    const textureUrl = await buildAndUploadDerivedTexture(
      grayscaleTextureUrl,
      c.hex,
      parentFabric.slug,
      c.name
    );
    const baseSlug = slugify(`${parentFabric.slug}-${c.name}`) || `tessuto-${c.id.slice(0, 8)}`;

    if (c.derived_fabric_id) {
      const { error } = await supabase
        .from('fabrics')
        .update({
          name: c.name,
          texture_url: textureUrl,
          thumbnail_url: textureUrl,
          pattern_scale: parentFabric.pattern_scale,
          repeat_mode: parentFabric.repeat_mode,
          price_modifier: parentFabric.price_modifier,
          category: parentFabric.category,
          is_active: c.is_active,
        })
        .eq('id', c.derived_fabric_id);
      if (error) throw error;
      return c.derived_fabric_id;
    }

    // Slug univoco
    const { data: existing } = await supabase.from('fabrics').select('slug');
    const taken = new Set((existing ?? []).map(x => x.slug as string).filter(Boolean));
    let finalSlug = baseSlug;
    let i = 2;
    while (taken.has(finalSlug)) finalSlug = `${baseSlug}-${i++}`;

    const { data: created, error: insErr } = await supabase
      .from('fabrics')
      .insert({
        name: c.name,
        slug: finalSlug,
        category: parentFabric.category,
        texture_url: textureUrl,
        thumbnail_url: textureUrl,
        pattern_scale: parentFabric.pattern_scale,
        repeat_mode: parentFabric.repeat_mode,
        price_modifier: parentFabric.price_modifier,
        is_active: c.is_active,
        sort_order: 0,
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    const { error: linkErr } = await supabase
      .from('fabric_colors')
      .update({ derived_fabric_id: created.id })
      .eq('id', c.id);
    if (linkErr) throw linkErr;

    return created.id as string;
  }

  const upsert = useMutation({
    mutationFn: async (c: Partial<FabricColor> & { fabric_id: string }) => {
      if (c.id) {
        const { error } = await supabase
          .from('fabric_colors')
          .update({
            name: c.name,
            hex: c.hex,
            is_active: c.is_active,
            sort_order: c.sort_order,
          })
          .eq('id', c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fabric_colors').insert({
          fabric_id: c.fabric_id,
          name: c.name ?? 'Nuovo colore',
          hex: c.hex ?? '#cccccc',
          is_active: c.is_active ?? true,
          sort_order: c.sort_order ?? (colors?.length ?? 0),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fabric-colors', fabricId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: (c: FabricColor) => syncDerivedFabric(c),
    onSuccess: (id, c) => {
      if (id) {
        toast.success(`Tessuto "${c.name}" ${c.derived_fabric_id ? 'aggiornato' : 'creato'}`);
        qc.invalidateQueries({ queryKey: ['fabric-colors', fabricId] });
        qc.invalidateQueries({ queryKey: ['admin-fabrics'] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ────────────────────────────────────────────────────────────────────────
  // AUTO-SYNC: ogni volta che la lista colori cambia (nome/hex/attivo), ri-genera
  // automaticamente i tessuti derivati senza richiedere click manuale. Usa un
  // debounce per colore così digitando il nome non parte ad ogni keystroke.
  // ────────────────────────────────────────────────────────────────────────
  const lastSyncedRef = useRef<Map<string, string>>(new Map()); // colorId -> "name|hex|active"
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!grayscaleTextureUrl) return;
    if (!colors?.length) return;

    for (const c of colors) {
      if (!c.name?.trim()) continue; // serve un nome per creare un fabric
      const sig = `${c.name.trim()}|${c.hex.toLowerCase()}|${c.is_active ? 1 : 0}`;
      if (lastSyncedRef.current.get(c.id) === sig) continue;

      // debounce 600ms per colore
      const prev = timersRef.current.get(c.id);
      if (prev) clearTimeout(prev);
      const t = setTimeout(async () => {
        try {
          const id = await syncDerivedFabric(c);
          if (id) {
            lastSyncedRef.current.set(c.id, sig);
            qc.invalidateQueries({ queryKey: ['fabric-colors', fabricId] });
            qc.invalidateQueries({ queryKey: ['admin-fabrics'] });
            toast.success(`Tessuto "${c.name}" ${c.derived_fabric_id ? 'aggiornato' : 'creato'}`);
          }
        } catch (e) {
          toast.error(`Sync "${c.name}" fallito: ${(e as Error).message}`);
        }
      }, 600);
      timersRef.current.set(c.id, t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, grayscaleTextureUrl]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
    };
  }, []);

  const remove = useMutation({
    mutationFn: async (c: FabricColor) => {
      // Elimina anche il fabric derivato (se vuoi conservarlo, rimuovi questa parte)
      if (c.derived_fabric_id) {
        await supabase.from('fabrics').delete().eq('id', c.derived_fabric_id);
      }
      const { error } = await supabase.from('fabric_colors').delete().eq('id', c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fabric-colors', fabricId] });
      qc.invalidateQueries({ queryKey: ['admin-fabrics'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ────────────────────────────────────────────────────────────────────────
  // ENHANCE WITH AI: invia la texture B/N a Gemini con un preset materiale,
  // riceve la versione migliorata, la carica come nuova texture del fabric
  // padre. L'auto-sync esistente si occuperà poi di rigenerare i derivati.
  // ────────────────────────────────────────────────────────────────────────
  const enhanceWithAI = useMutation({
    mutationFn: async (preset: 'neoprene-scuba' | 'neoprene-tech' | 'neoprene-knit') => {
      if (!grayscaleTextureUrl) throw new Error('Nessuna texture base da migliorare');

      // 1) scarica PNG attuale e convertila in data URL
      const srcResp = await fetch(grayscaleTextureUrl);
      if (!srcResp.ok) throw new Error('Impossibile scaricare la texture attuale');
      const srcBlob = await srcResp.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(srcBlob);
      });

      // 2) chiama edge function con timeout: evita spinner infinito se l'AI resta appesa
      const { data, error } = await Promise.race([
        supabase.functions.invoke('enhance-texture', {
          body: { imageDataUrl: dataUrl, hint: preset },
        }),
        timeoutPromise(AI_ENHANCE_TIMEOUT_MS),
      ]);
      if (error) throw new Error(error.message);
      if (!data?.imageDataUrl) throw new Error('AI non ha restituito immagine');

      // 3) data URL → File → upload bucket
      const aiResp = await fetch(data.imageDataUrl);
      const aiBlob = await aiResp.blob();
      const file = new File([aiBlob], `${parentFabric.slug}-ai.png`, { type: 'image/png' });
      const newUrl = await uploadAsset(file, 'fabrics/misc/texture', `${parentFabric.slug}-ai`);

      // 4) aggiorna fabric padre
      const { error: upErr } = await supabase
        .from('fabrics')
        .update({ texture_url: newUrl, thumbnail_url: newUrl })
        .eq('id', parentFabric.id);
      if (upErr) throw upErr;

      // 5) invalida la cache dei colori così l'auto-sync rigenera i derivati
      lastSyncedRef.current.clear();
      return newUrl;
    },
    onSuccess: () => {
      toast.success('Texture migliorata con AI. I colori derivati si rigenerano in automatico.');
      qc.invalidateQueries({ queryKey: ['admin-fabrics'] });
      qc.invalidateQueries({ queryKey: ['fabric-colors', fabricId] });
    },
    onError: (e: Error) => toast.error(`Enhance fallito: ${e.message}`),
  });

  /**
   * RENDI SEAMLESS — via AI (Gemini Image / Nano Banana 2):
   *  prende la FOTO REALE del tessuto e chiede al modello di estrarne un tile
   *  ripetibile, mantenendo materia, fibra e colore originali. Equivalente
   *  funzionale del flusso "Extract Pattern from Image" di Patterned.ai.
   *  Sostituisce la pipeline client-side autocorrelativa che produceva
   *  artefatti visibili (bande verticali, scacchiera, chiazze di luminosità).
   */
  const makeSeamless = useMutation({
    mutationFn: async () => {
      if (!grayscaleTextureUrl) throw new Error('Carica prima una foto del tessuto');

      // 1) scarica la foto attuale come data URL (cache-bust)
      const srcUrl =
        grayscaleTextureUrl +
        (grayscaleTextureUrl.includes('?') ? '&' : '?') +
        'cb=' + Date.now();
      const srcResp = await fetch(srcUrl);
      if (!srcResp.ok) throw new Error('Impossibile scaricare la foto del tessuto');
      const srcBlob = await srcResp.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(srcBlob);
      });

      // 2) chiama l'edge function con timeout per evitare spinner infiniti
      const materialHint = parentFabric.category || parentFabric.name || '';
      const { data, error } = await Promise.race([
        supabase.functions.invoke('seamless-from-photo', {
          body: { imageDataUrl: dataUrl, materialHint },
        }),
        timeoutPromise(AI_ENHANCE_TIMEOUT_MS),
      ]);
      if (error) throw new Error(error.message);
      if (!data?.imageDataUrl) throw new Error("AI non ha restituito un'immagine");

      // 3) data URL AI → File → upload bucket
      const aiResp = await fetch(data.imageDataUrl);
      const aiBlob = await aiResp.blob();
      const file = new File([aiBlob], `${parentFabric.slug}-seamless.png`, { type: 'image/png' });
      const newUrl = await uploadAsset(file, 'fabrics/misc/texture', `${parentFabric.slug}-seamless`);

      // 4) aggiorna fabric padre + invalida sync derivati
      const { error: upErr } = await supabase
        .from('fabrics')
        .update({ texture_url: newUrl, thumbnail_url: newUrl })
        .eq('id', parentFabric.id);
      if (upErr) throw upErr;

      lastSyncedRef.current.clear();
      return newUrl;
    },
    onSuccess: () => {
      toast.success('Texture resa seamless dalla foto reale (AI). I colori derivati si rigenerano.');
      qc.invalidateQueries({ queryKey: ['admin-fabrics'] });
      qc.invalidateQueries({ queryKey: ['fabric-colors', fabricId] });
    },
    onError: (e: Error) => toast.error(`Seamless fallito: ${e.message}`),
  });

  // ────────────────────────────────────────────────────────────────────────
  // DESATURA: porta la texture corrente in grayscale neutro luminance-based,
  // così il multiply con i colori funziona davvero. Lavora in canvas locale,
  // niente AI.
  // ────────────────────────────────────────────────────────────────────────
  const desaturate = useMutation({
    mutationFn: async () => {
      if (!grayscaleTextureUrl) throw new Error('Nessuna texture da desaturare');

      // 1) carica come Image
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Impossibile caricare la texture'));
        i.src = grayscaleTextureUrl + (grayscaleTextureUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now();
      });

      // 2) canvas → desatura con luminance + leggero stretch verso le luci
      //    così la base è chiara (#ececec circa) e i fori restano scuri.
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas non disponibile');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        // luminance Rec.709
        const y = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
        // stretch: porta i pixel chiari più chiari (target white ~245) e tieni gli scuri
        const stretched = Math.min(255, Math.max(0, (y - 30) * (245 / (220 - 30))));
        d[i] = d[i + 1] = d[i + 2] = stretched;
      }
      ctx.putImageData(imgData, 0, 0);

      // 3) blob → upload
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
      );
      const file = new File([blob], `${parentFabric.slug}-bw.png`, { type: 'image/png' });
      const newUrl = await uploadAsset(file, 'fabrics/misc/texture', `${parentFabric.slug}-bw`);

      // 4) aggiorna fabric + invalida sync derivati
      const { error: upErr } = await supabase
        .from('fabrics')
        .update({ texture_url: newUrl, thumbnail_url: newUrl })
        .eq('id', parentFabric.id);
      if (upErr) throw upErr;

      lastSyncedRef.current.clear();
      return newUrl;
    },
    onSuccess: () => {
      toast.success('Texture desaturata in B/N. I colori derivati si rigenerano.');
      qc.invalidateQueries({ queryKey: ['admin-fabrics'] });
      qc.invalidateQueries({ queryKey: ['fabric-colors', fabricId] });
    },
    onError: (e: Error) => toast.error(`Desatura fallito: ${e.message}`),
  });

  const sorted = useMemo(() => colors ?? [], [colors]);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            Colori del tessuto (matrice B/N + multiply)
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Ogni colore qui sotto può essere <strong>esportato come tessuto autonomo</strong>:
            il sistema crea un nuovo record in libreria tessuti col nome del colore e la
            texture moltiplicata già pronta. Premi <kbd className="px-1 rounded bg-muted">Crea/Aggiorna tessuto</kbd>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => desaturate.mutate()}
            disabled={!grayscaleTextureUrl || desaturate.isPending}
            title="Converte la texture in grayscale neutro per il multiply colore"
          >
            {desaturate.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Palette className="h-3.5 w-3.5" />
            )}
            Desatura B/N
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => makeSeamless.mutate()}
            disabled={!grayscaleTextureUrl || makeSeamless.isPending}
            title="Estrae un tile seamless dalla foto reale via AI (Gemini Image), preservando materia, fibra e colore originali"
          >
            {makeSeamless.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Rendi seamless
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => enhanceWithAI.mutate('neoprene-scuba')}
            disabled={!grayscaleTextureUrl || enhanceWithAI.isPending}
            title="Rigenera la texture B/N con Gemini come neoprene scuba/crepe morbido"
          >
            {enhanceWithAI.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Migliora con AI
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => upsert.mutate({ fabric_id: fabricId })}
            disabled={!fabricId}
          >
            <Plus className="h-3.5 w-3.5" /> Nuovo colore
          </Button>
        </div>
      </div>

      {!grayscaleTextureUrl && (
        <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Carica prima una texture B/N seamless per vedere le anteprime colorate.
        </div>
      )}

      {isLoading && <p className="text-xs text-muted-foreground">Caricamento colori...</p>}

      {sorted.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground">
          Nessun colore. Aggiungine uno per attivare la modalità multi-colore.
        </p>
      )}

      <div className="space-y-2">
        {sorted.map(c => (
          <div
            key={c.id}
            className="flex flex-col gap-2 p-2.5 rounded-md border border-border bg-card"
          >
            <div className="flex items-center gap-3">
              <ColorSwatch url={grayscaleTextureUrl} hex={c.hex} size={56} />
              <div className="flex-1 grid grid-cols-[1fr_140px_auto_auto] gap-2 items-center">
                <Input
                  value={c.name}
                  onChange={e => upsert.mutate({ ...c, name: e.target.value })}
                  placeholder="Es. Velluto Rosso"
                  className="h-8 text-sm"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={c.hex}
                    onChange={e => upsert.mutate({ ...c, hex: e.target.value })}
                    className="h-8 w-10 rounded cursor-pointer border border-border bg-background"
                  />
                  <Input
                    value={c.hex}
                    onChange={e => {
                      const v = e.target.value;
                      if (/^#[0-9a-fA-F]{0,6}$/.test(v)) upsert.mutate({ ...c, hex: v });
                    }}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={v => upsert.mutate({ ...c, is_active: v })}
                  />
                  <span className="text-[11px] text-muted-foreground">attivo</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (
                      confirm(
                        `Eliminare il colore "${c.name}"${c.derived_fabric_id ? ' e il tessuto derivato' : ''}?`
                      )
                    )
                      remove.mutate(c);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between pl-[68px]">
              <div className="text-[10.5px] text-muted-foreground">
                {c.derived_fabric_id ? (
                  <span className="text-foreground">
                    ✓ Tessuto autonomo collegato (id …{c.derived_fabric_id.slice(-6)})
                  </span>
                ) : (
                  <span>Non ancora esportato come tessuto.</span>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 h-7"
                onClick={() => sync.mutate(c)}
                disabled={sync.isPending || !grayscaleTextureUrl || !c.name?.trim()}
              >
                <Save className="h-3 w-3" />
                {c.derived_fabric_id ? 'Aggiorna tessuto' : 'Crea tessuto'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
