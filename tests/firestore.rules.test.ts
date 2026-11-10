/**
 * Firestore security rules tests. Run with: npm run test:rules
 * (starts the Firestore emulator; needs Java installed).
 */
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;

const member = { email: 'miguel@example.com', email_verified: true };
const stranger = { email: 'someone@example.com', email_verified: true };

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ink-studio',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'studios/main'), { name: 'ARANT', members: ['miguel@example.com'] });
    await setDoc(doc(db, 'studios/main/inventory/inv-1'), { name: 'Agulhas 3RL', quantity: 10 });
    await setDoc(doc(db, 'studios/main/meta/public'), { name: 'ARANT' });
    await setDoc(doc(db, 'studios/main/meta/settings'), { whatsappPhoneNumber: '+351 900 000 000' });
    await setDoc(doc(db, 'studios/main/portfolio/p-pub'), { title: 'Gorila', published: true });
    await setDoc(doc(db, 'studios/main/portfolio/p-draft'), { title: 'Rascunho', published: false });
    await setDoc(doc(db, 'studios/main/shop/a-pub'), { title: 'Tela', published: true, price: 300 });
    await setDoc(doc(db, 'studios/main/bookingRequests/b-1'), { name: 'Ana', status: 'new' });
  });
});

after(async () => {
  await env.cleanup();
});

test('a member can read and write stock', async () => {
  const db = env.authenticatedContext('u1', member).firestore();
  await assertSucceeds(getDoc(doc(db, 'studios/main/inventory/inv-1')));
  await assertSucceeds(updateDoc(doc(db, 'studios/main/inventory/inv-1'), { quantity: 9 }));
  await assertSucceeds(setDoc(doc(db, 'studios/main/clients/c-1'), { name: 'Cliente' }));
});

test('member email matching ignores case', async () => {
  const db = env.authenticatedContext('u1', { email: 'Miguel@Example.com', email_verified: true }).firestore();
  await assertSucceeds(getDoc(doc(db, 'studios/main/inventory/inv-1')));
});

test('a member cannot change the member list', async () => {
  const db = env.authenticatedContext('u1', member).firestore();
  await assertSucceeds(getDoc(doc(db, 'studios/main')));
  await assertFails(updateDoc(doc(db, 'studios/main'), { members: ['miguel@example.com', 'x@example.com'] }));
});

test('a signed-in non-member gets nothing', async () => {
  const db = env.authenticatedContext('u2', stranger).firestore();
  await assertFails(getDoc(doc(db, 'studios/main')));
  await assertFails(getDoc(doc(db, 'studios/main/inventory/inv-1')));
  await assertFails(setDoc(doc(db, 'studios/main/inventory/inv-2'), { name: 'x' }));
});

test('an unverified email is refused', async () => {
  const db = env.authenticatedContext('u3', { email: 'miguel@example.com', email_verified: false }).firestore();
  await assertFails(getDoc(doc(db, 'studios/main/inventory/inv-1')));
});

test('anonymous visitors get nothing', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'studios/main/clients/c-1')));
});

test('no access to a studio that has not been set up', async () => {
  const db = env.authenticatedContext('u1', member).firestore();
  await assertFails(getDoc(doc(db, 'studios/other/inventory/inv-1')));
});

// ---------------------------------------------------------------------------
// Public website access
// ---------------------------------------------------------------------------

const validBooking = () => ({
  name: 'Ana Silva',
  email: 'ana@example.com',
  phone: '+351 912 000 000',
  idea: 'Um lobo em sketch black & red no antebraço',
  placement: 'Antebraço',
  artistId: 'artist-1',
  artistName: 'Arants',
  tattooType: 'Desenho novo',
  firstTattoo: true,
  status: 'new',
  createdAt: new Date().toISOString(),
  adultConfirmedAt: new Date().toISOString(),
  privacyAcceptedAt: new Date().toISOString(),
});

test('anyone can read the public studio profile, but not private settings', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, 'studios/main/meta/public')));
  await assertFails(getDoc(doc(db, 'studios/main/meta/settings')));
});

