/**
 * Messages after a tattoo session (Miguel, 10 Nov 2026):
 *   d7  – one week after: how is it healing?
 *   d14 – two weeks after: touch-up if needed, Google review, tag us on Instagram
 *   m3  – about 2–3 months after: "we're still here" (only if the client agreed to hear from us)
 *
 * Pure functions with no Firebase imports, so the app (MessagingView) and the daily Cloudflare
 * task (workers/follow-ups) decide exactly the same things.
 */
import type { Appointment, Client, FollowUpKind, FollowUpMark, StudioSettings } from '../types';

export interface FollowUpRule {
  kind: FollowUpKind;
  /** Days after the session it becomes due. */
  days: number;
  /** Days it stays in the list after that; later than this it's not worth sending any more. */
  lateDays: number;
  label: string;
}

export const FOLLOW_UPS: FollowUpRule[] = [
  { kind: 'd7', days: 7, lateDays: 6, label: '1 semana' },
  { kind: 'd14', days: 14, lateDays: 10, label: '2 semanas' },
  { kind: 'm3', days: 75, lateDays: 30, label: '2–3 meses' },
];

export const STUDIO_TIMEZONE = 'Europe/Lisbon';
export const SITE_URL = 'https://inkcompativel.pt';

/** Today as YYYY-MM-DD in the studio's time zone. */
export const todayInStudio = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export const addDays = (isoDate: string, days: number): string => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export interface DueFollowUp {
  appointment: Appointment;
  client?: Client;
  kind: FollowUpKind;
  dueDate: string;
  lang: 'pt' | 'en';
}

type Settings = Pick<StudioSettings, 'followUpsEnabled'>;

/**
 * Follow-ups to send today. Rules:
 * - only sessions marked "completed", and only the client's latest one (a later session restarts the cycle);
 * - d7/d14 are dropped if the client already had another session before they were due;
 * - m3 needs the client's consent and no later session (booked or done);
 * - nothing for a client who asked to stop;
 * - when two are due for the same session (e.g. d7 was never sent), only the newest one is listed.
 */
