/**
 * AdminHandleStyles — Pagina unificata "Stili manico"
 *
 * Riunisce in 3 tab tutto ciò che serve per definire COME un manico viene colorato:
 *  - Texture reali  → upload PNG fotografici (ex /admin/handle-textures)
 *  - Pattern righe  → editor di righe matematiche (ex /admin/handle-presets)
 *  - Corde globali  → catalogo riutilizzabile tra modelli, con mappa di compatibilità
 *
 * Il tab attivo è sincronizzato con la query string ?tab=textures|presets|cords
 * per consentire i redirect dalle vecchie route.
 */

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminHandleTextures from './AdminHandleTextures';
import AdminHandlePresets from './AdminHandlePresets';
import AdminHandles from './AdminHandles';
import CordCollectionManager from '@/components/admin/cords/CordCollectionManager';

const VALID_TABS = ['types', 'cords', 'textures', 'presets'] as const;
type TabId = (typeof VALID_TABS)[number];

const AdminHandleStyles: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const activeTab: TabId = (VALID_TABS as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as TabId)
    : 'cords';

  const setTab = (t: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    setParams(next, { replace: true });
  };

  return (
    <div className="p-4 space-y-3 max-w-[1400px]">
      <div className="text-xs text-muted-foreground border border-border rounded-md p-3 bg-muted/20">
        Tutti gli stili applicabili ai manici, in un unico posto. I <strong>Tipi di manico</strong>{' '}
        sono le entità di catalogo (es. "Manico centrale"). Le <strong>Corde</strong> sono il
        catalogo globale che l'utente vedrà nel configuratore: ogni corda è una texture o un
        pattern matematico, e può essere abilitata su più tipi di manico.
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="types">Tipi di manico</TabsTrigger>
          <TabsTrigger value="cords">Corde (catalogo globale)</TabsTrigger>
          <TabsTrigger value="textures">Texture reali (upload PNG)</TabsTrigger>
          <TabsTrigger value="presets">Pattern righe (matematici)</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="mt-3">
          <AdminHandles />
        </TabsContent>

        <TabsContent value="cords" className="mt-3">
          <CordCollectionManager />
        </TabsContent>

        <TabsContent value="textures" className="mt-3">
          <AdminHandleTextures />
        </TabsContent>

        <TabsContent value="presets" className="mt-3">
          <AdminHandlePresets />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminHandleStyles;
