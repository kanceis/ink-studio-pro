import React, { useMemo, useState } from 'react';
import { CalendarCheck2, CheckCircle2, Copy, HeartHandshake, Mail, MessageCircle, Settings2, SkipForward } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { Appointment, FollowUpKind, FollowUpMark } from '../types';
import { DueFollowUp, FOLLOW_UPS, addDays, dueFollowUps, followUpMark, generateFollowUpMessage, todayInStudio } from '../services/followUps';
import { getWhatsAppUrl } from '../services/messaging';
import { sendGmailMessage } from '../services/gmail';
import { patchItem } from '../services/studioStore';

const LABEL: Record<FollowUpKind, string> = Object.fromEntries(FOLLOW_UPS.map((f) => [f.kind, f.label])) as Record<FollowUpKind, string>;

const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });

/**
 * "A enviar hoje": the messages after a session that are due today (1 week, 2 weeks, 2–3 months),
 * each sent with one tap by WhatsApp or Gmail. Rules in services/followUps.ts.
 */
export const FollowUpsPanel: React.FC = () => {
  const { appointments, clients, settings, updateSettings, logNotification, googleToken, connectGoogle, showToast } = useStudio();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const today = todayInStudio();

  const due = useMemo(() => dueFollowUps(appointments, clients, today, settings), [appointments, clients, today, settings]);

  // Past sessions in the last 30 days still not marked as done: they get no messages until they are.
  const notDone = useMemo(
    () =>
      appointments
        .filter((a) => (a.status === 'confirmed' || a.status === 'pending') && a.date < today && a.date >= addDays(today, -30))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [appointments, today]
  );

  const mark = async (item: DueFollowUp, via: FollowUpMark['via']) => {
    // Field path, so it never overwrites a mark the daily email task wrote meanwhile.
    await patchItem('appointments', item.appointment.id, {
      [`followUps.${item.kind}`]: followUpMark(via),
    } as unknown as Partial<Appointment>);
  };

  const key = (item: DueFollowUp) => `${item.appointment.id}:${item.kind}`;
  const message = (item: DueFollowUp) => generateFollowUpMessage(item.kind, item.appointment, settings, item.lang);

  const log = (item: DueFollowUp, channel: 'whatsapp' | 'email', contact: string, text: string) =>
    logNotification({
      appointmentId: item.appointment.id,
      clientName: item.appointment.clientName,
      recipientContact: contact,
      type: 'follow_up',
      channel,
      status: 'sent',
      message: `${LABEL[item.kind]}: ${text.slice(0, 140)}`,
    });

  const onWhatsApp = (item: DueFollowUp) => {
    const msg = message(item);
    mark(item, 'whatsapp').catch(() => showToast('Não foi possível guardar o envio.', 'error'));
    log(item, 'whatsapp', item.appointment.clientPhone, msg.text);
  };

  const onEmail = async (item: DueFollowUp) => {
    const to = item.client?.email || item.appointment.clientEmail;
    if (!to) return showToast('Este cliente não tem email.', 'info');
    if (!googleToken) {
      showToast('Liga a conta Google para enviar pelo Gmail.', 'info');
      return connectGoogle();
    }
    const msg = message(item);
    setBusy(key(item));
    try {
      await sendGmailMessage({ to, toName: item.appointment.clientName, subject: msg.subject, htmlContent: msg.html, fromName: settings.name }, googleToken);
      await mark(item, 'email');
      log(item, 'email', to, msg.subject);
      showToast('Email enviado.', 'success');
    } catch (err) {
      showToast(`Não foi possível enviar: ${err instanceof Error ? err.message : 'erro'}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const onSkip = (item: DueFollowUp) =>
    mark(item, 'skipped')
      .then(() => showToast('Esta mensagem saiu da lista.', 'info'))
      .catch(() => showToast('Não foi possível guardar.', 'error'));

  const onCopy = (item: DueFollowUp) => {
    navigator.clipboard.writeText(message(item).text).then(() => showToast('Mensagem copiada.', 'success'));
  };

  const markDone = (a: Appointment) =>
    patchItem('appointments', a.id, { status: 'completed' })
      .then(() => showToast(`Sessão de ${a.clientName} marcada como feita.`, 'success'))
      .catch(() => showToast('Não foi possível guardar.', 'error'));

  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-8 space-y-3">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-rose-500" />
            A enviar hoje ({due.length})
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Depois de cada sessão feita: mensagem ao fim de 1 semana e de 2 semanas, e aos 2–3 meses só para quem aceitou receber novidades.
            {settings.followUpAutoEmail
              ? ' O email automático está ligado: os emails saem sozinhos de manhã, e aqui ficam os restantes.'
              : ''}
          </p>
        </div>

        {settings.followUpsEnabled === false && (
          <p className="p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-500">
            As mensagens depois da sessão estão desligadas nas definições ao lado.
          </p>
        )}

        {settings.followUpsEnabled !== false && due.length === 0 && (
          <p className="p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-500">
            Nada para enviar hoje.
          </p>
        )}

        {due.map((item) => {
          const k = key(item);
          const msg = message(item);
          const email = item.client?.email || item.appointment.clientEmail;
          return (
            <div key={k} className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.appointment.clientName}</p>
                  <p className="text-[11px] text-zinc-500">
                    Sessão a {fmtDate(item.appointment.date)} com {item.appointment.artistName}
                    {item.lang === 'en' ? ' · em inglês' : ''}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  {LABEL[item.kind]}
                </span>
              </div>

              <button
                onClick={() => setOpen(open === k ? null : k)}
                className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                aria-expanded={open === k}
              >
                {open === k ? 'Esconder mensagem' : 'Ver mensagem'}
              </button>
              {open === k && (
                <pre className="whitespace-pre-wrap font-sans text-xs p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {msg.text}
                </pre>
              )}

              <div className="flex flex-wrap gap-2">
                {item.appointment.clientPhone && (
                  <a
                    href={getWhatsAppUrl(item.appointment.clientPhone, msg.text)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onWhatsApp(item)}
                    className={`${btn} bg-emerald-500 hover:bg-emerald-600 text-white`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
                {email && (
                  <button onClick={() => onEmail(item)} disabled={busy === k} className={`${btn} bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900`}>
                    <Mail className="w-3.5 h-3.5" /> {busy === k ? 'A enviar…' : 'Email'}
                  </button>
                )}
                <button onClick={() => onCopy(item)} className={`${btn} bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200`}>
                  <Copy className="w-3.5 h-3.5" /> Copiar
                </button>
                <button onClick={() => onSkip(item)} className={`${btn} text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100`}>
                  <SkipForward className="w-3.5 h-3.5" /> Não enviar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="lg:col-span-4 space-y-4">
        {notDone.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <CalendarCheck2 className="w-4 h-4" /> Sessões por marcar como feitas ({notDone.length})
            </h4>
            <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80">
              Só as sessões marcadas como feitas recebem as mensagens.
            </p>
            <ul className="space-y-1.5">
              {notDone.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-white/80 dark:bg-zinc-900/80">
                  <span>
                    {a.clientName}
                    <span className="block text-[10px] text-zinc-500">{fmtDate(a.date)} · {a.artistName}</span>
                  </span>
                  <button onClick={() => markDone(a)} className={`${btn} bg-amber-500 text-zinc-950`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Feita
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
          <button onClick={() => setShowSettings(!showSettings)} className="w-full flex items-center justify-between font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer" aria-expanded={showSettings}>
            <span className="flex items-center gap-2"><Settings2 className="w-4 h-4 text-zinc-500" /> Definições</span>
            <span className="text-zinc-400">{showSettings ? '−' : '+'}</span>
          </button>
          {showSettings && (
            <div className="space-y-3">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={settings.followUpsEnabled !== false} onChange={(e) => updateSettings({ followUpsEnabled: e.target.checked })} />
                <span>Mensagens depois da sessão (1 semana, 2 semanas, 2–3 meses)</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={!!settings.followUpAutoEmail} onChange={(e) => updateSettings({ followUpAutoEmail: e.target.checked })} />
                <span>
                  Enviar os emails sozinho todas as manhãs, de geral@inkcompativel.pt
                  <span className="block text-[10px] text-zinc-500">Só funciona depois de o envio pelo domínio estar ligado no Cloudflare.</span>
                </span>
              </label>
              <label className="block space-y-1">
                <span>Link para avaliações no Google (mensagem das 2 semanas)</span>
                <input
                  type="url"
                  defaultValue={settings.googleReviewUrl || ''}
                  placeholder="https://g.page/r/…/review"
                  onBlur={(e) => e.target.value !== (settings.googleReviewUrl || '') && updateSettings({ googleReviewUrl: e.target.value.trim() })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
