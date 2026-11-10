/** Rules for the messages after a session (src/services/followUps.ts). Run: npm run test:unit */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dueFollowUps, generateFollowUpMessage, todayInStudio } from '../src/services/followUps';
import type { Appointment, Client } from '../src/types';

const appt = (over: Partial<Appointment>): Appointment =>
  ({
    id: 'a1', clientId: 'c1', clientName: 'Ana Silva', clientPhone: '912345678', clientEmail: 'ana@example.com',
    artistId: 'x', artistName: 'Arants', title: '', date: '2026-11-01', startTime: '10:00', endTime: '12:00',
    durationMinutes: 120, price: 100, deposit: 20, status: 'completed', placement: '', style: '',
    confirmationSent: true, reminder24hSent: true, ...over,
  }) as Appointment;
const client = (over: Partial<Client> = {}): Client =>
  ({ id: 'c1', name: 'Ana Silva', email: 'ana@example.com', phone: '912345678', birthDate: '', references: [], createdAt: '', clinicalHistory: {} as Client['clinicalHistory'], ...over }) as Client;

const kinds = (appts: Appointment[], clients: Client[], today: string) => dueFollowUps(appts, clients, today).map((d) => d.kind);

test('one week, two weeks, nothing in between', () => {
  const a = [appt({})];
  assert.deepEqual(kinds(a, [client()], '2026-11-07'), []);
  assert.deepEqual(kinds(a, [client()], '2026-11-08'), ['d7']);
  assert.deepEqual(kinds(a, [client()], '2026-11-15'), ['d14']);
});

test('only completed sessions', () => {
  assert.deepEqual(kinds([appt({ status: 'confirmed' })], [client()], '2026-11-08'), []);
});

test('sent or skipped ones leave the list', () => {
  const a = [appt({ followUps: { d7: { at: 'x', via: 'skipped' } } })];
  assert.deepEqual(kinds(a, [client()], '2026-11-09'), []);
  assert.deepEqual(kinds(a, [client()], '2026-11-15'), ['d14']);
});

test('2–3 months only with consent and no later session', () => {
  const day = addDays('2026-11-01', 75);
  assert.deepEqual(kinds([appt({})], [client()], day), []);
  assert.deepEqual(kinds([appt({})], [client({ marketingConsentAt: '2026-10-01' })], day), ['m3']);
  const later = appt({ id: 'a2', date: '2026-12-20', status: 'confirmed' });
  assert.deepEqual(kinds([appt({}), later], [client({ marketingConsentAt: '2026-10-01' })], day), []);
});

test('nothing for a client who asked to stop', () => {
  assert.deepEqual(kinds([appt({})], [client({ followUpOptOutAt: '2026-11-02' })], '2026-11-08'), []);
});

test('a second session before the due date replaces the first one', () => {
  const second = appt({ id: 'a2', date: '2026-11-05' });
  const due = dueFollowUps([appt({}), second], [client()], '2026-11-12');
  assert.deepEqual(due.map((d) => [d.appointment.id, d.kind]), [['a2', 'd7']]);
});

test('too late is dropped', () => {
  assert.deepEqual(kinds([appt({})], [client()], '2026-12-01'), []);
});

test('messages in Portuguese and English', () => {
  const pt = generateFollowUpMessage('d7', appt({}), { name: 'Ink Compatível', instagram: 'inkcompativel' });
  assert.match(pt.text, /^Olá Ana! Passou uma semana desde a tua sessão com Arants/);
  const en = generateFollowUpMessage('d14', appt({}), { name: 'Ink Compatível', instagram: '@inkcompativel', googleReviewUrl: 'https://g.page/r/x/review' }, 'en');
  assert.match(en.text, /tag @inkcompativel/);
  assert.match(en.html, /<a href="https:\/\/g.page\/r\/x\/review"/);
  const m3 = generateFollowUpMessage('m3', appt({ clientName: '<b>' }), { name: 'Ink', instagram: '' });
  assert.ok(!m3.html.includes('<b>'));
});

test('today is in Lisbon time', () => {
  assert.equal(todayInStudio(new Date('2026-07-01T23:30:00Z')), '2026-07-02');
});
