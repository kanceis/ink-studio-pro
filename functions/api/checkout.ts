/**
 * POST /api/checkout  (called by the public site's cart)
 * Body: { items: [{ id, qty }], successUrl, cancelUrl }
 * Reserves the stock, opens a Stripe Checkout session and returns { url } to redirect to.
 * Merch is not sold here (it links out to the print-on-demand store).
 */
import { Env, json, corsHeaders } from '../_lib/auth';
import { CheckoutError, releaseReservation, reserveCart } from '../_lib/shop';
import { createCheckoutSession } from '../_lib/stripe';

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) =>
  new Response(null, { status: 204, headers: corsHeaders(request, env) });

/** Return URLs must point at the app itself or at one of ALLOWED_ORIGINS (no open redirects). */
const safeUrl = (value: unknown, request: Request, env: Env): string | null => {
  if (typeof value !== 'string') return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const allowed = new Set([
    new URL(request.url).origin,
    ...(env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  ]);
  return allowed.has(url.origin) ? url.toString() : null;
};

const STATUS: Record<string, number> = {
  empty_cart: 400,
  bad_item: 400,
  bad_quantity: 400,
  not_found: 404,
  not_for_sale: 409,
  sold_out: 409,
  busy: 503,
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const cors = corsHeaders(request, env);
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'shop_closed' }, 503, cors);

  let body: { items?: unknown; successUrl?: unknown; cancelUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400, cors);
  }
  const successUrl = safeUrl(body.successUrl, request, env);
  const cancelUrl = safeUrl(body.cancelUrl, request, env);
  if (!successUrl || !cancelUrl) return json({ error: 'bad_return_url' }, 400, cors);

  let reservation: Awaited<ReturnType<typeof reserveCart>>;
  try {
    reservation = await reserveCart(env, body.items as never);
  } catch (err) {
    if (err instanceof CheckoutError) return json({ error: err.code, itemId: err.itemId }, STATUS[err.code] || 400, cors);
    console.error('checkout: reserve failed', err);
    return json({ error: 'server_error' }, 500, cors);
  }

  try {
    const session = await createCheckoutSession(env, {
      rid: reservation.rid,
      lines: reservation.lines,
      successUrl: successUrl.includes('{CHECKOUT_SESSION_ID}')
        ? successUrl
        : `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl,
    });
    return json({ url: session.url }, 200, cors);
  } catch (err) {
    console.error('checkout: stripe failed', err);
    await releaseReservation(env, reservation.rid).catch((e) => console.error('checkout: release failed', e));
    return json({ error: 'payment_unavailable' }, 502, cors);
  }
};