test('anyone can list published portfolio and artworks, never drafts', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(query(collection(db, 'studios/main/portfolio'), where('published', '==', true))));
  await assertSucceeds(getDocs(query(collection(db, 'studios/main/shop'), where('published', '==', true))));
  await assertSucceeds(getDoc(doc(db, 'studios/main/portfolio/p-pub')));
  await assertFails(getDoc(doc(db, 'studios/main/portfolio/p-draft')));
  await assertFails(getDocs(collection(db, 'studios/main/portfolio')));
});

test('visitors cannot change site content', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(updateDoc(doc(db, 'studios/main/portfolio/p-pub'), { title: 'x' }));
  await assertFails(setDoc(doc(db, 'studios/main/shop/a-new'), { title: 'x', published: true }));
  await assertFails(updateDoc(doc(db, 'studios/main/meta/public'), { name: 'x' }));
});

test('a visitor can send a well-formed booking request', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(db, 'studios/main/bookingRequests/b-new'), validBooking()));
  // From the English site
  await assertSucceeds(setDoc(doc(db, 'studios/main/bookingRequests/b-en'), { ...validBooking(), language: 'en' }));
  // Agreed to hear from the studio later on
  await assertSucceeds(setDoc(doc(db, 'studios/main/bookingRequests/b-news'), { ...validBooking(), marketingConsentAt: new Date().toISOString() }));
});

test('malformed or tampered booking requests are refused', async () => {
  const db = env.unauthenticatedContext().firestore();
  const ref = doc(db, 'studios/main/bookingRequests/b-bad');
  await assertFails(setDoc(ref, { ...validBooking(), status: 'accepted' }));
  await assertFails(setDoc(ref, { ...validBooking(), email: 'not-an-email' }));
  await assertFails(setDoc(ref, { ...validBooking(), idea: '' }));
  await assertFails(setDoc(ref, { ...validBooking(), idea: 'x'.repeat(4001) }));
  await assertFails(setDoc(ref, { ...validBooking(), clientId: 'client-1' }));
  const { phone: _omit, ...noPhone } = validBooking();
  await assertFails(setDoc(ref, noPhone));
  const { adultConfirmedAt: _a, ...noAdult } = validBooking();
  await assertFails(setDoc(ref, noAdult));
  const { privacyAcceptedAt: _p, ...noPrivacy } = validBooking();
  await assertFails(setDoc(ref, noPrivacy));
  await assertFails(setDoc(ref, { ...validBooking(), firstTattoo: 'sim' }));
  await assertFails(setDoc(ref, { ...validBooking(), language: 'fr' }));
  await assertFails(setDoc(ref, { ...validBooking(), marketingConsentAt: true }));
});

test('visitors cannot read, edit or delete booking requests', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'studios/main/bookingRequests/b-1')));
  await assertFails(getDocs(collection(db, 'studios/main/bookingRequests')));
  await assertFails(updateDoc(doc(db, 'studios/main/bookingRequests/b-1'), { status: 'accepted' }));
  await assertFails(deleteDoc(doc(db, 'studios/main/bookingRequests/b-1')));
});

test('visitors cannot read or create shop orders', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(db, 'studios/main/orders')));
  await assertFails(setDoc(doc(db, 'studios/main/orders/cs_test'), { itemId: 'x', status: 'paid' }));
});

test('members manage site content and booking requests', async () => {
  const db = env.authenticatedContext('u1', member).firestore();
  await assertSucceeds(getDocs(collection(db, 'studios/main/portfolio')));
  await assertSucceeds(getDoc(doc(db, 'studios/main/portfolio/p-draft')));
  await assertSucceeds(updateDoc(doc(db, 'studios/main/portfolio/p-draft'), { published: true }));
  await assertSucceeds(updateDoc(doc(db, 'studios/main/meta/public'), { name: 'ARANT Tattoo' }));
  await assertSucceeds(getDocs(collection(db, 'studios/main/bookingRequests')));
  await assertSucceeds(updateDoc(doc(db, 'studios/main/bookingRequests/b-1'), { status: 'accepted' }));
  await assertSucceeds(getDocs(collection(db, 'studios/main/orders')));
});
