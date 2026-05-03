/**
 * AdminLayout
 *
 * Wraps admin pages with a collapsible sidebar organized in 3 groups:
 *  - Catalogo: entit\u00e0 di business (modelli, manici)
 *  - Asset: configurazione visual (maschere tessuto, mapping righe)
 *  - Strumenti: editor tecnici e anteprima
 */

import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Eye,
  Home,
  Wand2,
  Shirt,
  Upload,
  Cable,
  Spline,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; end?: boolean };

const groups: { label: string; items: Item[] }[] = [
  {
    label: 'Generale',
    items: [
      { title: 'Dashboard', url: '/admin', icon: LayoutDashboard, end: true },
      { title: 'Carica File', url: '/admin/upload', icon: Upload },
    ],
  },
  {
    label: 'Catalogo',
    items: [
      { title: 'Modelli borsa', url: '/admin/models', icon: Briefcase },
      { title: 'Tessuti', url: '/admin/fabrics', icon: Shirt },
      { title: 'Editor manico', url: '/admin/handle-editor', icon: Spline },
      { title: 'Stili manici', url: '/admin/handle-styles', icon: Cable },
    ],
  },
  {
    label: 'Strumenti',
    items: [
      { title: 'Texture Lab', url: '/admin/texture-lab', icon: Wand2 },
      { title: 'Anteprima configuratore', url: '/engine-demo', icon: Eye },
      { title: 'Home / Hub', url: '/', icon: Home, end: true },
    ],
  },
];

const AdminSidebar: React.FC = () => {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {groups.map(group => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(item => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.end}
                        className={({ isActive }) =>
                          `flex items-center gap-2 ${
                            isActive
                              ? 'bg-muted text-primary font-medium'
                              : 'hover:bg-muted/50'
                          }`
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
};

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const titleMap: Record<string, string> = {
    '/admin': 'Dashboard admin',
    '/admin/upload': 'Carica File',
    '/admin/models': 'Modelli borsa',
    '/admin/fabrics': 'Tessuti',
    '/admin/handle-styles': 'Stili manici (tipi, corde, texture, pattern)',
    '/admin/handle-editor': 'Editor manico — scegli vista',
    '/admin/texture-lab': 'Texture Lab — Seamless Generator',
  };
  const pathBase = '/admin/handle-editor/';
  const title = location.pathname.startsWith(pathBase)
    ? 'Editor manico (centerline + preview)'
    : titleMap[location.pathname] ?? 'Admin';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center gap-3 border-b border-border px-3">
            <SidebarTrigger />
            <h1 className="text-sm font-medium text-foreground">{title}</h1>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
