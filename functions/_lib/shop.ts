/**
 * Stock reservation for the shop cart.
 *
 * Checkout reserves the items first (originals -> 'reserved', editions -> stock - qty)
 * in one atomic Firestore commit guarded by each document's updateTime, so two buyers
 * can never take the last copy. The reservation is recorded in studios/{id}/reservations/{rid}.
 *  - Stripe checkout.session.completed -> finalizeReservation: order written, originals 'sold'.
 *  - Stripe checkout.session.expired (or checkout failed) -> releaseReservation: stock back.
 *
 * Gift vouchers (id VOUCHER_ID, amount chosen by the buyer) have no stock: they are only priced
 * here, and finalizeReservation creates one voucher with its own code per unit bought.
 */
import { Env } from './auth';
import { commit, fromFields, getDoc, studioDocName, toFields, Write } from './firestore';

export interface CartLine {
  id: string;
  qty: number;
  /** Gift voucher only: value in whole euros, who it's for and a short message. */
  amount?: number;
  to?: string;
  message?: string;
}

export interface ReservedLine {
  itemId: string;
  title: string;
  kind: 'original' | 'edition' | 'voucher';
  quantity: number;
  unitPrice: number;
  shippingPrice: number;
  imageUrl?: string;
  recipientName?: string;
  message?: string;
}

export const VOUCHER_ID = 'vale-de-oferta';
export const VOUCHER_MIN = 20;
export const VOUCHER_MAX = 500;

const cleanText = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Codes like INK-7KQ2-M9XD: no 0/O/1/I, so they can be read out over the phone. */
export const voucherCode = () => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const c = [...bytes].map((b) => abc[b % abc.length]).join('');
  return `INK-${c.slice(0, 4)}-${c.slice(4)}`;
};

export class CheckoutError extends Error {
  constructor(public code: string, public itemId?: string) {
    super(code);
  }
}

const MAX_ATTEMPTS = 4;
export const RESERVATION_MINUTES = 31; // Stripe sessions expire after at least 30 minutes

export const reserveCart = async (env: Env, cart: CartLine[]): Promise<{ rid: string; lines: ReservedLine[] }> => {
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 20) throw new CheckoutError('empty_cart');
  const merged = new Map<string, number>();
  const vouchers: ReservedLine[] = [];
  for (const line of cart) {
    if (typeof line?.id !== 'string' || !/^[\w-]{1,100}$/.test(line.id)) throw new CheckoutError('bad_item');
    const qty = Math.floor(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 10) throw new CheckoutError('bad_quantity', line.id);
    if (line.id === VOUCHER_ID) {
      const amount = Number(line.amount);
      if (!Number.isInteger(amount) || amount < VOUCHER_MIN || amount > VOUCHER_MAX) throw new CheckoutError('bad_amount', line.id);
      if (qty > 5) throw new CheckoutError('bad_quantity', line.id);
      vouchers.push({
        itemId: VOUCHER_ID,
        title: 'Vale de oferta',
        kind: 'voucher',
        quantity: qty,
        unitPrice: amount,
        shippingPrice: 0,
        recipientName: cleanText(line.to, 80) || undefined,
        message: cleanText(line.message, 240) || undefined,
      });
      continue;
    }
    merged.set(line.id, (merged.get(line.id) || 0) + qty);
  }

  const rid = crypto.randomUUID();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const writes: Write[] = [];
    const lines: ReservedLine[] = [...vouchers];

    for (const [id, qty] of merged) {
      const name = studioDocName(env, 'shop', id);
      const doc = await getDoc(env, name);
      if (!doc) throw new CheckoutError('not_found', id);
      const item = fromFields(doc.fields) as Record<string, any>;
      if (item.published !== true) throw new CheckoutError('not_found', id);

      const base = {
        itemId: id,
        title: String(item.title || 'Produto'),
        quantity: qty,
        unitPrice: Number(item.price) || 0,
        shippingPrice: Number(item.shippingPrice) || 0,
        imageUrl: item.image?.url,
      };
      if (base.unitPrice <= 0) throw new CheckoutError('not_for_sale', id);

      if (item.kind === 'original') {
        if (qty !== 1) throw new CheckoutError('bad_quantity', id);
        if (item.status !== 'available') throw new CheckoutError('sold_out', id);
        writes.push({
          update: { name, fields: toFields({ status: 'reserved', reservedBy: rid }) },
          updateMask: { fieldPaths: ['status', 'reservedBy'] },
          currentDocument: { updateTime: doc.updateTime },
        });
        lines.push({ ...base, kind: 'original' });
      } else if (item.kind === 'edition') {
        const stock = Number(item.stock) || 0;
        if (stock < qty) throw new CheckoutError('sold_out', id);
        const after = stock - qty;
        writes.push({
          update: { name, fields: toFields({ stock: after, status: after === 0 ? 'sold' : 'available' }) },
          updateMask: { fieldPaths: ['stock', 'status'] },
          currentDocument: { updateTime: doc.updateTime },
        });
        lines.push({ ...base, kind: 'edition' });
      } else {
        throw new CheckoutError('not_for_sale', id); // merch is sold elsewhere
      }
    }

    const now = Date.now();
    writes.push({
      update: {
        name: studioDocName(env, 'reservations', rid),
        fields: toFields({
          lines,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + RESERVATION_MINUTES * 60_000).toISOString(),
        }),
      },
      currentDocument: { exists: false },
    });

    if (await commit(env, writes)) return { rid, lines };
    // Someone changed an item between our read and write: read again and retry.
  }
  throw new CheckoutError('busy');
};

