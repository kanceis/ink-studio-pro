import React, { useState } from 'react';
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Loader2, Check, Minus, ExternalLink } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { saveItem, patchItem, removeItem, newId, incrementField } from '../../services/studioStore';
import { uploadImage, deleteImage } from '../../services/imageUpload';
import { ShopItem, ShopItemKind, ShopItemStatus, UploadedImage } from '../../types';
import {
  cardClass,
  chip,
  EmptyState,
  eur,
  ghostBtn,
  iconBtn,
  inputClass,
  labelClass,
  moveItem,
  nextOrder,
  PhotoPicker,
  primaryBtn,
} from './ui';
import { SiteContent } from './useSiteContent';

export const KIND_LABELS: Record<ShopItemKind, string> = {
  original: 'Original',
  edition: 'Edição limitada',
  merch: 'Print on demand',
};

const KIND_HELP: Record<ShopItemKind, string> = {
  original: 'Peça única. Vende-se uma vez.',
  edition: 'Vendida no site com Stripe. Cada compra desconta stock automaticamente.',
  merch: 'Produto feito por encomenda noutra loja (Redbubble, Printful...). O site leva o cliente para lá.',
};

const STATUS_LABELS: Record<ShopItemStatus, string> = {
  available: 'Disponível',
  reserved: 'Reservada',
  sold: 'Vendida',
};

type Draft = Omit<ShopItem, 'id' | 'image' | 'order' | 'createdAt' | 'price' | 'editionSize' | 'stock' | 'shippingPrice'> & {
  id?: string;
  image?: UploadedImage;
  price: string;
  editionSize: string;
  stock: string;
  shippingPrice: string;
};

const num = (v: string) => Number(String(v).replace(',', '.'));

