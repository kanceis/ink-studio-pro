import React from 'react';
import { useStudio } from '../context/StudioContext';
import {
  AlertTriangle,
  Clock,
  Package,
  X,
  MessageCircle,
  Mail,
  ChevronRight,
} from 'lucide-react';
import { getWhatsAppUrl, generate24hReminderMessage } from '../services/messaging';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onGoToStock: () => void;
  onGoToMessages: () => void;
}

export const QuickAlertsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onGoToStock,
  onGoToMessages,
}) => {
  const { expiringItems, lowStockItems, upcoming24hAppointments, settings } = useStudio();

  if (!isOpen) return null;

  const pendingReminders = upcoming24hAppointments.filter((a) => !a.reminder24hSent);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Central de Alertas Críticos do Estúdio
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: 24h Reminders Pending */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Lembretes de 24 Horas Pendentes ({pendingReminders.length})
            </span>
            <button
              onClick={() => {
                onClose();
                onGoToMessages();
              }}
              className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Ver mensagens <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {pendingReminders.length === 0 ? (
            <p className="text-xs text-zinc-400 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950">
              Todos os lembretes de 24h foram enviados!
            </p>
          ) : (
            <div className="space-y-1.5">
              {pendingReminders.map((appt) => {
                const msg = generate24hReminderMessage(appt, settings);
                const waUrl = getWhatsAppUrl(appt.clientPhone, msg.text);

                return (
                  <div
                    key={appt.id}
                    className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        {appt.clientName}
                      </span>
                      <p className="text-[11px] text-zinc-500">
                        Amanhã às {appt.startTime} • {appt.artistName}
                      </p>
                    </div>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs"
                    >
                      <MessageCircle className="w-3 h-3" />
                      Enviar
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Expiring Materials */}
        <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-rose-500" />
              Materiais a Expirar ({expiringItems.length})
            </span>
            <button
              onClick={() => {
                onClose();
                onGoToStock();
              }}
              className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Ir para stock <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {expiringItems.length === 0 ? (
            <p className="text-xs text-zinc-400 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950">
              Nenhum material a expirar nos próximos 30 dias.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {expiringItems.map(({ item, daysUntilExpiration, isExpired }) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate block">
                      {item.name}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Lote: {item.lotNumber} • Qtd: {item.quantity} {item.unit}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      isExpired
                        ? 'bg-rose-500 text-white'
                        : daysUntilExpiration <= 15
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {isExpired ? 'Expirado' : `Expira em ${daysUntilExpiration}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Low Stock */}
        <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-500" />
              Artigos com Stock Baixo ({lowStockItems.length})
            </span>
          </div>

          {lowStockItems.length === 0 ? (
            <p className="text-xs text-zinc-400 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950">
              Todos os artigos têm quantidades confortáveis de stock.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                    {item.name}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold flex-shrink-0 ml-2">
                    {item.quantity} {item.unit} (Mín: {item.minStockAlert})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
