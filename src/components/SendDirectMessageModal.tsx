import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { Appointment, NotificationType } from '../types';
import {
  X,
  MessageCircle,
  Mail,
  Smartphone,
  Copy,
  Check,
  Send,
  Bell,
} from 'lucide-react';
import {
  generateConfirmationMessage,
  generate24hReminderMessage,
  getWhatsAppUrl,
  getSmsUrl,
} from '../services/messaging';
import { sendGmailMessage } from '../services/gmail';
import { dispatchSystemNotification } from '../services/systemNotifications';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  defaultType?: 'confirmation' | 'reminder_24h';
}

export const SendDirectMessageModal: React.FC<Props> = ({
  isOpen,
  onClose,
  appointment,
  defaultType = 'confirmation',
}) => {
  const { settings, googleToken, updateAppointment, logNotification, showToast, artists } = useStudio();
  const [messageType, setMessageType] = useState<'confirmation' | 'reminder_24h'>(defaultType);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !appointment) return null;

  const message =
    messageType === 'confirmation'
      ? generateConfirmationMessage(appointment, settings)
      : generate24hReminderMessage(appointment, settings);

  const handleWhatsApp = () => {
    const url = getWhatsAppUrl(appointment.clientPhone, message.text);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (messageType === 'reminder_24h') {
      updateAppointment(appointment.id, {
        reminder24hSent: true,
        reminder24hSentAt: new Date().toISOString(),
      });
    } else {
      updateAppointment(appointment.id, {
        confirmationSent: true,
        confirmationSentAt: new Date().toISOString(),
      });
    }

    logNotification({
      appointmentId: appointment.id,
      clientName: appointment.clientName,
      recipientContact: appointment.clientPhone,
      type: messageType,
      channel: 'whatsapp',
      status: 'sent',
      message: message.subject,
    });
    onClose();
  };

  const handleSystemNotification = async () => {
    const isReminder = messageType === 'reminder_24h';
    const artist = artists.find((a) => a.id === appointment.artistId);
    const artistName = artist ? artist.name : appointment.artistName;

    const title = isReminder
      ? `⏰ Lembrete 24h: Sessão com ${appointment.clientName}`
      : `🗓️ Marcação Confirmada: ${appointment.clientName}`;

    const body = isReminder
      ? `Sessão amanhã às ${appointment.startTime} com ${artistName} (${appointment.placement || 'Tatuagem'}).`
      : `${appointment.date} às ${appointment.startTime} com ${artistName} (${appointment.placement || 'Tatuagem'}).`;

    const dispatched = await dispatchSystemNotification(title, {
      body,
      tag: `manual-system-${appointment.id}-${messageType}`,
    });

    if (dispatched) {
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
        recipientContact: 'iPad / Telemóvel (Sistema)',
        type: messageType,
        channel: 'system',
        status: 'sent',
        message: `Notificação nativa disparada no sistema: ${title} - ${body}`,
        read: false,
      });

      showToast(`Notificação disparada com sucesso no sistema do iPad/Telemóvel!`, 'success');
      onClose();
    } else {
      showToast('Permissão de notificações no sistema pendente ou não concedida.', 'info');
    }
  };

  const handleGmail = async () => {
    if (!googleToken) {
      showToast('Para enviar e-mail pelo Gmail, liga a tua conta Google no topo.', 'info');
      return;
    }
    if (!appointment.clientEmail) {
      showToast('O cliente não tem endereço de email associado.', 'info');
      return;
    }

    try {
      setIsSendingEmail(true);
      await sendGmailMessage(
        {
          to: appointment.clientEmail,
          toName: appointment.clientName,
          subject: message.subject,
          htmlContent: message.html,
          fromName: settings.name,
        },
        googleToken
      );

      if (messageType === 'reminder_24h') {
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
        type: messageType,
        channel: 'email',
        status: 'sent',
        message: message.subject,
      });

      showToast('E-mail enviado com sucesso via Gmail!', 'success');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha no envio';
      showToast(`Erro: ${msg}`, 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSms = () => {
    const url = getSmsUrl(appointment.clientPhone, message.text);
    window.location.href = url;

    logNotification({
      appointmentId: appointment.id,
      clientName: appointment.clientName,
      recipientContact: appointment.clientPhone,
      type: messageType,
      channel: 'sms',
      status: 'sent',
      message: message.subject,
    });
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Enviar Mensagem para Cliente
            </h3>
            <p className="text-xs text-zinc-500">
              {appointment.clientName} ({appointment.clientPhone})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type selector */}
        <div className="flex p-1 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
          <button
            onClick={() => setMessageType('confirmation')}
            className={`flex-1 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              messageType === 'confirmation'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Confirmação de Marcação
          </button>
          <button
            onClick={() => setMessageType('reminder_24h')}
            className={`flex-1 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              messageType === 'reminder_24h'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Lembrete de 24 Horas
          </button>
        </div>

        {/* Channels */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </button>
          <button
            onClick={handleGmail}
            disabled={isSendingEmail}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            <Mail className="w-4 h-4" />
            {isSendingEmail ? 'A enviar...' : 'Gmail'}
          </button>
          <button
            onClick={handleSystemNotification}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
            title="Disparar notificação nativa no ecrã e sistema do iPad ou telemóvel"
          >
            <Bell className="w-4 h-4" />
            iPad / Tlm
          </button>
          <button
            onClick={handleSms}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-bold cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            SMS
          </button>
        </div>

        {/* Message preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Pré-visualização:</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
            {message.text}
          </div>
        </div>
      </div>
    </div>
  );
};
