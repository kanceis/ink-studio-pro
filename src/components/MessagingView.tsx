import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { Appointment, NotificationChannel, NotificationType } from '../types';
import {
  MessageSquareShare,
  MessageCircle,
  Mail,
  Smartphone,
  Clock3,
  CheckCircle2,
  Send,
  AlertCircle,
  User,
  Calendar,
  ExternalLink,
  Copy,
  History,
} from 'lucide-react';
import {
  generateConfirmationMessage,
  generate24hReminderMessage,
  generateArtistNotificationMessage,
  getWhatsAppUrl,
  getSmsUrl,
  isAppointmentIn24hWindow,
} from '../services/messaging';
import { sendGmailMessage } from '../services/gmail';
import { FollowUpsPanel } from './FollowUpsPanel';
import { dueFollowUps, todayInStudio } from '../services/followUps';

export const MessagingView: React.FC = () => {
  const {
    appointments,
    clients,
    notificationLogs,
    logNotification,
    updateAppointment,
    googleToken,
    googleUser,
    connectGoogle,
    settings,
    showToast,
  } = useStudio();

  const [selectedTab, setSelectedTab] = useState<'reminders' | 'followups' | 'logs' | 'templates'>('reminders');
  const followUpsDue = dueFollowUps(appointments, clients, todayInStudio(), settings).length;
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>(appointments[0]?.id || '');
  const [activeMessageType, setActiveMessageType] = useState<'confirmation' | 'reminder_24h' | 'artist'>('reminder_24h');
  const [sendingState, setSendingState] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const selectedAppointment = appointments.find((a) => a.id === selectedAppointmentId) || appointments[0];

  // Upcoming appointments in 24h window
  const appointmentsIn24h = appointments.filter(
    (a) => a.status !== 'cancelled' && isAppointmentIn24hWindow(a)
  );

  const generateCurrentMessage = () => {
    if (!selectedAppointment) return { text: '', html: '', subject: '' };
    if (activeMessageType === 'reminder_24h') {
      return generate24hReminderMessage(selectedAppointment, settings);
    }
    if (activeMessageType === 'confirmation') {
      return generateConfirmationMessage(selectedAppointment, settings);
    }
    const artistMsg = generateArtistNotificationMessage(selectedAppointment, settings, 'reminder');
    return {
      text: artistMsg.text,
      html: `<pre style="font-family: monospace; white-space: pre-wrap;">${artistMsg.text}</pre>`,
      subject: `Notificação de Sessão - ${settings.name}`,
    };
  };

  const currentMessage = generateCurrentMessage();

  const handleSendGmail = async () => {
    if (!selectedAppointment) return;
    if (!googleToken) {
      showToast('Por favor liga a tua conta Google primeiro no topo para enviar emails pelo Gmail.', 'info');
      return;
    }
    const recipient = activeMessageType === 'artist' ? 'artista' : selectedAppointment.clientName;
    const recipientEmail = activeMessageType === 'artist' ? selectedAppointment.clientEmail : selectedAppointment.clientEmail;

    if (!recipientEmail) {
      showToast('Endereço de e-mail não disponível.', 'info');
      return;
    }

    try {
      setSendingState('email');
      await sendGmailMessage(
        {
          to: recipientEmail,
          toName: recipient,
          subject: currentMessage.subject,
          htmlContent: currentMessage.html,
          fromName: settings.name,
        },
        googleToken
      );

      if (activeMessageType === 'reminder_24h') {
        await updateAppointment(selectedAppointment.id, {
          reminder24hSent: true,
          reminder24hSentAt: new Date().toISOString(),
        });
      } else if (activeMessageType === 'confirmation') {
        await updateAppointment(selectedAppointment.id, {
          confirmationSent: true,
          confirmationSentAt: new Date().toISOString(),
        });
      }

      logNotification({
        appointmentId: selectedAppointment.id,
        clientName: selectedAppointment.clientName,
        recipientContact: recipientEmail,
        type: activeMessageType as NotificationType,
        channel: 'email',
        status: 'sent',
        message: currentMessage.subject,
      });

      showToast('E-mail enviado com sucesso via Gmail!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro no envio';
      showToast(`Falha: ${msg}`, 'error');
    } finally {
      setSendingState(null);
    }
  };

  const handleWhatsAppClick = () => {
    if (!selectedAppointment) return;
    const url = getWhatsAppUrl(selectedAppointment.clientPhone, currentMessage.text);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (activeMessageType === 'reminder_24h') {
      updateAppointment(selectedAppointment.id, {
        reminder24hSent: true,
        reminder24hSentAt: new Date().toISOString(),
      });
    } else if (activeMessageType === 'confirmation') {
      updateAppointment(selectedAppointment.id, {
        confirmationSent: true,
        confirmationSentAt: new Date().toISOString(),
      });
    }

    logNotification({
      appointmentId: selectedAppointment.id,
      clientName: selectedAppointment.clientName,
      recipientContact: selectedAppointment.clientPhone,
      type: activeMessageType as NotificationType,
      channel: 'whatsapp',
      status: 'sent',
      message: currentMessage.text.slice(0, 80) + '...',
    });
  };

  const handleSmsClick = () => {
    if (!selectedAppointment) return;
    const url = getSmsUrl(selectedAppointment.clientPhone, currentMessage.text);
    window.location.href = url;

    logNotification({
      appointmentId: selectedAppointment.id,
      clientName: selectedAppointment.clientName,
      recipientContact: selectedAppointment.clientPhone,
      type: activeMessageType as NotificationType,
      channel: 'sms',
      status: 'sent',
      message: currentMessage.text.slice(0, 80) + '...',
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentMessage.text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <MessageSquareShare className="w-5 h-5 text-zinc-500" />
            Central de Mensagens Automáticas & Lembretes
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Envio automático e com 1 clique de Confirmações e Lembretes 24h via WhatsApp, SMS e Gmail.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="inline-flex p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
          <button
            onClick={() => setSelectedTab('reminders')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              selectedTab === 'reminders'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Disparar Mensagens
          </button>
          <button
            onClick={() => setSelectedTab('followups')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              selectedTab === 'followups'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Depois da sessão{followUpsDue ? ` (${followUpsDue})` : ''}
          </button>
          <button
            onClick={() => setSelectedTab('logs')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              selectedTab === 'logs'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Histórico ({notificationLogs.length})
          </button>
        </div>
      </div>

      {selectedTab === 'reminders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Upcoming Appointments & 24h Reminder Queue */}
          <div className="lg:col-span-5 space-y-4">
            {/* 24h Window Highlight Box */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Fila de Lembretes de 24 Horas
                </h4>
              </div>
              <p className="text-xs opacity-90">
                {appointmentsIn24h.length === 0
                  ? 'Nenhuma sessão prevista para as próximas 24 horas no momento.'
                  : `${appointmentsIn24h.length} marcação(ões) a decorrer nas próximas 24 horas:`}
              </p>

              {appointmentsIn24h.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {appointmentsIn24h.map((appt) => (
                    <button
                      key={appt.id}
                      onClick={() => {
                        setSelectedAppointmentId(appt.id);
                        setActiveMessageType('reminder_24h');
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        selectedAppointmentId === appt.id
                          ? 'bg-amber-500 text-zinc-950 font-bold'
                          : 'bg-white/80 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-amber-500/20'
                      }`}
                    >
                      <div>
                        <span>{appt.clientName}</span>
                        <span className="opacity-75 block text-[10px]">
                          {appt.date} às {appt.startTime} • {appt.artistName}
                        </span>
                      </div>
                      {appt.reminder24hSent ? (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓ Enviado
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold animate-pulse">
                          Pendente
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* All Appointments Selector */}
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Selecionar Marcação para Envio:
              </h4>

              <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                {appointments.map((appt) => {
                  const isSelected = selectedAppointmentId === appt.id;
                  return (
                    <div
                      key={appt.id}
                      onClick={() => setSelectedAppointmentId(appt.id)}
                      className={`p-3 rounded-lg border text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 border-zinc-900 dark:border-white shadow-xs'
                          : 'bg-zinc-50 dark:bg-zinc-950/60 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold">{appt.clientName}</span>
                        <span className="text-[10px] opacity-75">{appt.date}</span>
                      </div>
                      <p
                        className={`text-[11px] ${
                          isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500'
                        }`}
                      >
                        {appt.startTime} às {appt.endTime} • {appt.artistName}
                      </p>
                      <div className="flex gap-2 mt-1.5 text-[10px]">
                        <span>{appt.confirmationSent ? '✓ Confirmado' : '○ Sem conf.'}</span>
                        <span>{appt.reminder24hSent ? '✓ Lembrete OK' : '○ Sem lembr.'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Message Dispatcher & Real-time Live Preview */}
          {selectedAppointment ? (
            <div className="lg:col-span-7 space-y-4">
              {/* Type Switcher */}
              <div className="flex items-center gap-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                <button
                  onClick={() => setActiveMessageType('reminder_24h')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeMessageType === 'reminder_24h'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  ⏰ Lembrete de 24 Horas
                </button>
                <button
                  onClick={() => setActiveMessageType('confirmation')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeMessageType === 'confirmation'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  ✉️ Confirmação de Marcação
                </button>
                <button
                  onClick={() => setActiveMessageType('artist')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeMessageType === 'artist'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  🎨 Aviso para Artista
                </button>
              </div>

              {/* Message Details & Dispatch Action Bar */}
              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Destinatário:{' '}
                      <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                        {selectedAppointment.clientName} ({selectedAppointment.clientPhone})
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Sessão: {selectedAppointment.date} às {selectedAppointment.startTime} com {selectedAppointment.artistName}
                    </p>
                  </div>

                  <button
                    onClick={copyToClipboard}
                    className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedText ? 'Copiado!' : 'Copiar Texto'}</span>
                  </button>
                </div>

                {/* Dispatch Buttons Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* WhatsApp Direct */}
                  <button
                    onClick={handleWhatsAppClick}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar WhatsApp</span>
                  </button>

                  {/* Gmail Direct via Workspace Token */}
                  <button
                    onClick={handleSendGmail}
                    disabled={sendingState === 'email'}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-60"
                  >
                    <Mail className="w-4 h-4" />
                    <span>
                      {sendingState === 'email'
                        ? 'A enviar...'
                        : googleToken
                        ? 'Enviar Gmail Direto'
                        : 'Ligar Gmail'}
                    </span>
                  </button>

                  {/* SMS Direct */}
                  <button
                    onClick={handleSmsClick}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Enviar SMS</span>
                  </button>
                </div>

                {!googleToken && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400">
                    💡 Dica: Conecta o Google no topo para disparar emails reais com formato profissional diretamente da tua conta Gmail.
                  </p>
                )}

                {/* Live Message Preview */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Pré-visualização da Mensagem:
                  </span>
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 font-mono whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                    {currentMessage.text}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-7 p-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400">
              Nenhuma marcação disponível para envio.
            </div>
          )}
        </div>
      )}

      {selectedTab === 'followups' && <FollowUpsPanel />}

      {/* Logs View */}
      {selectedTab === 'logs' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-500" />
              Histórico de Mensagens Enviadas ({notificationLogs.length})
            </h3>
          </div>

          {notificationLogs.length === 0 ? (
            <p className="text-xs text-zinc-400 py-6 text-center">Nenhum registo de envio recente.</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {notificationLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg mt-0.5 ${
                        log.channel === 'whatsapp'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : log.channel === 'email'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600'
                      }`}
                    >
                      {log.channel === 'whatsapp' && <MessageCircle className="w-4 h-4" />}
                      {log.channel === 'email' && <Mail className="w-4 h-4" />}
                      {log.channel === 'sms' && <Smartphone className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {log.clientName}
                        </span>
                        <span className="text-zinc-400">({log.recipientContact})</span>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {log.type === 'confirmation' ? 'Confirmação' : 'Lembrete 24h'}
                        </span>
                      </div>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5 line-clamp-1">
                        {log.message}
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-zinc-400 flex-shrink-0">
                    {new Date(log.timestamp).toLocaleString('pt-PT', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
