import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  writeBatch,
  increment,
  runTransaction,
  Firestore,
  Unsubscribe,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { firebaseApp, FIRESTORE_DATABASE_ID, STUDIO_ID, USE_EMULATORS } from './firebaseApp';
import {
  Artist,
  Client,
  Appointment,
  InventoryItem,
  NotificationLog,
  StudioSettings,
  PortfolioItem,
  ShopItem,
  ShopOrder,
  BookingRequest,
  PublicProfile,
  Voucher,
} from '../types';

/**
 * Shared, persistent storage for the studio, backed by Cloud Firestore.
 *
 * Layout:
 *   studios/{studioId}                      -> { name, members: [emails] }  (created by hand, see README)
 *   studios/{studioId}/meta/settings        -> StudioSettings
 *   studios/{studioId}/artists/{id}         -> Artist
 *   studios/{studioId}/clients/{id}         -> Client
 *   studios/{studioId}/appointments/{id}    -> Appointment
 *   studios/{studioId}/inventory/{id}       -> InventoryItem
 *   studios/{studioId}/notifications/{id}   -> NotificationLog
 *
 * Website backoffice (partly public, see firestore.rules):
 *   studios/{studioId}/meta/public          -> PublicProfile   (public)
 *   studios/{studioId}/portfolio/{id}       -> PortfolioItem   (public when published)
 *   studios/{studioId}/shop/{id}            -> ShopItem        (public when published)
 *   studios/{studioId}/orders/{id}          -> ShopOrder       (written by the Stripe webhook)
 *   studios/{studioId}/bookingRequests/{id} -> BookingRequest  (anyone can create)
 *
 * The persistent local cache keeps the app usable offline; writes are queued
 * and synced when the device is back online.
 */
export const db: Firestore = initializeFirestore(
  firebaseApp,
  {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  },
  FIRESTORE_DATABASE_ID
);
if (USE_EMULATORS) connectFirestoreEmulator(db, '127.0.0.1', 8080);

export type CollectionName =
  | 'artists'
  | 'clients'
  | 'appointments'
  | 'inventory'
  | 'notifications'
  | 'portfolio'
  | 'shop'
  | 'orders'
  | 'vouchers'
  | 'bookingRequests';

type EntityMap = {
  artists: Artist;
  clients: Client;
  appointments: Appointment;
  inventory: InventoryItem;
  notifications: NotificationLog;
  portfolio: PortfolioItem;
  shop: ShopItem;
  orders: ShopOrder;
  vouchers: Voucher;
  bookingRequests: BookingRequest;
};

const studioRef = () => doc(db, 'studios', STUDIO_ID);
const colRef = (name: CollectionName) => collection(db, 'studios', STUDIO_ID, name);
const itemRef = (name: CollectionName, id: string) => doc(db, 'studios', STUDIO_ID, name, id);
const settingsRef = () => doc(db, 'studios', STUDIO_ID, 'meta', 'settings');
const publicProfileRef = () => doc(db, 'studios', STUDIO_ID, 'meta', 'public');

export const subscribePublicProfile = (
  onData: (profile: Partial<PublicProfile> | null) => void,
  onError: (err: Error) => void
): Unsubscribe =>
  onSnapshot(
    publicProfileRef(),
    (snap) => onData(snap.exists() ? (snap.data() as Partial<PublicProfile>) : null),
    onError
  );

export const savePublicProfile = (profile: Partial<PublicProfile>) =>
  setDoc(publicProfileRef(), profile, { merge: true });

/** Collision-safe id with a readable prefix, e.g. "inv-1730563200000-3f9a1c". */
export const newId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Checks whether the signed-in user is listed in studios/{studioId}.members.
 * Firestore rules deny the read for anyone else, which we report as "denied".
 */
export const checkStudioAccess = async (): Promise<'granted' | 'denied' | 'missing'> => {
  try {
    const snap = await getDoc(studioRef());
    return snap.exists() ? 'granted' : 'missing';
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'permission-denied') return 'denied';
    throw err;
  }
};

export const subscribeCollection = <K extends CollectionName>(
  name: K,
  onData: (items: EntityMap[K][]) => void,
  onError: (err: Error) => void
): Unsubscribe =>
  onSnapshot(
    colRef(name),
    (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as EntityMap[K]), id: d.id }))),
    onError
  );

export const subscribeSettings = (
  onData: (settings: StudioSettings | null) => void,
  onError: (err: Error) => void
): Unsubscribe =>
  onSnapshot(
    settingsRef(),
    (snap) => onData(snap.exists() ? (snap.data() as StudioSettings) : null),
    onError
  );

export const saveItem = <K extends CollectionName>(name: K, item: EntityMap[K]) =>
  setDoc(itemRef(name, item.id), item);

export const patchItem = <K extends CollectionName>(
  name: K,
  id: string,
  updates: Partial<EntityMap[K]>
) => updateDoc(itemRef(name, id), updates as Record<string, unknown>);

