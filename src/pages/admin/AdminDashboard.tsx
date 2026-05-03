/**
 * AdminDashboard
 *
 * Landing admin: card per ogni area del catalogo, raggruppate per tipo.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Layers, Hand, Scissors, Eye } from 'lucide-react';

type Card = {
  to: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const sections: { label: string; cards: Card[] }[] = [
  {
    label: 'Catalogo',
    cards: [
      {
        to: '/admin/models',
        title: 'Modelli borsa',
        description: 'Modelli (City, Travel, ...) con viste, base image e overlay.',
        icon: Briefcase,
      },
      {
        to: '/admin/handle-styles?tab=types',
        title: 'Manici',
        description: 'Tipi di manico, corde, texture e pattern in un\'unica pagina.',
        icon: Hand,
      },
    ],
  },
  {
    label: 'Asset visual',
    cards: [
      {
        to: '/admin/masks',
        title: 'Maschere tessuto',
        description: 'PNG e parametri texture per le zone tessuto di ogni vista.',
        icon: Scissors,
      },
      {
        to: '/admin/mappings',
        title: 'Mapping righe manici',
        description: 'Maschere riusabili per manici a N\u00b0 righe, salvabili dal Handle Mapper.',
        icon: Layers,
      },
    ],
  },
  {
    label: 'Strumenti',
    cards: [
      {
        to: '/handle-mapper',
        title: 'Handle Mapper',
        description: 'Editor visuale per campionare e ricolorare le righe dei manici.',
        icon: Layers,
      },
      {
        to: '/engine-demo',
        title: 'Anteprima configuratore',
        description: 'Rendering live del configuratore con i dati attualmente in DB.',
        icon: Eye,
      },
    ],
  },
];

const AdminDashboard: React.FC = () => {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <p className="text-sm text-muted-foreground mb-8">
        Gestione catalogo del configuratore. Le modifiche sono live e usate dal configuratore utente.
      </p>

      <div className="space-y-8">
        {sections.map(section => (
          <section key={section.label}>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              {section.label}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.cards.map(c => (
                <Link
                  key={c.to}
                  to={c.to}
                  className="group block bg-card border border-border rounded-xl p-6 hover:border-primary hover:shadow-md transition-all"
                >
                  <c.icon className="h-7 w-7 text-primary mb-3" />
                  <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {c.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
