/**
 * Daily follow-up emails (Cron Trigger, see wrangler.toml).
 *
 * Reads the studio's appointments and clients with the service account, works out which messages
 * are due today with the same rules as the app (src/services/followUps.ts), sends each by email
 * through Resend from geral@inkcompativel.pt, and marks it on the appointment (via: 'auto_email')
 * so the app's list doesn't show it again. Clients without an email stay in the app's list
 * for WhatsApp.
 */
import { commit, fromFields, getDoc, listDocs, studioDocName, toFields, toValue } from '../../functions/_lib/firestore';
import { dueFollowUps, followUpMark, generateFollowUpMessage, todayInStudio } from '../../src/services/followUps';
import type { Appointment, Client, NotificationLog, StudioSettings } from '../../src/types';

interface Env {
  FIREBASE_PROJECT_ID: string;
  FIRESTORE_DATABASE_ID?: string;
  STUDIO_ID?: string;
  FIRESTORE_EMULATOR_HOST?: string;
  GOOGLE_SERVICE_ACCOUNT?: string;
  RESEND_API_KEY?: string;
  /** Only for tests: a mock Resend API base URL. */
  RESEND_API_BASE?: string;
  MAIL_FROM: string;
  MAIL_REPLY_TO?: string;
  MAX_PER_DAY?: string;
}

const docId = (name: string) => name.split('/').pop() as string;
const read = <T>(docs: { name: string; fields: Parameters<typeof fromFields>[0] }[]) =>
  docs.map((d) => ({ id: docId(d.name), ...fromFields(d.fields) }) as T);

const sendEmail = async (env: Env, to: string, msg: { subject: string; html: string; text: string }, idempotencyKey: string) => {
  const res = await fetch(`${env.RESEND_API_BASE || 'https://api.resend.com'}/emails`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      // Resend drops a repeat with the same key for 24 h, so a retry never sends twice.
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      reply_to: env.MAIL_REPLY_TO || undefined,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
};

export const run = async (env: Env, now = new Date()) => {
  if (!env.RESEND_API_KEY) return { skipped: 'RESEND_API_KEY is not set' };
  const settingsDoc = await getDoc(env, studioDocName(env, 'meta', 'settings'));
  const settings = (settingsDoc ? fromFields(settingsDoc.fields) : {}) as Partial<StudioSettings>;
  if (!settings.followUpAutoEmail || settings.followUpsEnabled === false) return { skipped: 'turned off in the app' };

  const [appointments, clients] = await Promise.all([
    listDocs(env, 'appointments').then((d) => read<Appointment>(d)),
    listDocs(env, 'clients').then((d) => read<Client>(d)),
  ]);
  const due = dueFollowUps(appointments, clients, todayInStudio(now), settings);
  const max = Number(env.MAX_PER_DAY || 40);

  let sent = 0;
  const errors: string[] = [];
  for (const item of due) {
    if (sent >= max) break;
    const to = (item.client?.email || item.appointment.clientEmail || '').trim();
    if (!to) continue; // stays in the app's list for WhatsApp
    const msg = generateFollowUpMessage(item.kind, item.appointment, settings as StudioSettings, item.lang);
    try {
      await sendEmail(env, to, msg, `follow-up:${item.appointment.id}:${item.kind}`);
      sent++;
      const log: NotificationLog = {
        id: `notif-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        appointmentId: item.appointment.id,
        clientName: item.appointment.clientName,
        recipientContact: to,
        type: 'follow_up',
        channel: 'email',
        status: 'sent',
        timestamp: new Date().toISOString(),
        message: `Email automático: ${msg.subject}`,
        read: false,
      };
      await commit(env, [
        {
          update: {
            name: studioDocName(env, 'appointments', item.appointment.id),
            fields: { followUps: { mapValue: { fields: { [item.kind]: toValue(followUpMark('auto_email')) } } } },
          },
          updateMask: { fieldPaths: [`followUps.${item.kind}`] },
          currentDocument: { exists: true },
        },
        { update: { name: studioDocName(env, 'notifications', log.id), fields: toFields({ ...log }) } },
      ]);
    } catch (err) {
      errors.push(`${item.appointment.id}/${item.kind}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { due: due.length, sent, errors };
};

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      run(env).then(
        (r) => console.log('follow-ups', JSON.stringify(r)),
        (err) => console.error('follow-ups failed', err)
      )
    );
  },
  // No public endpoint.
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
};
