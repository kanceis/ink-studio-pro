import React from 'react';
import { useStudio } from '../context/StudioContext';
import { OfficialGoogleButton } from './OfficialGoogleButton';
import { logout } from '../services/firebaseAuth';
import {
  Sun,
  Moon,
  Plus,
  Calendar,
  AlertTriangle,
  Package,
  LogOut,
  BellRing,
  Bell,
  Building2,
  Share2,
} from 'lucide-react';

interface Props {
  onOpenNewAppointment: () => void;
  onOpenQuickAlerts: () => void;
  onOpenShare: () => void;
}

export const Header: React.FC<Props> = ({
  onOpenNewAppointment,
  onOpenQuickAlerts,
  onOpenShare,
}) => {
  const {
    theme,
    toggleTheme,
    googleUser,
    connectGoogle,
    disconnectGoogle,
    isConnectingGoogle,
    expiringItems,
    lowStockItems,
    upcoming24hAppointments,
    settings,
    setActiveTab,
    unreadNotificationCount,
    setIsNotificationCenterOpen,
  } = useStudio();

  const totalAlerts =
    expiringItems.length +
    lowStockItems.length +
    upcoming24hAppointments.filter((a) => !a.reminder24hSent).length;

  return (
    <header className="sticky top-0 z-30 w-full bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <button
          onClick={() => setActiveTab('profile')}
          className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
          title="Ver Perfil do Estúdio & Automações"
        >
          <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-950 font-black text-sm tracking-tighter shadow-sm group-hover:scale-105 transition-transform">
            INK
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-none group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {settings.name.split(' ')[0]} <span className="font-light text-zinc-500">Studio</span>
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[140px] sm:max-w-none">
              {settings.phone} • {settings.email}
            </p>
          </div>
        </button>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Studio Profile & Settings CTA */}
          <button
            onClick={() => setActiveTab('profile')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
            title="Perfil do Estúdio & Automações"
          >
            <Building2 className="w-3.5 h-3.5 text-zinc-500" />
            <span>Perfil Estúdio</span>
          </button>
          {/* Central de Notificações */}
          <button
            onClick={() => setIsNotificationCenterOpen(true)}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
            title="Central de Notificações (iPad, Telemóvel & Sistema)"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          {/* Partilhar Projeto */}
          <button
            onClick={onOpenShare}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-900/60 transition-colors cursor-pointer"
            title="Partilhar este projeto com um amigo ou cliente"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Partilhar</span>
          </button>

          {/* Alerts trigger */}
          {totalAlerts > 0 && (
            <button
              onClick={onOpenQuickAlerts}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
              title="Avisos de stock e lembretes"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Alertas</span>
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white dark:text-zinc-950 text-[10px] font-bold flex items-center justify-center">
                {totalAlerts}
              </span>
            </button>
          )}

          {/* Google Workspace status */}
          <div className="flex items-center">
            {googleUser ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden sm:inline font-medium">Google Sincronizado</span>
                <span className="sm:hidden font-medium">Google</span>
                <button
                  onClick={disconnectGoogle}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 ml-1 p-0.5 rounded cursor-pointer"
                  title="Desconectar Google"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <OfficialGoogleButton
                onClick={connectGoogle}
                isLoading={isConnectingGoogle}
              />
            )}
          </div>

          {/* Sign out of the studio */}
          <button
            onClick={() => logout()}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
            aria-label="Terminar sessão"
            title="Terminar sessão"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
            aria-label="Alternar tema claro/escuro"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-700" />}
          </button>

          {/* New Appointment CTA */}
          <button
            onClick={onOpenNewAppointment}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Nova Marcação</span>
            <span className="xs:hidden">Marcar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