/** Puts reserved stock back. Safe to call twice. */
export const releaseReservation = async (env: Env, rid: string): Promise<void> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const resName = studioDocName(env, 'reservations', rid);
    const reservation = await getDoc(env, resName);
    if (!reservation) return;
    const { lines = [] } = fromFields(reservation.fields) as { lines?: ReservedLine[] };

    const writes: Write[] = [];
    for (const line of lines) {
      if (line.kind === 'voucher') continue; // no stock to give back
      const name = studioDocName(env, 'shop', line.itemId);
      const doc = await getDoc(env, name);
      if (!doc) continue;
      const item = fromFields(doc.fields) as Record<string, any>;
      if (line.kind === 'original') {
        if (item.status !== 'reserved' || item.reservedBy !== rid) continue;
        writes.push({
          update: { name, fields: toFields({ status: 'available' }) },
          updateMask: { fieldPaths: ['status', 'reservedBy'] },
          currentDocument: { updateTime: doc.updateTime },
        });
      } else {
        const stock = (Number(item.stock) || 0) + line.quantity;
        writes.push({
          update: { name, fields: toFields({ stock, status: stock > 0 ? 'available' : 'sold' }) },
          updateMask: { fieldPaths: ['stock', 'status'] },
          currentDocument: { updateTime: doc.updateTime },
        });
      }
    }
    writes.push({ delete: resName, currentDocument: { exists: true } });
    if (await commit(env, writes)) return;
  }
  throw new Error(`Could not release reservation ${rid}`);
};

export interface PaidSession {
  sessionId: string;
  amountTotal: number; // EUR
  shippingAmount: number; // EUR
  currency: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
}

export interface VoucherDoc {
  code: string;
  amount: number;
  balance: number;
  status: 'active' | 'used' | 'cancelled';
  recipientName?: string;
  message?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  orderId: string;
  createdAt: string;
  expiresAt: string;
}

/** Months a gift voucher is valid for (VOUCHER_VALID_MONTHS, default 12). */
const validMonths = (env: Env) => {
  const n = Math.floor(Number(env.VOUCHER_VALID_MONTHS || 12));
  return n > 0 && n <= 120 ? n : 12;
};

