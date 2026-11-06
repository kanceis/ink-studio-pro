/**
 * POST /api/stripe-webhook  (called by Stripe)
 * Events to enable on the endpoint: checkout.session.completed, checkout.session.expired,
 * checkout.session.async_payment_succeeded, checkout.session.async_payment_failed.
 */
import { Env, json } from '../_lib/auth';
import { finalizeReservation, releaseReservation } from '../_lib/shop';
import { verifyStripeSignature } from '../_lib/stripe';

interface Address {
  line1?: string | null;
  line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

interface CheckoutSession {
  id: string;
  payment_status?: 'paid' | 'unpaid' | 'no_payment_required';
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  customer_details?: { name?: string | null; email?: string | null; phone?: string | null; address?: Address | null } | null;
  shipping_cost?: { amount_total?: number | null } | null;
  collected_information?: { shipping_details?: { name?: string | null; address?: Address | null } | null } | null;
  shipping_details?: { name?: string | null; address?: Address | null } | null; // older API versions
}

const formatAddress = (name: string | null | undefined, a: Address | null | undefined) => {
  if (!a) return undefined;
  return [name, a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(' '), a.state, a.country]
    .filter((p) => p && String(p).trim())
    .join('\n');
};

const reservationId = (s: CheckoutSession) => s.metadata?.reservation_id || s.client_reference_id || '';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const payload = await request.text();
  if (!env.STRIPE_WEBHOOK_SECRET || !(await verifyStripeSignature(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: 'bad_signature' }, 400);
  }

  const event = JSON.parse(payload) as { type: string; data: { object: CheckoutSession } };
  const session = event.data?.object;
  const rid = session ? reservationId(session) : '';
  if (!rid || !/^[0-9a-f-]{36}$/.test(rid)) return json({ ignored: true });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        // Bank transfers etc. complete first with payment_status 'unpaid' and succeed later.
        if (session.payment_status === 'unpaid') return json({ pending: true });
        const shipping = session.collected_information?.shipping_details || session.shipping_details;
        const result = await finalizeReservation(env, rid, {
          sessionId: session.id,
          amountTotal: (session.amount_total || 0) / 100,
          shippingAmount: (session.shipping_cost?.amount_total || 0) / 100,
          currency: session.currency || 'eur',
          customerName: shipping?.name || session.customer_details?.name || undefined,
          customerEmail: session.customer_details?.email || undefined,
          customerPhone: session.customer_details?.phone || undefined,
          shippingAddress: formatAddress(shipping?.name, shipping?.address || session.customer_details?.address),
        });
        return json({ order: result });
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        await releaseReservation(env, rid);
        return json({ released: true });
      default:
        return json({ ignored: true });
    }
  } catch (err) {
    console.error(`stripe-webhook ${event.type} failed`, err);
    return json({ error: 'server_error' }, 500); // Stripe retries
  }
};