export const removeItem = (name: CollectionName, id: string) => deleteDoc(itemRef(name, id));

/**
 * Takes `amount` euros off a gift voucher in one transaction, so two devices can't spend the same balance.
 * Resolves with the new balance; rejects with Error('not_found' | 'not_active' | 'too_much').
 */
export const redeemVoucher = (code: string, amount: number, note?: string) =>
  runTransaction(db, async (tx) => {
    const ref = itemRef('vouchers', code);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('not_found');
    const v = snap.data() as Voucher;
    if (v.status !== 'active') throw new Error('not_active');
    const cents = Math.round(amount * 100);
    const left = Math.round((v.balance || 0) * 100);
    if (cents <= 0 || cents > left) throw new Error('too_much');
    const balance = (left - cents) / 100;
    const redemption = { at: new Date().toISOString(), amount: cents / 100, ...(note ? { note } : {}) };
    tx.update(ref, {
      balance,
      status: balance === 0 ? 'used' : 'active',
      redemptions: [...(v.redemptions || []), redemption],
    });
    return balance;
  });

/** Codes like INK-7KQ2-M9XD (no 0/O/1/I), the same shape the site's checkout creates. */
export const newVoucherCode = () => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const c = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => abc[b % abc.length]).join('');
  return `INK-${c.slice(0, 4)}-${c.slice(4)}`;
};

/** Atomic stock change, so two devices adjusting at once don't overwrite each other. */
export const incrementStock = (id: string, delta: number) =>
  updateDoc(itemRef('inventory', id), { quantity: increment(delta) });

/** Atomic numeric change on any document field. */
export const incrementField = (name: CollectionName, id: string, field: string, delta: number) =>
  updateDoc(itemRef(name, id), { [field]: increment(delta) });

export const saveSettings = (settings: Partial<StudioSettings>) =>
  setDoc(settingsRef(), settings, { merge: true });

/** Writes many docs at once (Firestore batches are capped at 500 operations). */
export const batchWrite = async (
  ops: { type: 'set' | 'update' | 'delete'; name: CollectionName; id: string; data?: object }[]
) => {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + 450)) {
      const ref = itemRef(op.name, op.id);
      if (op.type === 'set') batch.set(ref, op.data ?? {});
      else if (op.type === 'update') batch.update(ref, (op.data ?? {}) as Record<string, unknown>);
      else batch.delete(ref);
    }
    await batch.commit();
  }
};

/** True when the studio has no settings and no data yet (first run). */
export const isStudioEmpty = async (): Promise<boolean> => {
  const settings = await getDoc(settingsRef());
  if (settings.exists()) return false;
  const names: CollectionName[] = ['artists', 'clients', 'appointments', 'inventory'];
  for (const name of names) {
    const snap = await getDocs(colRef(name));
    if (!snap.empty) return false;
  }
  return true;
};

export interface StudioSnapshot {
  settings: StudioSettings;
  artists: Artist[];
  clients: Client[];
  appointments: Appointment[];
  inventory: InventoryItem[];
  notifications: NotificationLog[];
}

/** Seeds an empty studio, either from this device's old local data or from defaults. */
export const seedStudio = async (data: StudioSnapshot) => {
  await saveSettings(data.settings);
  await batchWrite([
    ...data.artists.map((d) => ({ type: 'set' as const, name: 'artists' as const, id: d.id, data: d })),
    ...data.clients.map((d) => ({ type: 'set' as const, name: 'clients' as const, id: d.id, data: d })),
    ...data.appointments.map((d) => ({ type: 'set' as const, name: 'appointments' as const, id: d.id, data: d })),
    ...data.inventory.map((d) => ({ type: 'set' as const, name: 'inventory' as const, id: d.id, data: d })),
    ...data.notifications.map((d) => ({ type: 'set' as const, name: 'notifications' as const, id: d.id, data: d })),
  ]);
};

/** Data saved in this browser by the previous, local-only version of the app. */
export const LEGACY_LOCAL_STORAGE_KEY = 'inkstudio_data_v1';

export const readLegacyLocalData = (): Partial<StudioSnapshot> | null => {
  try {
    const read = <T,>(suffix: string): T | undefined => {
      const raw = localStorage.getItem(`${LEGACY_LOCAL_STORAGE_KEY}_${suffix}`);
      return raw ? (JSON.parse(raw) as T) : undefined;
    };
    const snapshot: Partial<StudioSnapshot> = {
      settings: read<StudioSettings>('settings'),
      artists: read<Artist[]>('artists'),
      clients: read<Client[]>('clients'),
      appointments: read<Appointment[]>('appointments'),
      inventory: read<InventoryItem[]>('inventory'),
      notifications: read<NotificationLog[]>('notifications'),
    };
    const hasAny = Object.values(snapshot).some((v) => v !== undefined);
    return hasAny ? snapshot : null;
  } catch {
    return null;
  }
};
