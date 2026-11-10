/**
 * Shared helpers for the Cloudflare Pages Functions that store website photos in R2.
 *
 * Who may upload: we don't verify Firebase tokens ourselves. We forward the caller's
 * Firebase ID token to Firestore and try to read studios/{STUDIO_ID}. Firestore's rules
 * only allow that read for studio members, so a 200 means "member", anything else means no.
 */
export interface Env {
  IMAGES: R2Bucket;
  FIREBASE_PROJECT_ID: string;
  FIRESTORE_DATABASE_ID?: string;
  STUDIO_ID?: string;
  /** Only for local development against the Firestore emulator, e.g. http://127.0.0.1:8080 */
  FIRESTORE_EMULATOR_HOST?: string;
  /** Comma-separated origins allowed to call the API (the app's own origin is always allowed). */
  ALLOWED_ORIGINS?: string;
  /** Service account JSON key with Firestore access (secret). Needed for checkout and the Stripe webhook. */
  GOOGLE_SERVICE_ACCOUNT?: string;
  /** Stripe secret key, sk_live_... or sk_test_... (secret). */
  STRIPE_SECRET_KEY?: string;
  /** Signing secret of the Stripe webhook endpoint, whsec_... (secret). */
  STRIPE_WEBHOOK_SECRET?: string;
  /** Only for tests: a mock Stripe API base URL. */
  STRIPE_API_BASE?: string;
  /** Countries Stripe asks a shipping address for, comma separated (default PT,ES,FR,DE,IT,NL,BE,GB,IE). */
  SHIPPING_COUNTRIES?: string;
  /** Places API (New) key, restricted to that API (secret). Shows the Google reviews on the site. */
  GOOGLE_PLACES_API_KEY?: string;
  /** The studio's Google place ID, e.g. ChIJ... */
  GOOGLE_PLACE_ID?: string;
  /** Only for tests: a mock Places API base URL. */
  PLACES_API_BASE?: string;
  /** Only for local development: "1" serves placeholder reviews when the Places key is not set. */
  REVIEWS_DEMO?: string;
  /** Months a gift voucher is valid for (default 12). */
  VOUCHER_VALID_MONTHS?: string;
}

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

export const corsHeaders = (request: Request, env: Env): HeadersInit => {
  const origin = request.headers.get('origin');
  if (!origin) return {};
  const self = new URL(request.url).origin;
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origin !== self && !allowed.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
};

export const isStudioMember = async (request: Request, env: Env): Promise<boolean> => {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return false;

  const base = env.FIRESTORE_EMULATOR_HOST
    ? `${env.FIRESTORE_EMULATOR_HOST.replace(/\/$/, '')}/v1`
    : 'https://firestore.googleapis.com/v1';
  const database = encodeURIComponent(env.FIRESTORE_DATABASE_ID || '(default)');
  const studio = encodeURIComponent(env.STUDIO_ID || 'main');
  const url = `${base}/projects/${env.FIREBASE_PROJECT_ID}/databases/${database}/documents/studios/${studio}?mask.fieldPaths=name`;

  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  return res.ok;
};