/** Records the order and marks originals as sold. Idempotent per Stripe session. */
export const finalizeReservation = async (env: Env, rid: string, paid: PaidSession): Promise<'created' | 'duplicate'> => {
  const orderName = studioDocName(env, 'orders', paid.sessionId);
  if (await getDoc(env, orderName)) return 'duplicate';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const resName = studioDocName(env, 'reservations', rid);
    const reservation = await getDoc(env, resName);
    const { lines = [] } = reservation ? (fromFields(reservation.fields) as { lines?: ReservedLine[] }) : { lines: [] };
    const notes: string[] = reservation ? [] : ['Reserva não encontrada: confirmar stock manualmente.'];
    const itemWrites: Write[] = [];

    for (const line of lines) {
      if (line.kind !== 'original') continue; // editions were already taken out of stock
      const name = studioDocName(env, 'shop', line.itemId);
      const doc = await getDoc(env, name);
      if (!doc) continue;
      const item = fromFields(doc.fields) as Record<string, any>;
      if (item.status !== 'reserved' || item.reservedBy !== rid) {
        notes.push(`"${line.title}" já não estava reservado para esta compra (estado: ${item.status}). Confirmar antes de enviar.`);
      }
      itemWrites.push({
        update: { name, fields: toFields({ status: 'sold' }) },
        updateMask: { fieldPaths: ['status', 'reservedBy'] },
        currentDocument: { updateTime: doc.updateTime },
      });
    }

    // Gift vouchers: one document (and code) per unit bought.
    const now = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + validMonths(env));
    const voucherDocs: VoucherDoc[] = lines
      .filter((l) => l.kind === 'voucher')
      .flatMap((l) => Array.from({ length: l.quantity }, () => ({
        code: voucherCode(),
        amount: l.unitPrice,
        balance: l.unitPrice,
        status: 'active' as const,
        recipientName: l.recipientName,
        message: l.message,
        buyerName: paid.customerName,
        buyerEmail: paid.customerEmail,
        buyerPhone: paid.customerPhone,
        orderId: paid.sessionId,
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
      })));
    const onlyVouchers = lines.length > 0 && lines.every((l) => l.kind === 'voucher');
    const titleOf = (l: ReservedLine) => (l.kind === 'voucher' ? `Vale de oferta ${l.unitPrice} €` : l.title);

    const writes: Write[] = [
      {
        update: {
          name: orderName,
          fields: toFields({
            lines: lines.map((l) => ({ itemId: l.itemId, title: titleOf(l), kind: l.kind, quantity: l.quantity, unitPrice: l.unitPrice })),
            itemTitle: lines.map((l) => (l.quantity > 1 ? `${l.quantity}× ${titleOf(l)}` : titleOf(l))).join(' + ') || 'Encomenda',
            ...(voucherDocs.length ? { voucherCodes: voucherDocs.map((v) => v.code) } : {}),
            amountTotal: paid.amountTotal,
            shippingAmount: paid.shippingAmount,
            currency: paid.currency,
            customerName: paid.customerName,
            customerEmail: paid.customerEmail,
            customerPhone: paid.customerPhone,
            shippingAddress: paid.shippingAddress,
            // A voucher-only order has nothing to ship: the code is shown on the thank-you page.
            status: onlyVouchers ? 'shipped' : 'paid',
            ...(onlyVouchers ? { shippedAt: now.toISOString() } : {}),
            createdAt: now.toISOString(),
            ...(notes.length ? { notes: notes.join('\n') } : {}),
          }),
        },
        currentDocument: { exists: false },
      },
      ...itemWrites,
      ...voucherDocs.map((v): Write => ({
        update: { name: studioDocName(env, 'vouchers', v.code), fields: toFields({ ...v }) },
        currentDocument: { exists: false },
      })),
    ];
    if (reservation) writes.push({ delete: resName, currentDocument: { exists: true } });

    if (await commit(env, writes)) return 'created';
    if (await getDoc(env, orderName)) return 'duplicate';
  }
  throw new Error(`Could not finalize reservation ${rid}`);
};
