import React, { useMemo, useState } from 'react';
import { Gift, Mail, Phone, Plus, Search, X } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { newVoucherCode, patchItem, redeemVoucher, saveItem } from '../../services/studioStore';
import { Voucher } from '../../types';
import { cardClass, chip, EmptyState, eur, ghostBtn, inputClass, labelClass, primaryBtn } from './ui';
import { SiteContent } from './useSiteContent';

type Shown = 'active' | 'used' | 'expired' | 'cancelled';

const BADGE: Record<Shown, { label: string; cls: string }> = {
  active: { label: 'Ativo', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  used: { label: 'Usado', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  expired: { label: 'Expirado', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  cancelled: { label: 'Cancelado', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
};

const shownStatus = (v: Voucher): Shown =>
  v.status === 'active' && v.expiresAt && new Date(v.expiresAt) < new Date() ? 'expired' : v.status;

const day = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });

/** Letters and digits only, so "ink 7kq2m9xd" finds INK-7KQ2-M9XD. */
const squash = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

const ERRORS: Record<string, string> = {
  not_found: 'Este vale já não existe.',
  not_active: 'Este vale já foi usado ou cancelado.',
  too_much: 'O valor é maior do que o saldo do vale.',
};

/** Gift vouchers: bought on the site (code shown to the buyer) or sold at the studio. Redeem them here. */
export const VouchersPanel: React.FC<{ content: SiteContent }> = ({ content }) => {
  const { showToast } = useStudio();
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [query, setQuery] = useState('');
  const [take, setTake] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ amount: '50', recipientName: '', buyerName: '', months: '12' });

  const list = useMemo(() => {
    const q = squash(query);
    return content.vouchers.filter((v) => {
      if (q) return squash(v.code).includes(q) || squash(`${v.recipientName || ''}${v.buyerName || ''}`).includes(q);
      return filter === 'all' || shownStatus(v) === 'active';
    });
  }, [content.vouchers, query, filter]);

  const activeTotal = content.vouchers.filter((v) => shownStatus(v) === 'active').reduce((s, v) => s + (v.balance || 0), 0);

  const redeem = async (v: Voucher) => {
    const amount = Number((take[v.id] ?? String(v.balance)).replace(',', '.'));
    if (!(amount > 0)) return showToast('Escreve quanto queres descontar.', 'error');
    setBusy(v.id);
    try {
      const left = await redeemVoucher(v.id, amount);
      setTake((t) => ({ ...t, [v.id]: '' }));
      showToast(left > 0 ? `Descontado ${eur(amount)}. Ficam ${eur(left)} no vale.` : `Descontado ${eur(amount)}. O vale ficou usado.`, 'success');
    } catch (err) {
      showToast(ERRORS[(err as Error).message] || 'Não foi possível descontar. Verifica a ligação à internet.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const cancel = (v: Voucher) => {
    if (!window.confirm(`Cancelar o vale ${v.code}? Deixa de poder ser usado. Se foi pago no site, o reembolso faz-se no Stripe.`)) return;
    patchItem('vouchers', v.id, { status: 'cancelled' }).catch(() => showToast('Não foi possível cancelar o vale.', 'error'));
  };

  const create = async () => {
    const amount = Math.round(Number(draft.amount.replace(',', '.')) * 100) / 100;
    const months = Math.floor(Number(draft.months));
    if (!(amount > 0 && amount <= 2000)) return showToast('Escreve o valor do vale.', 'error');
    if (!(months > 0 && months <= 120)) return showToast('Escreve a validade em meses.', 'error');
    const now = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + months);
    const code = newVoucherCode();
    try {
      await saveItem('vouchers', {
        id: code,
        code,
        amount,
        balance: amount,
        status: 'active',
        ...(draft.recipientName.trim() ? { recipientName: draft.recipientName.trim() } : {}),
        ...(draft.buyerName.trim() ? { buyerName: draft.buyerName.trim() } : {}),
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        notes: 'Vendido no estúdio',
      });
      setCreating(false);
      setDraft({ amount: '50', recipientName: '', buyerName: '', months: draft.months });
      setQuery(code);
      showToast(`Vale ${code} criado. Escreve este código no vale em papel.`, 'success');
    } catch {
      showToast('Não foi possível criar o vale.', 'error');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className={`${inputClass} pl-9 font-mono uppercase placeholder:normal-case placeholder:font-sans`}
            placeholder="Procurar pelo código ou nome"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Procurar vale"
          />
        </div>
        <button className={ghostBtn} onClick={() => setCreating((c) => !c)}>
          <Plus className="w-4 h-4" /> Vale vendido no estúdio
        </button>
      </div>

      {creating && (
        <div className={`${cardClass} p-4 space-y-3`}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Para um vale pago no estúdio. A app cria o código; escreve-o no vale que entregas.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label>
              <span className={labelClass}>Valor (€)</span>
              <input className={inputClass} inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            </label>
            <label>
              <span className={labelClass}>Validade (meses)</span>
              <input className={inputClass} inputMode="numeric" value={draft.months} onChange={(e) => setDraft({ ...draft, months: e.target.value })} />
            </label>
            <label>
              <span className={labelClass}>Para quem</span>
              <input className={inputClass} value={draft.recipientName} onChange={(e) => setDraft({ ...draft, recipientName: e.target.value })} />
            </label>
            <label>
              <span className={labelClass}>Comprado por</span>
              <input className={inputClass} value={draft.buyerName} onChange={(e) => setDraft({ ...draft, buyerName: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2">
            <button className={primaryBtn} onClick={create}>
              <Gift className="w-4 h-4" /> Criar vale
            </button>
            <button className={ghostBtn} onClick={() => setCreating(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {!query && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button className={chip(filter === 'active')} onClick={() => setFilter('active')}>
            Por usar ({content.vouchers.filter((v) => shownStatus(v) === 'active').length})
          </button>
          <button className={chip(filter === 'all')} onClick={() => setFilter('all')}>
            Todos ({content.vouchers.length})
          </button>
          {activeTotal > 0 && <span className="text-xs text-zinc-500 ml-1">{eur(activeTotal)} em saldo por usar</span>}
        </div>
      )}

      {list.length === 0 && (
        <EmptyState>
          {query
            ? 'Nenhum vale com este código ou nome.'
            : filter === 'active'
              ? 'Não há vales por usar.'
              : 'Ainda não há vales. Os que forem comprados no site aparecem aqui.'}
        </EmptyState>
      )}

      {list.map((v) => {
        const shown = shownStatus(v);
        return (
          <div key={v.id} className={`${cardClass} p-4 space-y-2`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono font-semibold tracking-wider select-all">{v.code}</p>
                <p className="text-sm">
                  <span className="font-semibold">{eur(v.balance)}</span>
                  {v.balance !== v.amount && <span className="text-zinc-500"> de {eur(v.amount)}</span>}
                  {v.recipientName && <span className="text-zinc-600 dark:text-zinc-400"> · para {v.recipientName}</span>}
                </p>
                <p className="text-xs text-zinc-500">
                  {v.orderId ? 'Comprado no site' : v.notes || 'Criado na app'} a {day(v.createdAt)} · válido até {day(v.expiresAt)}
                </p>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${BADGE[shown].cls}`}>{BADGE[shown].label}</span>
            </div>

            <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
              {v.buyerName && <p>Comprado por <span className="font-medium text-zinc-800 dark:text-zinc-200">{v.buyerName}</span></p>}
              {(v.buyerEmail || v.buyerPhone) && (
                <div className="flex flex-wrap gap-3">
                  {v.buyerEmail && (
                    <a href={`mailto:${v.buyerEmail}`} className="inline-flex items-center gap-1 hover:underline">
                      <Mail className="w-3.5 h-3.5" /> {v.buyerEmail}
                    </a>
                  )}
                  {v.buyerPhone && (
                    <a href={`tel:${v.buyerPhone}`} className="inline-flex items-center gap-1 hover:underline">
                      <Phone className="w-3.5 h-3.5" /> {v.buyerPhone}
                    </a>
                  )}
                </div>
              )}
              {v.message && <p className="italic">«{v.message}»</p>}
              {!!v.redemptions?.length && (
                <ul className="pt-1">
                  {v.redemptions.map((r, i) => (
                    <li key={i}>
                      Descontado {eur(r.amount)} a {day(r.at)}
                      {r.note ? ` · ${r.note}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(shown === 'active' || shown === 'expired') && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {shown === 'expired' && (
                  <p className="w-full text-xs text-amber-700 dark:text-amber-300">Passou a validade. Podes descontar na mesma, se o estúdio aceitar.</p>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">Descontar</span>
                  <input
                    className={`${inputClass} w-28`}
                    inputMode="decimal"
                    value={take[v.id] ?? String(v.balance)}
                    onChange={(e) => setTake((t) => ({ ...t, [v.id]: e.target.value }))}
                    aria-label={`Valor a descontar do vale ${v.code}`}
                  />
                  <span className="text-zinc-500">€</span>
                </label>
                <button className={primaryBtn} disabled={busy === v.id} onClick={() => redeem(v)}>
                  <Gift className="w-4 h-4" /> Descontar
                </button>
                <button className={ghostBtn} onClick={() => cancel(v)}>
                  <X className="w-4 h-4" /> Cancelar vale
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
