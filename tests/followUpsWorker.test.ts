/**
 * The daily follow-up Worker against the Firestore emulator and a fake Resend.
 * Run with the rules tests: npm run test:rules
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, Server } from 'node:http';
import { run } from '../workers/follow-ups/index';
import { toFields } from '../functions/_lib/firestore';

const PROJECT = 'demo-ink-studio';
const HOST = `http://${process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'}`;
const STUDIO = 'fu-test';
const docs = `${HOST}/v1/projects/${PROJECT}/databases/(default)/documents/studios/${STUDIO}`;

const sentMail: { to: string[]; subject: string; text: string; key: string | undefined }[] = [];
let server: Server;
let resendBase = '';

const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${docs}/${path}`, {
    method: 'PATCH',
    headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  }).then((r) => assert.ok(r.ok, `seed ${path}`));
const get = (path: string) =>
  fetch(`${docs}/${path}`, { headers: { authorization: 'Bearer owner' } }).then((r) => r.json() as Promise<{ fields: Record<string, any> }>);

const env = () => ({
  FIREBASE_PROJECT_ID: PROJECT,
  STUDIO_ID: STUDIO,
  FIRESTORE_EMULATOR_HOST: HOST,
  RESEND_API_KEY: 're_test',
  RESEND_API_BASE: resendBase,
  MAIL_FROM: 'Ink Compatível <geral@inkcompativel.pt>',
  MAIL_REPLY_TO: 'geral@inkcompativel.pt',
});

const appt = (id: string, clientId: string, date: string, extra: Record<string, unknown> = {}) => ({
  id, clientId, clientName: 'Ana Silva', clientPhone: '912345678', clientEmail: 'ana@example.com',
  artistId: 'x', artistName: 'Arants', title: 'Rosa', date, startTime: '10:00', endTime: '12:00',
  durationMinutes: 120, price: 100, deposit: 20, status: 'completed', placement: 'braço', style: 'sketch',
  confirmationSent: true, reminder24hSent: true, ...extra,
});

before(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const j = JSON.parse(body);
      sentMail.push({ to: j.to, subject: j.subject, text: j.text, key: req.headers['idempotency-key'] as string });
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"id":"x"}');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  resendBase = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;

  await put('meta/settings', { name: 'Ink Compatível', instagram: '@inkcompativel', followUpAutoEmail: true });
  await put('clients/c1', { id: 'c1', name: 'Ana Silva', email: 'ana@example.com', phone: '912345678' });
  await put('clients/c2', { id: 'c2', name: 'Bruno Costa', email: '', phone: '913333333', language: 'en' });
  // Ana: one week ago → d7 by email. Bruno: no email → stays for WhatsApp.
  await put('appointments/a1', appt('a1', 'c1', '2026-11-03'));
  await put('appointments/a2', appt('a2', 'c2', '2026-11-03', { clientName: 'Bruno Costa', clientEmail: '' }));
});

after(() => server.close());

test('emails what is due, marks it, logs it, and does not send twice', async () => {
  const now = new Date('2026-11-10T09:00:00Z');
  const r1 = await run(env(), now);
  assert.deepEqual({ due: r1.due, sent: r1.sent, errors: r1.errors }, { due: 2, sent: 1, errors: [] });
  assert.equal(sentMail.length, 1);
  assert.deepEqual(sentMail[0].to, ['ana@example.com']);
  assert.equal(sentMail[0].key, 'follow-up:a1:d7');
  assert.match(sentMail[0].text, /^Olá Ana! Passou uma semana/);

  const a1 = await get('appointments/a1');
  assert.equal(a1.fields.followUps.mapValue.fields.d7.mapValue.fields.via.stringValue, 'auto_email');
  assert.equal(a1.fields.title.stringValue, 'Rosa', 'the rest of the appointment is untouched');

  const r2 = await run(env(), now);
  assert.equal(r2.sent, 0);
  assert.equal(sentMail.length, 1);
});

test('does nothing when turned off in the app', async () => {
  await put('meta/settings', { name: 'Ink Compatível', followUpAutoEmail: false });
  const r = await run(env(), new Date('2026-11-17T09:00:00Z'));
  assert.deepEqual(r, { skipped: 'turned off in the app' });
});
