/**
 * AdminHandleEditorIndex
 *
 * Pagina indice raggiungibile dalla sidebar ("Editor manico").
 * Elenca tutte le viste borsa attive e linka al rispettivo
 * editor centerline `/admin/handle-editor/:viewId`.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, Hand } from 'lucide-react';

type ViewRow = {
  id: string;
  view_type: string;
  custom_label: string | null;
  bag_models: { name: string; slug: string } | null;
};

const AdminHandleEditorIndex: React.FC = () => {
  const [rows, setRows] = useState<ViewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('bag_views')
        .select('id, view_type, custom_label, bag_models(name, slug)')
        .eq('is_active', true)
        .order('sort_order');
      if (!error && data) setRows(data as unknown as ViewRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Hand className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Editor manico — scegli una vista</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Seleziona la vista borsa da modificare: definirai la centerline del manico,
        le fettuccine laterali e gli asset (mask, shadow, highlight, dettagli).
      </p>

      {loading && <p className="text-sm text-muted-foreground">Caricamento…</p>}

      {!loading && rows.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nessuna vista attiva. Carica prima un asset pack da{' '}
            <Link to="/admin/upload" className="text-primary underline">
              Carica File
            </Link>
            .
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {rows.map(r => (
          <Card key={r.id} className="hover:border-primary transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>
                  {r.bag_models?.name ?? '—'}{' '}
                  <span className="text-muted-foreground font-normal">
                    · {r.custom_label || r.view_type}
                  </span>
                </span>
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/admin/handle-editor/${r.id}`}>
                    Apri editor <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminHandleEditorIndex;
