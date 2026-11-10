/**
 * GET /api/voucher?session_id=cs_…  (called by the site's thank-you page)
 * Returns the gift voucher codes bought in that Stripe Checkout session, so the buyer can print them.
 * The session id is only known to whoever came back from the payment page. While the Stripe webhook
 * has not recorded the order yet, answers 202 { pending: true } and the page asks again.
 */
import { Env, json, corsHeaders } from '../_lib/auth';
import { fromFields, getDoc, studioDocName } from '../_lib/firestore';
import type { VoucherDoc } from '../_lib/shop';

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) =>
  new Response(null, { status: 204, headers: corsHeaders(request, env) });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const cors = { ...corsHeaders(request, env), 'cache-control': 'no-store' };
  const sid = new URL(request.url).searchParams.get('session_id') || '';
  if (!/^cs_(test_|live_)?[A-Za-z0-9]{10,200}$/.test(sid)) return json({ error: 'bad_session' }, 400, cors);

  try {
    const order = await getDoc(env, studioDocName(env, 'orders', sid));
    if (!order) return json({ pending: true }, 202, cors);
    const { voucherCodes = [], lines = [] } = fromFields(order.fields) as { voucherCodes?: string[]; lines?: { kind?: string }[] };
    const vouchers = [];
    for (const code of voucherCodes.slice(0, 20)) {
      const doc = await getDoc(env, studioDocName(env, 'vouchers', code));
      if (!doc) continue;
      const v = fromFields(doc.fields) as unknown as VoucherDoc;
      vouchers.push({ code: v.code, amount: v.amount, recipientName: v.recipientName || null, message: v.message || null, expiresAt: v.expiresAt });
    }
    // physical: the order also has something to ship (the thank-you page then keeps its shipping note).
    return json({ vouchers, physical: lines.some((l) => l.kind !== 'voucher') }, 200, cors);
  } catch (err) {
    console.error('voucher: lookup failed', err);
    return json({ error: 'server_error' }, 500, cors);
  }
};
