/**
 * Stock reservation for the shop cart.
 *
 * Checkout reserves the items first (originals -> 'reserved', editions -> stock - qty)
 * in one atomic Firestore commit guarded by each document's updateTime, so two buyers
 * can never take the last copy. The reservation is recorded in studios/{id}/reservations/{rid}.
 *  - Stripe checkout.session.completed -> finalizeReservation: order written, originals 'sold'.
 *  - Stripe checkout.session.expired (or checkout failed) -> releaseReservation: stock back.
 */
import { Env } from './auth';
import { commit, fromFields, getDoc, studioDocName, toFields, Write } from './firestore';

export interface CartLine {
  id: string;
  qty: number;
}

export interface ReservedLine {
  itemId: string;
  title: string;
  kind: 'original' | 'edition';
  quantity: number;
  unitPrice: number;
  shippingPrice: number;
  imageUrl?: string;
}

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
  for (const line of cart) {
    if (typeof line?.id !== 'string' || !/^[\w-]{1,100}$/.test(line.id)) throw new CheckoutError('bad_item');
    const qty = Math.floor(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 10) throw new CheckoutError('bad_quantity', line.id);
    merged.set(line.id, (merged.get(line.id) || 0) + qty);
  }

  const rid = crypto.randomUUID();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const writes: Write[] = [];
    const lines: ReservedLine[] = [];

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

    const writes: Write[] = [
      {
        update: {
          name: orderName,
          fields: toFields({
            lines: lines.map((l) => ({ itemId: l.itemId, title: l.title, kind: l.kind, quantity: l.quantity, unitPrice: l.unitPrice })),
            itemTitle: lines.map((l) => (l.quantity > 1 ? `${l.quantity}× ${l.title}` : l.title)).join(' + ') || 'Encomenda',
            amountTotal: paid.amountTotal,
            shippingAmount: paid.shippingAmount,
            currency: paid.currency,
            customerName: paid.customerName,
            customerEmail: paid.customerEmail,
            customerPhone: paid.customerPhone,
            shippingAddress: paid.shippingAddress,
            status: 'paid',
            createdAt: new Date().toISOString(),
            ...(notes.length ? { notes: notes.join('\n') } : {}),
          }),
        },
        currentDocument: { exists: false },
      },
      ...itemWrites,
    ];
    if (reservation) writes.push({ delete: resName, currentDocument: { exists: true } });

    if (await commit(env, writes)) return 'created';
    if (await getDoc(env, orderName)) return 'duplicate';
  }
  throw new Error(`Could not finalize reservation ${rid}`);
};
