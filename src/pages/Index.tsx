/**
 * Index — Hub di navigazione
 *
 * Landing minimale che indirizza l'utente verso le due aree principali:
 *  - Admin (gestione catalogo: modelli, tessuti, manici, maschere)
 *  - Anteprima configuratore (engine demo che usa i dati live del DB)
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Eye, Layers, Scissors } from 'lucide-react';

const primary = [
  {
    to: '/admin',
    title: 'Pannello Admin',
    description:
      'Gestione catalogo: modelli borsa, viste, maschere tessuto, mapping manici e colori.',
    icon: LayoutDashboard,
  },
  {
    to: '/engine-demo',
    title: 'Anteprima configuratore',
    description:
      'Visualizza il rendering live del configuratore usando i dati attualmente nel database.',
    icon: Eye,
  },
];

const tools = [
  {
    to: '/admin/handle-presets',
    title: 'Preset manici',
    description: 'Crea e modifica preset di strisce riusabili con anteprima curva.',
    icon: Layers,
  },
  {
    to: '/admin/models',
    title: 'Modelli & maschere',
    description: 'Gestione modelli borsa, viste e maschere tessuto.',
    icon: Scissors,
  },
];

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold text-foreground">Bag Configurator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hub di navigazione — scegli dove andare.
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Aree principali
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {primary.map(c => (
              <Link
                key={c.to}
                to={c.to}
                className="group block bg-card border border-border rounded-xl p-6 hover:border-primary hover:shadow-md transition-all"
              >
                <c.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {c.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {c.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Scorciatoie strumenti
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tools.map(c => (
              <Link
                key={c.to}
                to={c.to}
                className="group block bg-card border border-border rounded-xl p-4 hover:border-primary transition-all"
              >
                <div className="flex items-start gap-3">
                  <c.icon className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {c.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {c.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
