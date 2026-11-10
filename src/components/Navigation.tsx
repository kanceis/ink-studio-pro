import React from 'react';
import { useStudio } from '../context/StudioContext';
import {
  CalendarDays,
  Users,
  Palette,
  Package,
  MessageSquareShare,
  TrendingUp,
  Building2,
  Globe,
} from 'lucide-react';

export const Navigation: React.FC = () => {
  const { activeTab, setActiveTab, expiringItems, lowStockItems, upcoming24hAppointments, newBookingRequestCount } =
    useStudio();

  const stockAlertCount = expiringItems.length + lowStockItems.length;
  const pendingReminderCount = upcoming24hAppointments.filter((a) => !a.reminder24hSent).length;

  const navItems = [
    {
      id: 'calendar' as const,
      label: 'Calendário & Agenda',
      shortLabel: 'Agenda',
      icon: CalendarDays,
      badge: 0,
    },
    {
      id: 'clients' as const,
      label: 'Clientes & Ficha Clínica',
      shortLabel: 'Clientes',
      icon: Users,
      badge: 0,
    },
    {
      id: 'artists' as const,
      label: 'Artistas & Estatísticas',
      shortLabel: 'Artistas',
      icon: Palette,
      badge: 0,
    },
    {
      id: 'stock' as const,
      label: 'Stock & Validades',
      shortLabel: 'Stock',
      icon: Package,
      badge: stockAlertCount,
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'messages' as const,
      label: 'Mensagens & Lembretes',
      shortLabel: 'Mensagens',
      icon: MessageSquareShare,
      badge: pendingReminderCount,
      badgeColor: 'bg-emerald-500',
    },
    {
      id: 'site' as const,
      label: 'Site & Portfólio',
      shortLabel: 'Site',
      icon: Globe,
      badge: newBookingRequestCount,
      badgeColor: 'bg-rose-500',
    },
    {
      id: 'analytics' as const,
      label: 'Relatório & Faturação',
      shortLabel: 'Relatório',
      icon: TrendingUp,
      badge: 0,
    },
    {
      id: 'profile' as const,
      label: 'Perfil do Estúdio & Automações',
      shortLabel: 'Estúdio',
      icon: Building2,
      badge: 0,
    },
  ];

  return (
    <>
      {/* Desktop / iPad Top Tabs navigation */}
      <div className="hidden md:block w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-2 py-2 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs lg:text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-inherit' : 'text-zinc-400 dark:text-zinc-500'}`} />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span
                      className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full text-white ${
                        item.badgeColor || 'bg-zinc-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (iPad portrait & Phones) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 pb-safe">
        <div className="grid grid-cols-8 h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'text-zinc-900 dark:text-zinc-50 font-bold'
                    : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-4 h-4 ${isActive ? 'scale-110' : ''}`} />
                  {item.badge > 0 && (
                    <span
                      className={`absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-1 text-[8px] font-bold rounded-full text-white flex items-center justify-center ${
                        item.badgeColor || 'bg-zinc-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="truncate max-w-[50px]">{item.shortLabel}</span>
                {isActive && (
                  <span className="absolute bottom-0 w-8 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
