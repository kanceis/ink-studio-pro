import React, { useState, useMemo } from 'react';
import { useStudio } from '../context/StudioContext';
import {
  Bell,
  X,
  Smartphone,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  MessageSquare,
  AlertTriangle,
  Trash2,
  Check,
  Send,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  getSystemNotificationPermission,
  isSystemNotificationSupported,
} from '../services/systemNotifications';

export const NotificationCenterModal: React.FC = () => {
  const {
    isNotificationCenterOpen,
    setIsNotificationCenterOpen,
    notificationLogs,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
    testSystemNotification,
    requestSystemNotificationAccess,
    settings,
    updateSettings,
  } = useStudio();

  const [activeFilter, setActiveFilter] = useState<'all' | 'system' | 'confirmation' | 'reminder_24h' | 'messaging'>('all');
  const [isTestingSystem, setIsTestingSystem] = useState(false);

  const permission = typeof window !== 'undefined' ? getSystemNotificationPermission() : 'unsupported';
  const isSupported = typeof window !== 'undefined' ? isSystemNotificationSupported() : false;

  const filteredLogs = useMemo(() => {
    return notificationLogs.filter((log) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'system') return log.channel === 'system';
      if (activeFilter === 'confirmation') return log.type === 'confirmation';
      if (activeFilter === 'reminder_24h') return log.type === 'reminder_24h';
      if (activeFilter === 'messaging') return log.channel === 'whatsapp' || log.channel === 'email' || log.channel === 'sms';
      return true;
    });
  }, [notificationLogs, activeFilter]);

  if (!isNotificationCenterOpen) return null;

  const handleTestSystem = async () => {
    setIsTestingSystem(true);
    try {
      await testSystemNotification();
    } finally {
      setIsTestingSystem(false);
    }
  };

  const handleToggleSystemSettings = async () => {
    if (!settings.systemNotificationsEnabled) {
      const res = await requestSystemNotificationAccess();
      if (res === 'granted' || res === 'default') {
        updateSettings({ systemNotificationsEnabled: true });
      }
    } else {
      updateSettings({ systemNotificationsEnabled: false });
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'system':
        return <Smartphone className="w-3.5 h-3.5 text-indigo-400" />;
      case 'whatsapp':
        return <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-rose-400" />;
      case 'sms':
        return <MessageSquare className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'system':
        return 'iPad / Telemóvel (Sistema)';
      case 'whatsapp':
        return 'WhatsApp Automático';
      case 'email':
        return 'Gmail';
      case 'sms':
        return 'SMS';
      default:
        return 'Notificação';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Central de Notificações
                </h2>
                {unreadNotificationCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-500 text-white">
                    {unreadNotificationCount} nova{unreadNotificationCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Histórico de confirmações, lembretes 24h e alertas do sistema
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {notificationLogs.length > 0 && (
              <>
                {unreadNotificationCount > 0 && (
                  <button
                    onClick={markAllNotificationsAsRead}
                    className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    title="Marcar todas como lidas"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Lidas</span>
                  </button>
                )}
                <button
                  onClick={clearAllNotifications}
                  className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                  title="Limpar histórico de notificações"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => setIsNotificationCenterOpen(false)}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* System Notifications Native Status Banner (iPad & Phone) */}
        <div className="p-4 bg-gradient-to-r from-indigo-500/10 via-blue-500/10 to-transparent border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Notificações do Sistema no iPad / Telemóvel
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      settings.systemNotificationsEnabled && permission === 'granted'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : permission === 'denied'
                        ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {settings.systemNotificationsEnabled && permission === 'granted'
                      ? '✓ Ativo no Dispositivo'
                      : permission === 'denied'
                      ? 'Bloqueado no Navegador'
                      : 'Requer Autorização'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Mostra alertas no ecrã de bloqueio e central do iPad/iPhone ao confirmar marcações e 24h antes da sessão.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggleSystemSettings}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  settings.systemNotificationsEnabled
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {settings.systemNotificationsEnabled ? 'Desativar' : 'Ativar no Sistema'}
              </button>

              <button
                type="button"
                onClick={handleTestSystem}
                disabled={isTestingSystem}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer disabled:opacity-50"
                title="Disparar notificação de teste para verificar se o iPad ou telemóvel recebe"
              >
                <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>{isTestingSystem ? 'A testar...' : 'Testar no Ecrã'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'system', label: 'iPad/Telemóvel' },
            { id: 'confirmation', label: 'Marcações' },
            { id: 'reminder_24h', label: 'Lembretes 24h' },
            { id: 'messaging', label: 'WhatsApp & Email' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as typeof activeFilter)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
              <Bell className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
              <p className="text-sm font-medium">Nenhuma notificação nesta categoria.</p>
              <p className="text-xs text-zinc-400 mt-1">
                As confirmações e os lembretes automáticos de 24h surgirão aqui e no sistema do dispositivo.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isUnread = log.read === false;
              const formattedDate = new Date(log.timestamp).toLocaleString('pt-PT', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={log.id}
                  onClick={() => isUnread && markNotificationAsRead(log.id)}
                  className={`pt-2.5 first:pt-0 flex items-start gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
                    isUnread
                      ? 'bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="relative mt-0.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      {getChannelIcon(log.channel)}
                    </div>
                    {isUnread && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full ring-2 ring-white dark:ring-zinc-900" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {log.clientName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">
                          {getChannelLabel(log.channel)}
                        </span>
                        {log.type === 'reminder_24h' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                            Lembrete 24h
                          </span>
                        )}
                        {log.type === 'confirmation' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                            Confirmação
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                        {formattedDate}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                      {log.message}
                    </p>

                    <div className="flex items-center justify-between mt-1.5 text-[11px] text-zinc-400">
                      <span>Destino: {log.recipientContact}</span>
                      {isUnread && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markNotificationAsRead(log.id);
                          }}
                          className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Marcar como lida
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-500">
          <span>
            {notificationLogs.length} notificaç{notificationLogs.length === 1 ? 'ão registada' : 'ões registadas'}
          </span>
          <button
            onClick={() => setIsNotificationCenterOpen(false)}
            className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
