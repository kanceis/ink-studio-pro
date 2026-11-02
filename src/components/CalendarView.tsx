import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { Appointment } from '../types';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  Euro,
  CheckCircle,
  Clock3,
  CalendarCheck2,
  CalendarSync,
  MessageCircle,
  Mail,
  Send,
  Trash2,
  Filter,
  AlertCircle,
  ExternalLink,
  Zap,
  Bell,
} from 'lucide-react';
import {
  generateConfirmationMessage,
  generate24hReminderMessage,
  getWhatsAppUrl,
  isAppointmentIn24hWindow,
} from '../services/messaging';
import { sendGmailMessage } from '../services/gmail';

interface Props {
  onSelectAppointment: (appointment: Appointment) => void;
  onNewAppointment: () => void;
  onOpenMessageModal: (appointment: Appointment, defaultType: 'confirmation' | 'reminder_24h') => void;
}

export const CalendarView: React.FC<Props> = ({
  onSelectAppointment,
  onNewAppointment,
  onOpenMessageModal,
}) => {
  const {
    appointments,
    artists,
    deleteAppointment,
    syncAppointmentToGoogle,
    googleToken,
    googleUser,
    connectGoogle,
    settings,
    upcoming24hAppointments,
    updateAppointment,
    logNotification,
    showToast,
    triggerAutomatic24hBatch,
    setIsNotificationCenterOpen,
  } = useStudio();

  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'agenda' | 'month'>('agenda');
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Filter appointments
  const filteredAppointments = appointments
    .filter((a) => {
      if (selectedArtistFilter !== 'all' && a.artistId !== selectedArtistFilter) return false;
      if (selectedStatusFilter !== 'all' && a.status !== selectedStatusFilter) return false;
      return true;
    })
    .sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime());

  // Group appointments by date
  const groupedByDate: { [dateStr: string]: Appointment[] } = {};
  filteredAppointments.forEach((a) => {
    if (!groupedByDate[a.date]) {
      groupedByDate[a.date] = [];
    }
    groupedByDate[a.date].push(a);
  });

  const handleSendDirectGmail = async (appointment: Appointment, type: 'confirmation' | 'reminder_24h', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!googleToken) {
      showToast('Para enviar e-mail direto pelo Gmail, liga a tua conta Google no topo.', 'info');
      return;
    }

    if (!appointment.clientEmail) {
      showToast('O cliente não tem endereço de email registado.', 'info');
      return;
    }

    const isReminder = type === 'reminder_24h';
    const actionLabel = isReminder ? 'Lembrete de 24h' : 'Confirmação de Marcação';

    try {
      setSendingEmailId(appointment.id);
      const msg = isReminder
        ? generate24hReminderMessage(appointment, settings)
        : generateConfirmationMessage(appointment, settings);

      await sendGmailMessage(
        {
          to: appointment.clientEmail,
          toName: appointment.clientName,
          subject: msg.subject,
          htmlContent: msg.html,
          fromName: settings.name,
        },
        googleToken
      );

      if (isReminder) {
        await updateAppointment(appointment.id, {
          reminder24hSent: true,
          reminder24hSentAt: new Date().toISOString(),
        });
      } else {
        await updateAppointment(appointment.id, {
          confirmationSent: true,
          confirmationSentAt: new Date().toISOString(),
        });
      }

      logNotification({
        appointmentId: appointment.id,
        clientName: appointment.clientName,
        recipientContact: appointment.clientEmail,
        type,
        channel: 'email',
        status: 'sent',
        message: msg.subject,
      });

      showToast(`E-mail de ${actionLabel} enviado com sucesso via Gmail!`, 'success');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Falha no envio do email';
      showToast(`Erro: ${errorMsg}`, 'error');
    } finally {
      setSendingEmailId(null);
    }
  };

  const pendingReminders = upcoming24hAppointments.filter((a) => !a.reminder24hSent);

  const handleRunBatch = async () => {
    setIsProcessingBatch(true);
    try {
      const count = await triggerAutomatic24hBatch();
      if (count === 0) {
        showToast('Nenhum lembrete pendente para processar.', 'info');
      } else {
        showToast(`Sucesso! ${count} lembrete(s) de 24h disparados (WhatsApp, Gmail & Notificação no Sistema do iPad/Telemóvel).`, 'success');
      }
    } catch {
      showToast('Erro ao processar lembretes automáticos.', 'error');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 24h Reminder Urgent Banner if any appointment in 24h window needs reminder */}
      {pendingReminders.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5">
              <Clock3 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">
                {pendingReminders.length === 1
                  ? 'Existe 1 sessão nas próximas 24 horas sem lembrete enviado!'
                  : `Existem ${pendingReminders.length} sessões nas próximas 24 horas sem lembrete!`}
              </h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                O estúdio dispara automaticamente WhatsApp, E-mail e Notificação no Sistema do iPad e Telemóvel 24h antes da marcação.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleRunBatch}
              disabled={isProcessingBatch}
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              title="Disparar lembretes automáticos agora para todas as sessões das próximas 24h"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isProcessingBatch ? 'A disparar...' : 'Disparar Automação 24h'}</span>
            </button>
            <button
              onClick={() => onOpenMessageModal(pendingReminders[0], 'reminder_24h')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ver / Enviar</span>
            </button>
            <button
              onClick={() => setIsNotificationCenterOpen(true)}
              className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-500/10 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1"
              title="Ver Central de Notificações"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Central</span>
            </button>
          </div>
        </div>
      )}

      {/* Control Bar: Filters & View Modes */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Artist Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-500 dark:text-zinc-400">Artista:</span>
            <select
              value={selectedArtistFilter}
              onChange={(e) => setSelectedArtistFilter(e.target.value)}
              className="bg-transparent font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
            >
              <option value="all" className="dark:bg-zinc-900">Todos os Artistas</option>
              {artists.map((art) => (
                <option key={art.id} value={art.id} className="dark:bg-zinc-900">
                  {art.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">Estado:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-transparent font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
            >
              <option value="all" className="dark:bg-zinc-900">Todos</option>
              <option value="confirmed" className="dark:bg-zinc-900">Confirmadas</option>
              <option value="pending" className="dark:bg-zinc-900">Pendentes</option>
              <option value="completed" className="dark:bg-zinc-900">Concluídas</option>
            </select>
          </div>

          {/* Google Sync Status Indicator */}
          {!googleToken && (
            <button
              onClick={connectGoogle}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-900 transition-colors cursor-pointer"
            >
              <CalendarSync className="w-3.5 h-3.5" />
              Ligar Google Calendar para sincronizar
            </button>
          )}
        </div>

        {/* View Switcher & Action */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="inline-flex p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'agenda'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Agenda
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Mês
            </button>
          </div>

          <button
            onClick={onNewAppointment}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            + Agendar
          </button>
        </div>
      </div>

      {/* Agenda List View */}
      {viewMode === 'agenda' && (
        <div className="space-y-6">
          {Object.keys(groupedByDate).length === 0 ? (
            <div className="text-center py-16 px-4 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl">
              <CalendarIcon className="w-10 h-10 mx-auto text-zinc-400 mb-3" />
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Nenhuma marcação encontrada
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                Não existem sessões agendadas com os filtros selecionados.
              </p>
              <button
                onClick={onNewAppointment}
                className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-medium cursor-pointer"
              >
                Criar Nova Marcação
              </button>
            </div>
          ) : (
            Object.entries(groupedByDate).map(([dateStr, appts]) => {
              const dateObj = new Date(`${dateStr}T00:00:00`);
              const isToday = new Date().toISOString().split('T')[0] === dateStr;
              const formattedDate = dateObj.toLocaleDateString('pt-PT', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });

              return (
                <div key={dateStr} className="space-y-3">
                  {/* Date Header */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                        isToday
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {isToday ? 'Hoje' : formattedDate.split(',')[0]}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      {formattedDate}
                    </span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-600">
                      • {appts.length} {appts.length === 1 ? 'sessão' : 'sessões'}
                    </span>
                  </div>

                  {/* Appointments Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {appts.map((appt) => {
                      const artist = artists.find((a) => a.id === appt.artistId);
                      const in24hWindow = isAppointmentIn24hWindow(appt);
                      const whatsappMsg = generateConfirmationMessage(appt, settings);
                      const whatsappUrl = getWhatsAppUrl(appt.clientPhone, whatsappMsg.text);

                      return (
                        <div
                          key={appt.id}
                          onClick={() => onSelectAppointment(appt)}
                          className="group relative p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
                        >
                          <div>
                            {/* Card Top: Time, Artist Tag & GCal badge */}
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                                <span>{appt.startTime} - {appt.endTime}</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {/* Google Calendar Sync Badge */}
                                {appt.gcalEventId ? (
                                  <span
                                    title="Sincronizado com o Google Agenda"
                                    className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60"
                                  >
                                    <CalendarCheck2 className="w-3 h-3" />
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      syncAppointmentToGoogle(appt.id);
                                    }}
                                    title="Sincronizar com Google Agenda"
                                    className="p-1 rounded-md text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                  >
                                    <CalendarSync className="w-3 h-3" />
                                  </button>
                                )}

                                {/* Status Chip */}
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    appt.status === 'confirmed'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                      : appt.status === 'pending'
                                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                  }`}
                                >
                                  {appt.status === 'confirmed'
                                    ? 'Confirmada'
                                    : appt.status === 'pending'
                                    ? 'Pendente'
                                    : 'Concluída'}
                                </span>
                              </div>
                            </div>

                            {/* Client & Artist Info */}
                            <div className="mb-3">
                              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                                <span className="truncate">{appt.clientName}</span>
                              </h4>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: artist?.color || '#a1a1aa' }}
                                />
                                <span>{appt.artistName}</span>
                              </p>
                            </div>

                            {/* Tattoo Details */}
                            <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/80 text-xs space-y-1 mb-3">
                              <div className="flex justify-between text-zinc-600 dark:text-zinc-300">
                                <span className="text-zinc-400">Local / Estilo:</span>
                                <span className="font-medium text-right truncate max-w-[160px]">
                                  {appt.placement} • {appt.style}
                                </span>
                              </div>
                              <div className="flex justify-between text-zinc-600 dark:text-zinc-300">
                                <span className="text-zinc-400">Valor / Sinal:</span>
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                  €{appt.price.toFixed(2)}
                                  {appt.deposit > 0 && (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-normal ml-1">
                                      (Sinal: €{appt.deposit})
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* Notification Status Badges */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[10px]">
                              {appt.confirmationSent ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                  <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />
                                  Confirmação enviada
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                                  Sem confirmação
                                </span>
                              )}

                              {appt.reminder24hSent ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                                  <CheckCircle className="w-2.5 h-2.5" />
                                  Lembrete 24h OK
                                </span>
                              ) : in24hWindow ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold animate-pulse">
                                  <Clock3 className="w-2.5 h-2.5" />
                                  Enviar Lembrete 24h!
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Quick Message Actions Bar (WhatsApp, Gmail, Modal) */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-1 text-xs"
                          >
                            <div className="flex items-center gap-1">
                              {/* Direct WhatsApp Click-to-Chat */}
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Enviar mensagem via WhatsApp"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium transition-colors"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>

                              {/* Direct Gmail API Sender */}
                              <button
                                onClick={(e) =>
                                  handleSendDirectGmail(
                                    appt,
                                    in24hWindow ? 'reminder_24h' : 'confirmation',
                                    e
                                  )
                                }
                                disabled={sendingEmailId === appt.id}
                                title={
                                  googleToken
                                    ? in24hWindow
                                      ? 'Enviar Lembrete 24h via Gmail'
                                      : 'Enviar Confirmação via Gmail'
                                    : 'Ligue o Google para enviar pelo Gmail'
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Mail className="w-3 h-3" />
                                <span>{sendingEmailId === appt.id ? 'A enviar...' : 'Gmail'}</span>
                              </button>
                            </div>

                            {/* Full Messaging Options Modal Trigger */}
                            <button
                              onClick={() =>
                                onOpenMessageModal(
                                  appt,
                                  in24hWindow ? 'reminder_24h' : 'confirmation'
                                )
                              }
                              title="Mais opções de envio (SMS, WhatsApp, Templates)"
                              className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Month Simple Overview Mode */}
      {viewMode === 'month' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Visão Mensal de Ocupação do Estúdio
            </h3>
            <span className="text-xs text-zinc-500">
              Total: {filteredAppointments.length} marcações registadas
            </span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredAppointments.map((appt) => (
              <div
                key={appt.id}
                onClick={() => onSelectAppointment(appt)}
                className="py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 px-3 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="text-center w-12 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <span className="block text-[10px] uppercase font-bold text-zinc-400">
                      {new Date(`${appt.date}T00:00:00`).toLocaleDateString('pt-PT', { month: 'short' })}
                    </span>
                    <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {new Date(`${appt.date}T00:00:00`).getDate()}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {appt.clientName} — {appt.title || appt.style}
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      {appt.startTime} às {appt.endTime} • {appt.artistName} • {appt.placement}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    €{appt.price.toFixed(2)}
                  </span>
                  {appt.gcalEventId && (
                    <span title="Google Calendar">
                      <CalendarCheck2 className="w-3.5 h-3.5 text-blue-500" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