export const dueFollowUps = (
  appointments: Appointment[],
  clients: Client[],
  today: string,
  settings?: Settings
): DueFollowUp[] => {
  if (settings?.followUpsEnabled === false) return [];
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const byClient = new Map<string, Appointment[]>();
  for (const a of appointments) {
    if (a.status === 'cancelled') continue;
    const list = byClient.get(a.clientId) || [];
    list.push(a);
    byClient.set(a.clientId, list);
  }

  const out: DueFollowUp[] = [];
  const seen = new Set<string>();
  for (const a of appointments) {
    if (a.status !== 'completed' || !a.date) continue;
    const client = clientById.get(a.clientId);
    if (client?.followUpOptOutAt) continue;
    const others = (byClient.get(a.clientId) || []).filter((o) => o.id !== a.id && o.date > a.date);

    for (const rule of [...FOLLOW_UPS].reverse()) {
      const due = addDays(a.date, rule.days);
      if (today < due) continue; // not yet: try an earlier one
      if (a.followUps?.[rule.kind]) break; // this one (or a newer one) is done
      if (today > addDays(due, rule.lateDays)) break; // too late, and earlier ones are later still
      if (rule.kind === 'm3') {
        if (!client?.marketingConsentAt || others.length) break;
      } else if (others.some((o) => o.date <= due)) {
        break;
      }
      const key = `${a.clientId}:${rule.kind}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ appointment: a, client, kind: rule.kind, dueDate: due, lang: client?.language === 'en' ? 'en' : 'pt' });
      }
      break;
    }
  }
  return out.sort((x, y) => x.dueDate.localeCompare(y.dueDate) || x.appointment.clientName.localeCompare(y.appointment.clientName));
};

export const followUpMark = (via: FollowUpMark['via'], now: Date = new Date()): FollowUpMark => ({ at: now.toISOString(), via });

// ------------------------------------------------------------------ messages

type MsgSettings = Pick<StudioSettings, 'name' | 'instagram'> & Partial<Pick<StudioSettings, 'googleReviewUrl'>>;

const firstName = (name: string) => (name || '').trim().split(/\s+/)[0] || '';
const handle = (ig: string) => {
  const h = (ig || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
  return h ? (h.startsWith('@') ? h : `@${h}`) : '';
};

const TEXTS = {
  pt: {
    d7: (s: Ctx) => ({
      subject: `Como está a tua tatuagem? · ${s.studio}`,
      body: [
        `Olá ${s.name}! Passou uma semana desde a tua sessão${s.artist ? ` com ${s.artist}` : ''}. Como está a sarar?`,
        'Se alguma coisa te parecer estranha (vermelhidão que não passa, inchaço, crosta grossa), manda-nos uma foto e vemos contigo.',
        'Até sarar: nada de película, lava com água morna e sabão neutro, uma camada fina de creme 2 a 3 vezes por dia, não coces as crostas, e durante 15 dias nada de sol, solário, banho turco, sauna, piscina nem praia.',
        `🖤 ${s.studio}`,
      ],
    }),
    d14: (s: Ctx) => ({
      subject: `Duas semanas depois · ${s.studio}`,
      body: [
        `Olá ${s.name}! Duas semanas depois, a tua tatuagem já deve estar quase sarada.`,
        'Se vires alguma falha na cor ou nas linhas, diz-nos e combinamos um retoque.',
        s.review ? `Se gostaste da experiência, uma crítica no Google ajuda-nos muito: ${s.review}` : '',
        s.ig ? `E se a partilhares no Instagram, identifica ${s.ig} 🖤` : `🖤 ${s.studio}`,
      ],
    }),
    m3: (s: Ctx) => ({
      subject: `Novidades da ${s.studio}`,
      body: [
        `Olá ${s.name}! Já passaram uns meses desde a tua sessão na ${s.studio}. Como está a tatuagem?`,
        `Se tens uma ideia nova, ou queres ver o flash disponível, estamos por aqui: ${s.site}/marcar`,
        'Se preferires não receber estas mensagens, responde «parar».',
      ],
    }),
  },
  en: {
    d7: (s: Ctx) => ({
      subject: `How is your tattoo doing? · ${s.studio}`,
      body: [
        `Hi ${s.name}! It’s been a week since your session${s.artist ? ` with ${s.artist}` : ''}. How is it healing?`,
        'If anything looks off (redness that won’t go, swelling, thick scabs), send us a photo and we’ll take a look with you.',
        'Until it’s healed: no cling film, wash with lukewarm water and mild soap, a thin layer of cream 2 to 3 times a day, don’t pick at scabs, and for 15 days no sun, sunbeds, steam rooms, saunas, pools or beach.',
        `🖤 ${s.studio}`,
      ],
    }),
    d14: (s: Ctx) => ({
      subject: `Two weeks on · ${s.studio}`,
      body: [
        `Hi ${s.name}! Two weeks on, your tattoo should be almost healed.`,
        'If you see any patchy colour or lines, let us know and we’ll arrange a touch-up.',
        s.review ? `If you enjoyed it, a Google review helps us a lot: ${s.review}` : '',
        s.ig ? `And if you share it on Instagram, tag ${s.ig} 🖤` : `🖤 ${s.studio}`,
      ],
    }),
    m3: (s: Ctx) => ({
      subject: `News from ${s.studio}`,
      body: [
        `Hi ${s.name}! It’s been a few months since your session at ${s.studio}. How is your tattoo?`,
        `If you have a new idea, or want to see the flash we have available, we’re here: ${s.site}/en/book`,
        'If you’d rather not get these messages, just reply “stop”.',
      ],
    }),
  },
};

interface Ctx {
  name: string;
  artist: string;
  studio: string;
  ig: string;
  review: string;
  site: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const linkify = (s: string) => escapeHtml(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#e11d2e">${u}</a>`);

export const generateFollowUpMessage = (
  kind: FollowUpKind,
  appointment: Pick<Appointment, 'clientName' | 'artistName'>,
  settings: MsgSettings,
  lang: 'pt' | 'en' = 'pt',
  site: string = SITE_URL
): { text: string; html: string; subject: string } => {
  const ctx: Ctx = {
    name: firstName(appointment.clientName),
    artist: appointment.artistName || '',
    studio: settings.name || 'Ink Compatível',
    ig: handle(settings.instagram),
    review: settings.googleReviewUrl || '',
    site,
  };
  const { subject, body } = TEXTS[lang][kind](ctx);
  const paragraphs = body.filter(Boolean);
  const text = paragraphs.join('\n\n');
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#18181b;font-size:15px;line-height:1.6">${paragraphs
    .map((p) => `<p style="margin:0 0 14px">${linkify(p)}</p>`)
    .join('')}</div>`;
  return { text, html, subject };
};
