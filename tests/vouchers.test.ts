/**
 * Gift vouchers against the Firestore emulator: checkout validation, codes created when Stripe confirms
 * the payment, and the thank-you page lookup (/api/voucher).
 * Run with the rules tests: npm run test:rules
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { toFields } from '../functions/_lib/firestore';
import { CheckoutError, finalizeReservation, reserveCart, VOUCHER_ID } from '../functions/_lib/shop';
import { onRequestGet } from '../functions/api/voucher';

const PROJECT = 'demo-ink-studio';
const HOST = `http://${process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'}`;
const STUDIO = 'vale-test';
const docs = `${HOST}/v1/projects/${PROJECT}/databases/(default)/documents/studios/${STUDIO}`;
const env = { FIREBASE_PROJECT_ID: PROJECT, STUDIO_ID: STUDIO, FIRESTORE_EMULATOR_HOST: HOST } as never;

const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${docs}/${path}`, {
    method: 'PATCH',
    headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  }).then((r) => assert.ok(r.ok, `seed ${path}`));
const get = async (path: string) => {
  const r = await fetch(`${docs}/${path}`, { headers: { authorization: 'Bearer owner' } });
  return r.status === 404 ? null : ((await r.json()) as { fields: Record<string, any> });
};

const paid = (sessionId: string) => ({
  sessionId, amountTotal: 0, shippingAmount: 0, currency: 'eur',
  customerName: 'Rui Costa', customerEmail: 'rui@example.com', customerPhone: '+351912345678',
});

const lookup = async (sid: string) => {
  const res = await onRequestGet({ request: new Request(`https://app.test/api/voucher?session_id=${encodeURIComponent(sid)}`), env } as never);
  return { status: res.status, body: (await res.json()) as any };
};

before(async () => {
  await put('shop/print', { kind: 'edition', title: 'Print', price: 45, shippingPrice: 6, stock: 3, editionSize: 30, status: 'available', published: true });
});

test('checkout refuses voucher values outside 20–500 € and whole euros only', async () => {
  for (const amount of [undefined, 19, 501, 50.5, '100abc']) {
    await assert.rejects(reserveCart(env, [{ id: VOUCHER_ID, qty: 1, amount } as never]), (e: unknown) => e instanceof CheckoutError && e.code === 'bad_amount');
  }
  await assert.rejects(reserveCart(env, [{ id: VOUCHER_ID, qty: 6, amount: 50 }]), (e: unknown) => e instanceof CheckoutError && e.code === 'bad_quantity');
});

test('a paid voucher-only order creates one code per voucher and needs no shipping', async () => {
  const { rid, lines } = await reserveCart(env, [
    { id: VOUCHER_ID, qty: 2, amount: 100, to: '  Ana\u0000 Silva ', message: `${'x'.repeat(300)}` },
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].kind, 'voucher');
  assert.equal(lines[0].recipientName, 'Ana Silva');
  assert.equal(lines[0].message?.length, 240);

  const sid = `cs_test_vouchersOnly${Date.now()}`;
  assert.equal((await lookup(sid)).status, 202); // webhook not in yet
  assert.equal(await finalizeReservation(env, rid, paid(sid)), 'created');
  assert.equal(await finalizeReservation(env, rid, paid(sid)), 'duplicate');

  const order = (await get(`orders/${sid}`))!.fields;
  assert.equal(order.status.stringValue, 'shipped');
  const codes = order.voucherCodes.arrayValue.values.map((v: any) => v.stringValue);
  assert.equal(codes.length, 2);
  assert.notEqual(codes[0], codes[1]);
  for (const code of codes) {
    assert.match(code, /^INK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    const v = (await get(`vouchers/${code}`))!.fields;
    assert.equal(v.amount.integerValue, '100');
    assert.equal(v.balance.integerValue, '100');
    assert.equal(v.status.stringValue, 'active');
    assert.equal(v.buyerEmail.stringValue, 'rui@example.com');
    const months = (new Date(v.expiresAt.stringValue).getTime() - Date.now()) / (30.44 * 864e5);
    assert.ok(months > 11.5 && months < 12.5, `expires in ~12 months (${months})`);
  }

  const { status, body } = await lookup(sid);
  assert.equal(status, 200);
  assert.deepEqual(body.vouchers.map((v: any) => v.code).sort(), [...codes].sort());
  assert.equal(body.physical, false);
  assert.equal(body.vouchers[0].recipientName, 'Ana Silva');
  assert.equal(body.vouchers[0].amount, 100);
});

test('a voucher bought with a print keeps the order to ship and takes the print out of stock', async () => {
  const { rid, lines } = await reserveCart(env, [{ id: 'print', qty: 1 }, { id: VOUCHER_ID, qty: 1, amount: 50 }]);
  assert.deepEqual(lines.map((l) => l.kind).sort(), ['edition', 'voucher']);
  assert.equal((await get('shop/print'))!.fields.stock.integerValue, '2');
  const sid = `cs_test_mixedOrder${Date.now()}`;
  assert.equal(await finalizeReservation(env, rid, paid(sid)), 'created');
  const order = (await get(`orders/${sid}`))!.fields;
  assert.equal(order.status.stringValue, 'paid');
  assert.equal(order.voucherCodes.arrayValue.values.length, 1);
  assert.equal((await lookup(sid)).body.physical, true);
});

test('the lookup refuses anything that is not a Checkout session id', async () => {
  for (const sid of ['', 'abc', 'cs_test_../../x', `cs_${'a'.repeat(300)}`]) assert.equal((await lookup(sid)).status, 400);
});
