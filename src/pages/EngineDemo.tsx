/**
 * Engine Demo Page
 *
 * Demonstrates the 2D rendering engine using LIVE database data only.
 * Mock models (City / Bauletto / Travel) have been removed — they will be
 * rebuilt properly via /admin once the asset pipeline is finalized.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { BagCanvas } from '@/components/BagCanvas';
import { useRenderingData } from '@/hooks/useRenderingData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

/** Fetch models from DB */
function useDbModels() {
  return useQuery({
    queryKey: ['bag-models'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bag_models')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Fetch fabrics from DB */
function useDbFabrics() {
  return useQuery({
    queryKey: ['fabrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fabrics')
        .select('id, name, slug, texture_url')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Fetch handles with their colors from DB */
function useDbHandles() {
  return useQuery({
    queryKey: ['handles-with-cords'],
    queryFn: async () => {
      const { data: handles, error: hErr } = await supabase
        .from('handles')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('sort_order');
      if (hErr) throw hErr;

      // Mappa cord ↔ handle dal nuovo catalogo
      const { data: compat, error: cmpErr } = await supabase
        .from('cord_handle_compatibility')
        .select('handle_id, cord_id');
      if (cmpErr) throw cmpErr;

      const cordIds = Array.from(new Set((compat ?? []).map((r) => r.cord_id)));
      const { data: cords, error: cErr } = cordIds.length
        ? await supabase
            .from('cord_collection')
            .select('id, name, style_type')
            .in('id', cordIds)
            .eq('is_active', true)
            .order('sort_order')
        : { data: [], error: null };
      if (cErr) throw cErr;

      return (handles ?? []).map((h) => ({
        ...h,
        colors: (compat ?? [])
          .filter((c) => c.handle_id === h.id)
          .map((c) => cords?.find((co) => co.id === c.cord_id))
          .filter((c): c is { id: string; name: string; style_type: string } => !!c)
          .map((c) => ({
            id: c.id,
            handle_id: h.id,
            color_name: c.name,
            color_hex: '#000000',
          })),
      }));
    },
  });
}

const EngineDemo: React.FC = () => {
  const dbModels = useDbModels();
  const dbFabrics = useDbFabrics();
  const dbHandles = useDbHandles();

  const [dbModelIndex, setDbModelIndex] = useState(0);
  const [dbFabricIndex, setDbFabricIndex] = useState(0);
  const [dbHandleIndex, setDbHandleIndex] = useState(0);
  const [dbColorIndex, setDbColorIndex] = useState(0);
  // Slider scala grana texture: 0.02..3 (default 1 = come da DB)
  const [fabricScaleMultiplier, setFabricScaleMultiplier] = useState(1);
  // Boost ombre/luci: 1..4 passate (default 1)
  const [shadowsBoost, setShadowsBoost] = useState(2);
  const [highlightsBoost, setHighlightsBoost] = useState(1);

  const selectedDbModel = dbModels.data?.[dbModelIndex] ?? null;
  const selectedDbFabric = dbFabrics.data?.[dbFabricIndex] ?? null;
  const selectedDbHandle = dbHandles.data?.[dbHandleIndex] ?? null;
  const selectedDbColor = selectedDbHandle?.colors?.[dbColorIndex] ?? selectedDbHandle?.colors?.[0] ?? null;

  const [debugCenterline, setDebugCenterline] = useState(false);

  const dbScene = useRenderingData({
    bagModelId: selectedDbModel?.id ?? null,
    fabricId: selectedDbFabric?.id ?? null,
    handleId: selectedDbHandle?.id ?? null,
    handleColorId: selectedDbColor?.id ?? null,
    embroideryId: null,
    fabricScaleMultiplier,
    shadowsBoost,
    highlightsBoost,
  });

  const scene = dbScene.scene;
  const noModels = !dbModels.isLoading && (dbModels.data?.length ?? 0) === 0;

  // Stats path manico (per il pannello debug)
  const handlePathStats = React.useMemo(() => {
    const geom = scene?.view.handleGeometry;
    if (!geom) return null;
    type Pt = { x: number; y: number; width: number };
    type Doc = { name?: string; canvasWidth: number; canvasHeight: number; paths: { points: Pt[] }[] };
    const docs: Array<{ label: string; doc: Doc }> = [];
    const main = geom.pathDocument as Doc | null;
    if (main?.paths?.length) docs.push({ label: 'main', doc: main });
    for (const sp of geom.sideParts ?? []) {
      const d = sp.pathDocument as Doc | null;
      if (d?.paths?.length) docs.push({ label: sp.partId, doc: d });
    }
    return docs.map(({ label, doc }) => {
      const allPoints = doc.paths.flatMap((p) => p.points ?? []);
      const avgW = allPoints.length
        ? allPoints.reduce((a, p) => a + (p.width || 0), 0) / allPoints.length
        : 0;
      return {
        label,
        name: doc.name ?? '—',
        canvas: `${doc.canvasWidth}×${doc.canvasHeight}`,
        pathsCount: doc.paths.length,
        pointsCount: allPoints.length,
        avgWidth: avgW,
      };
    });
  }, [scene]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Rendering Engine — Demo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Motore di composizione 2D — dati live dal database
          </p>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border bg-card text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border bg-card text-foreground hover:bg-muted transition-colors"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        </nav>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 p-6 max-w-7xl mx-auto">
        {/* Canvas */}
        <div className="flex-1 flex items-start justify-center">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm w-full max-w-2xl">
            {scene ? (
              <>
                <BagCanvas
                  scene={scene}
                  maxDisplayWidth={650}
                  maxDisplayHeight={650}
                  debugCenterline={debugCenterline}
                />
                <div className="mt-3 text-xs text-muted-foreground text-center">
                  Canvas: {scene.view.canvasWidth}×{scene.view.canvasHeight}px |{' '}
                  {scene.view.maskZones.length} zone maschera |{' '}
                  {scene.view.layerOrder.length} layer
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-96 text-muted-foreground text-sm text-center px-6">
                {dbScene.isLoading
                  ? '⏳ Caricamento dal database...'
                  : noModels
                    ? 'Nessun modello presente. Vai su /admin/models per crearne uno.'
                    : 'Nessuna scena renderizzabile. Verifica che il modello selezionato abbia una vista con base image, maschere e regole layer configurate.'}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="w-full lg:w-80 space-y-6">
          {/* DB Model selector */}
          <div>
            <h2 className="text-sm font-medium text-foreground mb-3">Modello</h2>
            {dbModels.isLoading ? (
              <p className="text-xs text-muted-foreground">Caricamento...</p>
            ) : noModels ? (
              <p className="text-xs text-muted-foreground">
                Nessun modello in DB. Creane uno su <code>/admin/models</code>.
              </p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {(dbModels.data ?? []).map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => setDbModelIndex(i)}
                    className={`px-4 py-2 rounded-lg text-sm border transition-all capitalize ${
                      i === dbModelIndex
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:border-muted-foreground'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* DB Fabric selector */}
          <div>
            <h2 className="text-sm font-medium text-foreground mb-3">Tessuto</h2>
            {(dbFabrics.data?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Nessun tessuto attivo in DB.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {(dbFabrics.data ?? []).map((f, i) => (
                  <button
                    key={f.id}
                    onClick={() => setDbFabricIndex(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      i === dbFabricIndex
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:border-muted-foreground'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Slider grana texture tessuto */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-foreground">Grana texture</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                ×{fabricScaleMultiplier.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.02}
              max={3}
              step={0.01}
              value={fabricScaleMultiplier}
              onChange={(e) => setFabricScaleMultiplier(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>fine</span>
              <button
                type="button"
                onClick={() => setFabricScaleMultiplier(1)}
                className="hover:text-foreground transition-colors"
              >
                reset
              </button>
              <span>grossa</span>
            </div>
          </div>

          {/* Boost ombre / luci per effetto 3D */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-foreground">Profondità ombre</h2>
              <span className="text-xs text-muted-foreground tabular-nums">×{shadowsBoost}</span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={shadowsBoost}
              onChange={(e) => setShadowsBoost(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>piatto</span>
              <span>3D marcato</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-foreground">Intensità luci</h2>
              <span className="text-xs text-muted-foreground tabular-nums">×{highlightsBoost}</span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={highlightsBoost}
              onChange={(e) => setHighlightsBoost(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* DB Handle selector */}
          <div>
            <h2 className="text-sm font-medium text-foreground mb-3">Manici</h2>
            {(dbHandles.data?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Nessun manico attivo in DB.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {(dbHandles.data ?? []).map((h, i) => (
                  <button
                    key={h.id}
                    onClick={() => setDbHandleIndex(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      i === dbHandleIndex
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:border-muted-foreground'
                    }`}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Handle color / preset selector */}
          {selectedDbHandle && selectedDbHandle.colors.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-foreground mb-3">Preset manico</h2>
              <div className="flex gap-2 flex-wrap">
                {selectedDbHandle.colors.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => setDbColorIndex(i)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      i === dbColorIndex
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:border-muted-foreground'
                    }`}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-full border border-border"
                      style={{ background: c.color_hex }}
                    />
                    {c.color_name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {scene && (
            <>
              <div className="border-t border-border pt-4">
                <h2 className="text-sm font-medium text-foreground mb-3">Pipeline Layer</h2>
                <div className="space-y-1">
                  {scene.view.layerOrder
                    .filter(l => l.isActive)
                    .sort((a, b) => a.zIndex - b.zIndex)
                    .map(l => (
                      <div key={l.layerType} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{l.layerType}</span>
                        <span className="text-muted-foreground/60">
                          z:{l.zIndex} | {l.blendMode} | α:{l.opacity}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h2 className="text-sm font-medium text-foreground mb-3">Zone Maschera</h2>
                <div className="space-y-1">
                  {scene.view.maskZones.map(z => (
                    <div key={z.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        <span
                          className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                            z.zoneCategory === 'fabric' ? 'bg-blue-400' : 'bg-amber-500'
                          }`}
                        />
                        {z.label}
                      </span>
                      <span className="text-muted-foreground/60">{z.zoneType}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Debug centerline manico */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-foreground">Debug manico</h2>
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={debugCenterline}
                      onChange={(e) => setDebugCenterline(e.target.checked)}
                      className="rounded border-border"
                    />
                    Mostra centerline
                  </label>
                </div>
                {debugCenterline && handlePathStats && handlePathStats.length > 0 ? (
                  <div className="space-y-3">
                    {handlePathStats.map((s) => (
                      <div key={s.label} className="rounded-md border border-border bg-muted/40 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground capitalize">{s.label}</span>
                          <span className="text-[10px] text-muted-foreground">{s.name}</span>
                        </div>
                        <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          <dt>Canvas</dt><dd className="text-right">{s.canvas}</dd>
                          <dt>Paths</dt><dd className="text-right">{s.pathsCount}</dd>
                          <dt>Punti</dt><dd className="text-right">{s.pointsCount}</dd>
                          <dt>Larg. media</dt><dd className="text-right">{s.avgWidth.toFixed(1)}px</dd>
                        </dl>
                      </div>
                    ))}
                  </div>
                ) : debugCenterline ? (
                  <p className="text-xs text-muted-foreground">
                    Nessun path manico configurato per questa vista.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Toggle attivo: mostra centerline, punti e larghezza locale.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EngineDemo;
