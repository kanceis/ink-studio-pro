import React, { useState } from 'react';
import { Truck, X, Mail, Phone, MapPin } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { patchItem } from '../../services/studioStore';
import { OrderStatus, ShopOrder } from '../../types';
import { cardClass, chip, EmptyState, eur, ghostBtn, inputClass, primaryBtn } from './ui';
import { SiteContent } from './useSiteContent';

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  paid: { label: 'Paga, por enviar', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  shipped: { label: 'Enviada', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  cancelled: { label: 'Cancelada', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
};

/** Orders paid on the site through Stripe (written by functions/api/stripe-webhook.ts). */
export const OrdersPanel: React.FC<{ content: SiteContent }> = ({ content }) => {
  const { showToast } = useStudio();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const list = content.orders.filter((o) => filter === 'all' || o.status === 'paid');

  const ship = (order: ShopOrder) =>
    patchItem('orders', order.id, {
      status: 'shipped',
      shippedAt: new Date().toISOString(),
      trackingNumber: tracking[order.id]?.trim() || undefined,
    })
      .then(() => showToast('Encomenda marcada como enviada.', 'success'))
      .catch(() => showToast('Não foi possível atualizar a encomenda.', 'error'));

  const cancel = (order: ShopOrder) => {
    if (!window.confirm('Marcar esta encomenda como cancelada? O reembolso faz-se no Stripe.')) return;
    patchItem('orders', order.id, { status: 'cancelled' }).catch(() =>
      showToast('Não foi possível atualizar a encomenda.', 'error')
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <button className={chip(filter === 'open')} onClick={() => setFilter('open')}>
          Por enviar ({content.orders.filter((o) => o.status === 'paid').length})
        </button>
        <button className={chip(filter === 'all')} onClick={() => setFilter('all')}>
          Todas ({content.orders.length})
        </button>
      </div>

      {list.length === 0 && (
        <EmptyState>
          {filter === 'open'
            ? 'Não há encomendas por enviar.'
            : 'Ainda não há encomendas. As compras feitas no site aparecem aqui.'}
        </EmptyState>
      )}

      {list.map((order) => (
        <div key={order.id} className={`${cardClass} p-4 space-y-2`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">
                {order.quantity > 1 ? `${order.quantity}× ` : ''}
                {order.itemTitle}
              </p>
              <p className="text-xs text-zinc-500">
                {new Date(order.createdAt).toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                {eur(order.amountTotal, (order.currency || 'eur').toUpperCase())}
              </p>
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS[order.status].cls}`}>
              {STATUS[order.status].label}
            </span>
          </div>

          <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
            {order.customerName && <p className="font-medium text-zinc-800 dark:text-zinc-200">{order.customerName}</p>}
            <div className="flex flex-wrap gap-3">
              {order.customerEmail && (
                <a href={`mailto:${order.customerEmail}`} className="inline-flex items-center gap-1 hover:underline">
                  <Mail className="w-3.5 h-3.5" /> {order.customerEmail}
                </a>
              )}
              {order.customerPhone && (
                <a href={`tel:${order.customerPhone}`} className="inline-flex items-center gap-1 hover:underline">
                  <Phone className="w-3.5 h-3.5" /> {order.customerPhone}
                </a>
              )}
            </div>
            {order.shippingAddress && (
              <p className="inline-flex items-start gap-1 whitespace-pre-line">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {order.shippingAddress}
              </p>
            )}
            {order.trackingNumber && <p>Tracking: {order.trackingNumber}</p>}
          </div>

          {order.status === 'paid' && (
            <div className="flex flex-wrap gap-2 pt-1">
              <input
                className={`${inputClass} max-w-xs`}
                placeholder="Nº de tracking (opcional)"
                value={tracking[order.id] || ''}
                onChange={(e) => setTracking((t) => ({ ...t, [order.id]: e.target.value }))}
              />
              <button className={primaryBtn} onClick={() => ship(order)}>
                <Truck className="w-4 h-4" /> Marcar como enviada
              </button>
              <button className={ghostBtn} onClick={() => cancel(order)}>
                <X className="w-4 h-4" /> Cancelar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