export const ShopPanel: React.FC<{ content: SiteContent }> = ({ content }) => {
  const items = content.shop;
  const { showToast, settings } = useStudio();
  const currency = settings.currency || 'EUR';
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<ShopItemKind | 'all'>('all');

  const visible = items.filter((i) => kind === 'all' || i.kind === kind);

  const open = (item?: ShopItem) => {
    setFile(null);
    if (item) {
      setDraft({
        ...item,
        price: String(item.price ?? ''),
        editionSize: String(item.editionSize ?? ''),
        stock: String(item.stock ?? ''),
        shippingPrice: String(item.shippingPrice ?? ''),
      });
      return;
    }
    setDraft({
      kind: kind === 'all' ? 'original' : kind,
      title: '',
      description: '',
      artistId: content.artistOptions[0]?.id,
      medium: '',
      dimensions: '',
      year: String(new Date().getFullYear()),
      price: '',
      status: 'available',
      editionSize: '',
      stock: '',
      shippingPrice: '',
      paymentLink: '',
      externalUrl: '',
      published: true,
    });
  };

  const save = async () => {
    if (!draft) return;
    const price = num(draft.price);
    if (!draft.title.trim()) return showToast('Dá um título ao produto.', 'info');
    if (!Number.isFinite(price) || price < 0 || (draft.kind !== 'merch' && price === 0)) {
      return showToast('Indica um preço válido.', 'info');
    }
    if (!file && !draft.image) return showToast('Escolhe uma foto.', 'info');

    let editionSize: number | undefined;
    let stock: number | undefined;
    let shippingPrice: number | undefined;
    if (draft.kind === 'edition') {
      editionSize = Math.round(num(draft.editionSize));
      stock = draft.stock === '' ? editionSize : Math.round(num(draft.stock));
      shippingPrice = draft.shippingPrice === '' ? 0 : num(draft.shippingPrice);
      if (!Number.isInteger(editionSize) || editionSize < 1) return showToast('Indica quantas cópias tem a edição.', 'info');
      if (!Number.isInteger(stock) || stock < 0 || stock > editionSize) {
        return showToast('O stock tem de estar entre 0 e o tamanho da edição.', 'info');
      }
      if (!Number.isFinite(shippingPrice) || shippingPrice < 0) return showToast('Indica um preço de envio válido.', 'info');
    }
    if (draft.kind === 'merch' && !/^https:\/\//.test(draft.externalUrl?.trim() || '')) {
      return showToast('Cola o link do produto (começa por https://).', 'info');
    }
    if (draft.kind === 'original' && draft.paymentLink && !/^https:\/\//.test(draft.paymentLink.trim())) {
      return showToast('O link de pagamento deve começar por https://', 'info');
    }

    setSaving(true);
    try {
      const image = file ? await uploadImage(file, 'shop') : draft.image!;
      const existing = draft.id ? items.find((i) => i.id === draft.id) : undefined;
      const status: ShopItemStatus =
        draft.kind === 'edition' ? ((stock ?? 0) > 0 ? 'available' : 'sold') : draft.kind === 'merch' ? 'available' : draft.status;
      const item: ShopItem = {
        id: draft.id || newId('shop'),
        kind: draft.kind,
        title: draft.title.trim(),
        description: draft.description?.trim() || undefined,
        artistId: draft.artistId || undefined,
        medium: draft.medium?.trim() || undefined,
        dimensions: draft.dimensions?.trim() || undefined,
        year: draft.year?.trim() || undefined,
        price,
        status,
        editionSize,
        stock,
        shippingPrice,
        paymentLink: draft.kind === 'original' ? draft.paymentLink?.trim() || undefined : undefined,
        externalUrl: draft.kind === 'merch' ? draft.externalUrl?.trim() : undefined,
        published: draft.published,
        image,
        order: existing?.order ?? nextOrder(items),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      await saveItem('shop', item);
      if (file && existing?.image?.key && existing.image.key !== image.key) {
        deleteImage(existing.image.key).catch(console.error);
      }
      setDraft(null);
      showToast('Produto guardado.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: ShopItem) => {
    if (!window.confirm(`Apagar "${item.title}" da loja?`)) return;
    await removeItem('shop', item.id);
    deleteImage(item.image?.key).catch(console.error);
  };

  const adjustStock = async (item: ShopItem, delta: 1 | -1) => {
    const stock = item.stock ?? 0;
    if (stock + delta < 0 || stock + delta > (item.editionSize ?? Infinity)) return;
    await incrementField('shop', item.id, 'stock', delta);
    const after = stock + delta;
    if ((after === 0 && item.status !== 'sold') || (after > 0 && item.status === 'sold')) {
      await patchItem('shop', item.id, { status: after === 0 ? 'sold' : 'available' });
    }
  };

  if (draft) {
    const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
    return (
      <div className={`${cardClass} p-4 sm:p-6 max-w-3xl`}>
        <h3 className="font-bold mb-1">{draft.id ? 'Editar produto' : 'Novo produto'}</h3>
        <div className="flex flex-wrap gap-1.5 my-3">
          {(Object.keys(KIND_LABELS) as ShopItemKind[]).map((k) => (
            <button key={k} type="button" className={chip(draft.kind === k)} onClick={() => set({ kind: k })}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500 mb-4">{KIND_HELP[draft.kind]}</p>

        <div className="grid sm:grid-cols-[220px_1fr] gap-5">
          <PhotoPicker current={draft.image} file={file} onFile={setFile} />
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Título *</label>
              <input className={inputClass} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  {draft.kind === 'merch' ? `Preço a partir de (${currency})` : `Preço (${currency}) *`}
                </label>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => set({ price: e.target.value })}
                  placeholder={draft.kind === 'edition' ? '45' : '250'}
                />
              </div>
              <div>
                <label className={labelClass}>Artista</label>
                <select
                  className={inputClass}
                  value={draft.artistId || ''}
                  onChange={(e) => set({ artistId: e.target.value || undefined })}
                >
                  <option value="">—</option>
                  {content.artistOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {draft.kind === 'original' && (
              <>
                <div>
                  <label className={labelClass}>Estado</label>
                  <select
                    className={inputClass}
                    value={draft.status}
                    onChange={(e) => set({ status: e.target.value as ShopItemStatus })}
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Link de pagamento Stripe (opcional)</label>
                  <input
                    className={inputClass}
                    value={draft.paymentLink || ''}
                    onChange={(e) => set({ paymentLink: e.target.value })}
                    placeholder="https://buy.stripe.com/..."
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Sem link, o site mostra um botão para pedir a peça por WhatsApp ou e-mail.
                  </p>
                </div>
              </>
            )}

            {draft.kind === 'edition' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Cópias na edição *</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={draft.editionSize}
                    onChange={(e) => set({ editionSize: e.target.value })}
                    placeholder="25"
                  />
                </div>
                <div>
                  <label className={labelClass}>Em stock</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={draft.stock}
                    onChange={(e) => set({ stock: e.target.value })}
                    placeholder={draft.editionSize || '25'}
                  />
                </div>
                <div>
                  <label className={labelClass}>Envio ({currency})</label>
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={draft.shippingPrice}
                    onChange={(e) => set({ shippingPrice: e.target.value })}
                    placeholder="0 = grátis"
                  />
                </div>
              </div>
            )}

            {draft.kind === 'merch' && (
              <div>
                <label className={labelClass}>Link do produto *</label>
                <input
                  className={inputClass}
                  value={draft.externalUrl || ''}
                  onChange={(e) => set({ externalUrl: e.target.value })}
                  placeholder="https://www.redbubble.com/i/t-shirt/..."
                />
              </div>
            )}

            {draft.kind !== 'merch' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Técnica / papel</label>
                  <input
                    className={inputClass}
                    value={draft.medium || ''}
                    onChange={(e) => set({ medium: e.target.value })}
                    placeholder={draft.kind === 'edition' ? 'Giclée, papel algodão 300g' : 'Tinta-da-china sobre papel'}
                  />
                </div>
                <div>
                  <label className={labelClass}>Ano</label>
                  <input className={inputClass} value={draft.year || ''} onChange={(e) => set({ year: e.target.value })} />
                </div>
              </div>
            )}
            {draft.kind !== 'merch' && (
              <div>
                <label className={labelClass}>Dimensões</label>
                <input
                  className={inputClass}
                  value={draft.dimensions || ''}
                  onChange={(e) => set({ dimensions: e.target.value })}
                  placeholder="30 x 40 cm"
                />
              </div>
            )}
            <div>
              <label className={labelClass}>Descrição</label>
              <textarea
                className={inputClass}
                rows={3}
                value={draft.description || ''}
                onChange={(e) => set({ description: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.published} onChange={(e) => set({ published: e.target.checked })} />
              Publicar no site
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button className={ghostBtn} onClick={() => setDraft(null)} disabled={saving}>
            Cancelar
          </button>
          <button className={primaryBtn} onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button className={chip(kind === 'all')} onClick={() => setKind('all')}>
            Tudo ({items.length})
          </button>
          {(Object.keys(KIND_LABELS) as ShopItemKind[]).map((k) => (
            <button key={k} className={chip(kind === k)} onClick={() => setKind(k)}>
              {KIND_LABELS[k]} ({items.filter((i) => i.kind === k).length})
            </button>
          ))}
        </div>
        <button className={primaryBtn} onClick={() => open()}>
          <Plus className="w-4 h-4" /> Novo produto
        </button>
      </div>

      {visible.length === 0 && <EmptyState>Ainda não há produtos aqui.</EmptyState>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((item) => {
          const index = items.findIndex((i) => i.id === item.id);
          const low = item.kind === 'edition' && (item.stock ?? 0) > 0 && (item.stock ?? 0) <= 3;
          return (
            <div key={item.id} className={`${cardClass} overflow-hidden flex`}>
              <div className="w-28 shrink-0 bg-zinc-100 dark:bg-zinc-950">
                {item.image?.url && (
                  <img src={item.image.url} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 p-3 min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold truncate">{item.title}</p>
                  <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {KIND_LABELS[item.kind]}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 truncate">
                  {[content.artistLabel(item.artistId), item.medium, item.dimensions].filter(Boolean).join(' · ')}
                </p>
                <p className="text-sm font-bold mt-1">
                  {item.kind === 'merch' && 'desde '}
                  {eur(item.price, currency)}
                </p>

                {item.kind === 'edition' && (
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <button className={iconBtn} onClick={() => adjustStock(item, -1)} aria-label="Menos uma cópia">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className={`font-semibold ${item.stock === 0 ? 'text-rose-500' : low ? 'text-amber-500' : ''}`}>
                      {item.stock ?? 0} / {item.editionSize ?? 0} em stock
                    </span>
                    <button className={iconBtn} onClick={() => adjustStock(item, 1)} aria-label="Mais uma cópia">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {item.kind === 'original' && (
                  <p className="text-xs mt-1">{STATUS_LABELS[item.status]}</p>
                )}
                {item.kind === 'merch' && item.externalUrl && (
                  <a
                    href={item.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs mt-1 inline-flex items-center gap-1 text-zinc-500 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Ver na loja
                  </a>
                )}
                {!item.published && <p className="text-[11px] text-zinc-500">Não publicado</p>}

                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex">
                    <button
                      className={iconBtn}
                      disabled={index <= 0}
                      onClick={() => moveItem('shop', items, index, -1)}
                      aria-label="Mover para trás"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className={iconBtn}
                      disabled={index >= items.length - 1}
                      onClick={() => moveItem('shop', items, index, 1)}
                      aria-label="Mover para a frente"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex">
                    {item.kind === 'original' && item.status !== 'sold' && (
                      <button
                        className={iconBtn}
                        onClick={() => patchItem('shop', item.id, { status: 'sold' })}
                        title="Marcar como vendida"
                        aria-label="Marcar como vendida"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button className={iconBtn} onClick={() => open(item)} aria-label="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button className={iconBtn} onClick={() => remove(item)} aria-label="Apagar">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
