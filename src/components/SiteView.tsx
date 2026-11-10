import React, { useState } from 'react';
import { Globe, Inbox, Image as ImageIcon, Palette, Store, Package, Gift } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { useSiteContent } from './site/useSiteContent';
import { BookingRequestsPanel } from './site/BookingRequestsPanel';
import { PortfolioPanel } from './site/PortfolioPanel';
import { ShopPanel } from './site/ShopPanel';
import { OrdersPanel } from './site/OrdersPanel';
import { VouchersPanel } from './site/VouchersPanel';
import { PublicProfilePanel } from './site/PublicProfilePanel';
import { chip } from './site/ui';

type SubTab = 'requests' | 'portfolio' | 'shop' | 'orders' | 'vouchers' | 'profile';

/** Backoffice for the public ARANT website. */
export const SiteView: React.FC = () => {
  const { newBookingRequestCount } = useStudio();
  const [tab, setTab] = useState<SubTab>('requests');
  const content = useSiteContent();
  const openOrders = content.orders.filter((o) => o.status === 'paid').length;

  const tabs: { id: SubTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'requests', label: 'Pedidos de marcação', icon: Inbox, badge: newBookingRequestCount },
    { id: 'portfolio', label: 'Portfólio', icon: ImageIcon },
    { id: 'shop', label: 'Loja', icon: Store },
    { id: 'orders', label: 'Encomendas', icon: Package, badge: openOrders },
    { id: 'vouchers', label: 'Vales', icon: Gift },
    { id: 'profile', label: 'Estúdio & artistas', icon: Globe },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Palette className="w-5 h-5" /> Site & Portfólio
        </h2>
        <p className="text-xs sm:text-sm text-zinc-500">
          Tudo o que publicares aqui aparece no site. Os pedidos e as compras feitos no site chegam aqui.
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={chip(tab === t.id)}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {!!t.badge && <span className="ml-0.5 px-1.5 rounded-full bg-rose-500 text-white text-[10px]">{t.badge}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'requests' && <BookingRequestsPanel content={content} />}
      {tab === 'portfolio' && <PortfolioPanel content={content} />}
      {tab === 'shop' && <ShopPanel content={content} />}
      {tab === 'orders' && <OrdersPanel content={content} />}
      {tab === 'vouchers' && <VouchersPanel content={content} />}
      {tab === 'profile' && <PublicProfilePanel content={content} />}
    </div>
  );
};
