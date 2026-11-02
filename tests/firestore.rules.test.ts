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
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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
