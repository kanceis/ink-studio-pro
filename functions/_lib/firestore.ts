/**
 * Minimal Firestore REST client for Pages Functions, acting as the studio's
 * service account (bypasses security rules). Used only by the shop checkout
 * and the Stripe webhook, which must change stock and write orders.
 */
import { Env } from './auth';

type Value =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: Value[] } }
  | { mapValue: { fields?: Record<string, Value> } };

export type Fields = Record<string, Value>;

export interface FsDoc {
  name: string;
  fields: Fields;
  updateTime: string;
}

export const toValue = (v: unknown): Value => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
  return { stringValue: String(v) };
};

export const toFields = (obj: Record<string, unknown>): Fields =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toValue(v)]));

export const fromValue = (v: Value | undefined): unknown => {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return undefined;
};

export const fromFields = (fields: Fields = {}): Record<string, unknown> =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromValue(v)]));

// ------------------------------------------------------------------ auth

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let cachedToken: { token: string; exp: number } | null = null;

/** OAuth access token for the service account in GOOGLE_SERVICE_ACCOUNT (JSON key). */
const serviceAccountToken = async (env: Env): Promise<string> => {
  if (env.FIRESTORE_EMULATOR_HOST) return 'owner'; // the emulator accepts "Bearer owner" as admin
  if (cachedToken && cachedToken.exp - 60 > Date.now() / 1000) return cachedToken.token;
  if (!env.GOOGLE_SERVICE_ACCOUNT) throw new Error('GOOGLE_SERVICE_ACCOUNT is not configured');

  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const jwt = `${header}.${claims}.${b64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Google token error ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
};

// ------------------------------------------------------------------ REST

const base = (env: Env) =>
  `${(env.FIRESTORE_EMULATOR_HOST || 'https://firestore.googleapis.com').replace(/\/$/, '')}/v1`;

export const dbPath = (env: Env) =>
  `projects/${env.FIREBASE_PROJECT_ID}/databases/${env.FIRESTORE_DATABASE_ID || '(default)'}/documents`;

export const studioDocName = (env: Env, ...segments: string[]) =>
  [dbPath(env), 'studios', env.STUDIO_ID || 'main', ...segments].join('/');

const call = async (env: Env, path: string, init: RequestInit = {}) => {
  const token = await serviceAccountToken(env);
  return fetch(`${base(env)}/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
};

export const getDoc = async (env: Env, name: string): Promise<FsDoc | null> => {
  const res = await call(env, name);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore get ${res.status}: ${await res.text()}`);
  return (await res.json()) as FsDoc;
};

export type Write =
  | { update: { name: string; fields: Fields }; updateMask?: { fieldPaths: string[] }; currentDocument?: { exists?: boolean; updateTime?: string } }
  | { delete: string; currentDocument?: { exists?: boolean } };

/** Atomic multi-document write. Returns false when a precondition failed (someone changed the doc). */
export const commit = async (env: Env, writes: Write[]): Promise<boolean> => {
  const res = await call(env, `${dbPath(env)}:commit`, { method: 'POST', body: JSON.stringify({ writes }) });
  if (res.ok) return true;
  const text = await res.text();
  if (/FAILED_PRECONDITION|ABORTED|ALREADY_EXISTS|NOT_FOUND/.test(text)) return false;
  throw new Error(`Firestore commit ${res.status}: ${text}`);
};
