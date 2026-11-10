/** Tiny Stripe REST helpers (no SDK, works on Cloudflare's runtime). */
import { Env } from './auth';
import { ReservedLine, RESERVATION_MINUTES } from './shop';

const apiBase = (env: Env) => (env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/$/, '');

/** Flattens nested params the way Stripe expects: line_items[0][price_data][currency]=eur */
const encode = (obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()) => {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) value.forEach((v, i) => (typeof v === 'object' ? encode(v as Record<string, unknown>, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(v))));
    else if (typeof value === 'object') encode(value as Record<string, unknown>, name, out);
    else out.append(name, String(value));
  }
  return out;
};

const cents = (eur: number) => Math.round(eur * 100);

export const createCheckoutSession = async (
  env: Env,
  opts: { rid: string; lines: ReservedLine[]; successUrl: string; cancelUrl: string }
): Promise<{ id: string; url: string }> => {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  // One shipping charge per order: the highest shipping price in the cart.
  const shipping = Math.max(0, ...opts.lines.map((l) => l.shippingPrice || 0));
  // Gift vouchers are digital: no address to ask for when the cart has nothing else.
  const physical = opts.lines.some((l) => l.kind !== 'voucher');
  const countries = (env.SHIPPING_COUNTRIES || 'PT,ES,FR,DE,IT,NL,BE,GB,IE')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  const params = encode({
    mode: 'payment',
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    client_reference_id: opts.rid,
    expires_at: Math.floor(Date.now() / 1000) + (RESERVATION_MINUTES - 1) * 60,
    locale: 'pt',
    phone_number_collection: { enabled: true },
    ...(physical
      ? {
          shipping_address_collection: { allowed_countries: countries },
          shipping_options: [
            {
              shipping_rate_data: {
                type: 'fixed_amount',
                display_name: shipping > 0 ? 'Envio' : 'Envio grátis',
                fixed_amount: { amount: cents(shipping), currency: 'eur' },
              },
            },
          ],
        }
      : {}),
    metadata: { reservation_id: opts.rid },
    payment_intent_data: { metadata: { reservation_id: opts.rid } },
    line_items: opts.lines.map((l) => ({
      quantity: l.quantity,
      price_data: {
        currency: 'eur',
        unit_amount: cents(l.unitPrice),
        product_data: {
          name: l.kind === 'voucher' ? `Vale de oferta Ink Compatível · ${l.unitPrice} €` : l.kind === 'edition' ? `${l.title} (edição limitada)` : `${l.title} (original)`,
          ...(l.imageUrl && /^https:\/\//.test(l.imageUrl) ? { images: [l.imageUrl] } : {}),
        },
      },
    })),
  });

  const res = await fetch(`${apiBase(env)}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': opts.rid,
    },
    body: params,
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`);
  const session = (await res.json()) as { id: string; url: string };
  return { id: session.id, url: session.url };
};

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Verifies the Stripe-Signature header (HMAC-SHA256, 5 minute tolerance). */
export const verifyStripeSignature = async (payload: string, header: string | null, secret: string): Promise<boolean> => {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  );
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const signatures = header
    .split(',')
    .filter((p) => p.trim().startsWith('v1='))
    .map((p) => p.trim().slice(3));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  // constant-time-ish comparison
  return signatures.some((sig) => sig.length === expected.length && [...sig].reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
};
