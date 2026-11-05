import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Globe,
  Inbox,
  Image as ImageIcon,
  Palette,
  Store,
  Plus,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Star,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Loader2,
  Mail,
  Phone,
  Instagram,
  ExternalLink,
  Upload,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  subscribeCollection,
  subscribePublicProfile,
  savePublicProfile,
  saveItem,
  patchItem,
  removeItem,
  batchWrite,
  newId,
} from '../services/studioStore';
import { uploadImage, deleteImage } from '../services/imageUpload';
import {
  Artwork,
  ArtworkStatus,
  BookingRequest,
  PortfolioCategory,
  PortfolioItem,
  PublicProfile,
  UploadedImage,
} from '../types';

type SubTab = 'requests' | 'portfolio' | 'artworks' | 'profile';

const CATEGORY_LABELS: Record<PortfolioCategory, string> = {
  tattoo: 'Tattoo',
  drawing: 'Drawing',
  art: 'Art',
};

const STATUS_LABELS: Record<ArtworkStatus, string> = {
  available: 'Disponível',
  reserved: 'Reservada',
  sold: 'Vendida',
};

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/40';
const labelClass = 'block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1';
const cardClass = 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900';
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-sm font-semibold cursor-pointer disabled:opacity-50';
const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50';
const iconBtn =
  'p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-30 disabled:cursor-default';

/** Live portfolio, artworks and public profile from Firestore. */
const useSiteContent = () => {
  const { showToast } = useStudio();
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [profile, setProfile] = useState<Partial<PublicProfile> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onError = (err: Error) => {
      console.error(err);
      showToast('Erro ao carregar o conteúdo do site.', 'error');
    };
    const byOrder = <T extends { order: number; createdAt: string }>(a: T, b: T) =>
      (a.order ?? 0) - (b.order ?? 0) || (b.createdAt || '').localeCompare(a.createdAt || '');
    const unsubs = [
      subscribeCollection('portfolio', (items) => setPortfolio([...items].sort(byOrder)), onError),
      subscribeCollection('artworks', (items) => setArtworks([...items].sort(byOrder)), onError),
      subscribePublicProfile((p) => {
        setProfile(p);
        setLoaded(true);
      }, onError),
    ];
    return () => unsubs.forEach((u) => u());
  }, [showToast]);

  return { portfolio, artworks, profile, loaded };
};

export const SiteView: React.FC = () => {
  const { newBookingRequestCount } = useStudio();
  const [tab, setTab] = useState<SubTab>('requests');
  const content = useSiteContent();

  const tabs: { id: SubTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'requests', label: 'Pedidos de marcação', icon: Inbox, badge: newBookingRequestCount },
    { id: 'portfolio', label: 'Portfólio', icon: ImageIcon },
    { id: 'artworks', label: 'Arte à venda', icon: Store },
    { id: 'profile', label: 'Perfil público', icon: Globe },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Palette className="w-5 h-5" /> Site & Portfólio
        </h2>
        <p className="text-xs sm:text-sm text-zinc-500">
          Tudo o que publicares aqui aparece no site. Os pedidos feitos no formulário do site chegam aqui.
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border ${
                active
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100'
                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {!!t.badge && (
                <span className="ml-0.5 px-1.5 rounded-full bg-rose-500 text-white text-[10px]">{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'requests' && <BookingRequestsPanel />}
      {tab === 'portfolio' && <PortfolioPanel items={content.portfolio} />}
      {tab === 'artworks' && <ArtworksPanel items={content.artworks} />}
      {tab === 'profile' && <PublicProfilePanel profile={content.profile} loaded={content.loaded} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Booking requests
// ---------------------------------------------------------------------------

const BookingRequestsPanel: React.FC = () => {
  const { bookingRequests, addClient, showToast, setSelectedClientId, setActiveTab } = useStudio();
  const [filter, setFilter] = useState<'new' | 'all'>('new');
  const visible = bookingRequests.filter((r) => filter === 'all' || r.status === 'new');

  const accept = (req: BookingRequest) => {
    const notes = [
      `Pedido pelo site (${new Date(req.createdAt).toLocaleDateString('pt-PT')}):`,
      req.idea,
      req.placement && `Zona: ${req.placement}`,
      req.size && `Tamanho: ${req.size}`,
      req.style && `Estilo: ${req.style}`,
      req.preferredDates && `Disponibilidade: ${req.preferredDates}`,
      req.referenceUrl && `Referência: ${req.referenceUrl}`,
    ]
      .filter(Boolean)
      .join('\n');
    const client = addClient({
      name: req.name,
      email: req.email,
      phone: req.phone,
      birthDate: '',
      instagram: req.instagram,
      notes,
      references: [],
      clinicalHistory: {
        allergies: [],
        skinConditions: [],
        medications: [],
        hasBleedingDisorder: false,
        hasDiabetes: false,
        hasEpilepsy: false,
        hasHeartCondition: false,
        isPregnantOrNursing: false,
        hasKeloidHistory: false,
        consentSigned: false,
      },
    });
    patchItem('bookingRequests', req.id, { status: 'accepted', clientId: client.id }).catch(() =>
      showToast('Não foi possível atualizar o pedido.', 'error')
    );
    showToast(`Pedido aceite. ${req.name} foi adicionado aos clientes.`, 'success');
  };

  const decline = (req: BookingRequest) => {
    patchItem('bookingRequests', req.id, { status: 'declined' }).catch(() =>
      showToast('Não foi possível atualizar o pedido.', 'error')
    );
  };

  const remove = (req: BookingRequest) => {
    if (!window.confirm(`Apagar o pedido de ${req.name}?`)) return;
    removeItem('bookingRequests', req.id).catch(() => showToast('Não foi possível apagar o pedido.', 'error'));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs">
        <button className={filter === 'new' ? primaryBtn : ghostBtn} onClick={() => setFilter('new')}>
          Novos
        </button>
        <button className={filter === 'all' ? primaryBtn : ghostBtn} onClick={() => setFilter('all')}>
          Todos ({bookingRequests.length})
        </button>
      </div>

      {visible.length === 0 && (
        <div className={`${cardClass} p-8 text-center text-sm text-zinc-500`}>
          {filter === 'new' ? 'Não há pedidos novos.' : 'Ainda não chegaram pedidos pelo site.'}
        </div>
      )}

      {visible.map((req) => (
        <div key={req.id} className={`${cardClass} p-4 space-y-3`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{req.name}</p>
              <p className="text-xs text-zinc-500">
                {new Date(req.createdAt).toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                req.status === 'new'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : req.status === 'accepted'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
            >
              {req.status === 'new' ? 'Novo' : req.status === 'accepted' ? 'Aceite' : 'Recusado'}
            </span>
          </div>

          <p className="text-sm whitespace-pre-wrap">{req.idea}</p>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {req.placement && <Detail label="Zona" value={req.placement} />}
            {req.size && <Detail label="Tamanho" value={req.size} />}
            {req.style && <Detail label="Estilo" value={req.style} />}
            {req.preferredDates && <Detail label="Disponibilidade" value={req.preferredDates} />}
          </dl>

          <div className="flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
            <a href={`mailto:${req.email}`} className="inline-flex items-center gap-1 hover:underline">
              <Mail className="w-3.5 h-3.5" /> {req.email}
            </a>
            <a href={`tel:${req.phone}`} className="inline-flex items-center gap-1 hover:underline">
              <Phone className="w-3.5 h-3.5" /> {req.phone}
            </a>
            {req.instagram && (
              <span className="inline-flex items-center gap-1">
                <Instagram className="w-3.5 h-3.5" /> {req.instagram}
              </span>
            )}
            {req.referenceUrl && (
              <a
                href={req.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Referência
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {req.status === 'new' && (
              <>
                <button className={primaryBtn} onClick={() => accept(req)}>
                  <Check className="w-4 h-4" /> Aceitar e criar cliente
                </button>
                <button className={ghostBtn} onClick={() => decline(req)}>
                  <X className="w-4 h-4" /> Recusar
                </button>
              </>
            )}
            {req.status === 'accepted' && req.clientId && (
              <button
                className={ghostBtn}
                onClick={() => {
                  setSelectedClientId(req.clientId!);
                  setActiveTab('clients');
                }}
              >
                Ver ficha do cliente
              </button>
            )}
            <button className={`${ghostBtn} ml-auto`} onClick={() => remove(req)} aria-label="Apagar pedido">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1.5">
    <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</dt>
    <dd className="font-medium">{value}</dd>
  </div>
);

// ---------------------------------------------------------------------------
// Shared: photo picker, reorder
// ---------------------------------------------------------------------------

const PhotoPicker: React.FC<{
  current?: UploadedImage;
  file: File | null;
  onFile: (f: File | null) => void;
}> = ({ current, file, onFile }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : current?.url), [file, current]);
  useEffect(() => () => {
    if (file && preview) URL.revokeObjectURL(preview);
  }, [file, preview]);

  return (
    <div>
      <span className={labelClass}>Foto *</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative w-full aspect-[4/5] max-h-72 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 overflow-hidden flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 cursor-pointer"
      >
        {preview ? (
          <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-zinc-500">
            <Upload className="w-5 h-5" /> Escolher foto
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
};

/** Swaps the order of two neighbouring items. */
const moveItem = async <T extends { id: string; order: number }>(
  name: 'portfolio' | 'artworks',
  items: T[],
  index: number,
  delta: -1 | 1
) => {
  const target = index + delta;
  if (target < 0 || target >= items.length) return;
  // Normalise to 0..n-1 then swap, so equal/missing orders still move.
  const ordered = items.map((item, i) => ({ id: item.id, order: i }));
  [ordered[index].order, ordered[target].order] = [ordered[target].order, ordered[index].order];
  await batchWrite(ordered.map((o) => ({ type: 'update' as const, name, id: o.id, data: { order: o.order } })));
};

const nextOrder = (items: { order: number }[]) =>
  items.reduce((max, i) => Math.max(max, i.order ?? 0), -1) + 1;

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

type PortfolioDraft = Omit<PortfolioItem, 'id' | 'image' | 'order' | 'createdAt'> & {
  id?: string;
  image?: UploadedImage;
};

const emptyPortfolioDraft = (): PortfolioDraft => ({
  title: '',
  category: 'tattoo',
  style: '',
  description: '',
  published: true,
  featured: false,
});

const PortfolioPanel: React.FC<{ items: PortfolioItem[] }> = ({ items }) => {
  const { showToast } = useStudio();
  const [draft, setDraft] = useState<PortfolioDraft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<PortfolioCategory | 'all'>('all');

  const visible = items.filter((i) => filter === 'all' || i.category === filter);

  const open = (item?: PortfolioItem) => {
    setFile(null);
    setDraft(item ? { ...item } : emptyPortfolioDraft());
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) return showToast('Dá um título à peça.', 'info');
    if (!file && !draft.image) return showToast('Escolhe uma foto.', 'info');
    setSaving(true);
    try {
      const image = file ? await uploadImage(file, 'portfolio') : draft.image!;
      const existing = draft.id ? items.find((i) => i.id === draft.id) : undefined;
      const item: PortfolioItem = {
        id: draft.id || newId('work'),
        title: draft.title.trim(),
        category: draft.category,
        style: draft.style?.trim() || undefined,
        description: draft.description?.trim() || undefined,
        published: draft.published,
        featured: draft.featured,
        image,
        order: existing?.order ?? nextOrder(items),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      await saveItem('portfolio', item);
      if (file && existing?.image?.key && existing.image.key !== image.key) {
        deleteImage(existing.image.key).catch(console.error);
      }
      setDraft(null);
      showToast(item.published ? 'Guardado e publicado no site.' : 'Guardado (não publicado).', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: PortfolioItem) => {
    if (!window.confirm(`Apagar "${item.title}" do portfólio?`)) return;
    await removeItem('portfolio', item.id);
    deleteImage(item.image?.key).catch(console.error);
  };

  if (draft) {
    return (
      <div className={`${cardClass} p-4 sm:p-6 max-w-3xl`}>
        <h3 className="font-bold mb-4">{draft.id ? 'Editar peça' : 'Nova peça no portfólio'}</h3>
        <div className="grid sm:grid-cols-[220px_1fr] gap-5">
          <PhotoPicker current={draft.image} file={file} onFile={setFile} />
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Título *</label>
              <input
                className={inputClass}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Ex: Gorila geométrico"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Secção do site</label>
                <select
                  className={inputClass}
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value as PortfolioCategory })}
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Estilo</label>
                <input
                  className={inputClass}
                  value={draft.style || ''}
                  onChange={(e) => setDraft({ ...draft, style: e.target.value })}
                  placeholder="Black & Red"
                  list="portfolio-styles"
                />
                <datalist id="portfolio-styles">
                  <option value="Black & Red" />
                  <option value="Black & Grey" />
                  <option value="Sketch / Illustration" />
                  <option value="Flash" />
                </datalist>
              </div>
            </div>
            <div>
              <label className={labelClass}>Descrição</label>
              <textarea
                className={inputClass}
                rows={3}
                value={draft.description || ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
              />
              Publicar no site
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
              />
              Destacar na página inicial
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(['all', 'tattoo', 'drawing', 'art'] as const).map((c) => (
            <button key={c} className={filter === c ? primaryBtn : ghostBtn} onClick={() => setFilter(c)}>
              {c === 'all' ? `Todas (${items.length})` : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <button className={primaryBtn} onClick={() => open()}>
          <Plus className="w-4 h-4" /> Nova peça
        </button>
      </div>

      {visible.length === 0 && (
        <div className={`${cardClass} p-8 text-center text-sm text-zinc-500`}>
          Ainda não há peças aqui. Carrega a primeira foto em "Nova peça".
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visible.map((item) => {
          const index = items.findIndex((i) => i.id === item.id);
          return (
            <div key={item.id} className={`${cardClass} overflow-hidden flex flex-col`}>
              <div className="relative aspect-[4/5] bg-zinc-100 dark:bg-zinc-950">
                {item.image?.url && (
                  <img src={item.image.url} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
                )}
                {!item.published && (
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-900/80 text-white">
                    Rascunho
                  </span>
                )}
                {item.featured && (
                  <Star className="absolute top-2 right-2 w-4 h-4 text-amber-400 fill-amber-400 drop-shadow" />
                )}
              </div>
              <div className="p-2.5 flex-1">
                <p className="text-sm font-semibold truncate">{item.title}</p>
                <p className="text-[11px] text-zinc-500 truncate">
                  {CATEGORY_LABELS[item.category]}
                  {item.style ? ` · ${item.style}` : ''}
                </p>
              </div>
              <div className="flex items-center justify-between px-1.5 pb-1.5">
                <div className="flex">
                  <button
                    className={iconBtn}
                    disabled={index <= 0}
                    onClick={() => moveItem('portfolio', items, index, -1)}
                    aria-label="Mover para trás"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className={iconBtn}
                    disabled={index >= items.length - 1}
                    onClick={() => moveItem('portfolio', items, index, 1)}
                    aria-label="Mover para a frente"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex">
                  <button
                    className={iconBtn}
                    onClick={() => patchItem('portfolio', item.id, { published: !item.published })}
                    aria-label={item.published ? 'Despublicar' : 'Publicar'}
                    title={item.published ? 'Despublicar' : 'Publicar'}
                  >
                    {item.published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button className={iconBtn} onClick={() => open(item)} aria-label="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button className={iconBtn} onClick={() => remove(item)} aria-label="Apagar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Original art for sale
// ---------------------------------------------------------------------------

type ArtworkDraft = Omit<Artwork, 'id' | 'image' | 'order' | 'createdAt' | 'price'> & {
  id?: string;
  image?: UploadedImage;
  price: string;
};

const emptyArtworkDraft = (): ArtworkDraft => ({
  title: '',
  description: '',
  medium: '',
  dimensions: '',
  year: String(new Date().getFullYear()),
  price: '',
  status: 'available',
  paymentLink: '',
  published: true,
});

const ArtworksPanel: React.FC<{ items: Artwork[] }> = ({ items }) => {
  const { showToast, settings } = useStudio();
  const [draft, setDraft] = useState<ArtworkDraft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const currency = settings.currency || 'EUR';
  const fmt = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(n);

  const open = (item?: Artwork) => {
    setFile(null);
    setDraft(item ? { ...item, price: String(item.price) } : emptyArtworkDraft());
  };

  const save = async () => {
    if (!draft) return;
    const price = Number(String(draft.price).replace(',', '.'));
    if (!draft.title.trim()) return showToast('Dá um título à obra.', 'info');
    if (!Number.isFinite(price) || price < 0) return showToast('Indica um preço válido.', 'info');
    if (!file && !draft.image) return showToast('Escolhe uma foto.', 'info');
    if (draft.paymentLink && !/^https:\/\//.test(draft.paymentLink.trim())) {
      return showToast('O link de pagamento deve começar por https://', 'info');
    }
    setSaving(true);
    try {
      const image = file ? await uploadImage(file, 'artworks') : draft.image!;
      const existing = draft.id ? items.find((i) => i.id === draft.id) : undefined;
      const item: Artwork = {
        id: draft.id || newId('art'),
        title: draft.title.trim(),
        description: draft.description?.trim() || undefined,
        medium: draft.medium?.trim() || undefined,
        dimensions: draft.dimensions?.trim() || undefined,
        year: draft.year?.trim() || undefined,
        price,
        status: draft.status,
        paymentLink: draft.paymentLink?.trim() || undefined,
        published: draft.published,
        image,
        order: existing?.order ?? nextOrder(items),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      await saveItem('artworks', item);
      if (file && existing?.image?.key && existing.image.key !== image.key) {
        deleteImage(existing.image.key).catch(console.error);
      }
      setDraft(null);
      showToast('Obra guardada.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: Artwork) => {
    if (!window.confirm(`Apagar "${item.title}"?`)) return;
    await removeItem('artworks', item.id);
    deleteImage(item.image?.key).catch(console.error);
  };

  if (draft) {
    return (
      <div className={`${cardClass} p-4 sm:p-6 max-w-3xl`}>
        <h3 className="font-bold mb-4">{draft.id ? 'Editar obra' : 'Nova obra à venda'}</h3>
        <div className="grid sm:grid-cols-[220px_1fr] gap-5">
          <PhotoPicker current={draft.image} file={file} onFile={setFile} />
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Título *</label>
              <input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Preço ({currency}) *</label>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  placeholder="250"
                />
              </div>
              <div>
                <label className={labelClass}>Estado</label>
                <select
                  className={inputClass}
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as ArtworkStatus })}
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelClass}>Técnica</label>
                <input
                  className={inputClass}
                  value={draft.medium || ''}
                  onChange={(e) => setDraft({ ...draft, medium: e.target.value })}
                  placeholder="Tinta-da-china sobre papel"
                />
              </div>
              <div>
                <label className={labelClass}>Ano</label>
                <input className={inputClass} value={draft.year || ''} onChange={(e) => setDraft({ ...draft, year: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Dimensões</label>
              <input
                className={inputClass}
                value={draft.dimensions || ''}
                onChange={(e) => setDraft({ ...draft, dimensions: e.target.value })}
                placeholder="30 x 40 cm"
              />
            </div>
            <div>
              <label className={labelClass}>Link de pagamento (Stripe)</label>
              <input
                className={inputClass}
                value={draft.paymentLink || ''}
                onChange={(e) => setDraft({ ...draft, paymentLink: e.target.value })}
                placeholder="https://buy.stripe.com/..."
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Sem link, o site mostra um botão para pedir a obra por e-mail ou WhatsApp.
              </p>
            </div>
            <div>
              <label className={labelClass}>Descrição</label>
              <textarea
                className={inputClass}
                rows={3}
                value={draft.description || ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
              />
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
      <div className="flex justify-between items-center gap-2">
        <p className="text-xs text-zinc-500">
          {(() => {
            const n = items.filter((i) => i.status === 'available' && i.published).length;
            return n === 1 ? '1 obra disponível no site' : `${n} obras disponíveis no site`;
          })()}
        </p>
        <button className={primaryBtn} onClick={() => open()}>
          <Plus className="w-4 h-4" /> Nova obra
        </button>
      </div>

      {items.length === 0 && (
        <div className={`${cardClass} p-8 text-center text-sm text-zinc-500`}>
          Ainda não há obras à venda.
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item, index) => (
          <div key={item.id} className={`${cardClass} overflow-hidden flex`}>
            <div className="w-28 shrink-0 bg-zinc-100 dark:bg-zinc-950">
              {item.image?.url && <img src={item.image.url} alt={item.title} loading="lazy" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 p-3 min-w-0 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold truncate">{item.title}</p>
                <span
                  className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    item.status === 'available'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : item.status === 'reserved'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
              <p className="text-xs text-zinc-500 truncate">
                {[item.medium, item.dimensions, item.year].filter(Boolean).join(' · ')}
              </p>
              <p className="text-sm font-bold mt-1">{fmt(item.price)}</p>
              {!item.published && <p className="text-[11px] text-zinc-500">Não publicada</p>}
              <div className="mt-auto flex items-center justify-between pt-2">
                <div className="flex">
                  <button className={iconBtn} disabled={index <= 0} onClick={() => moveItem('artworks', items, index, -1)} aria-label="Mover para trás">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className={iconBtn}
                    disabled={index >= items.length - 1}
                    onClick={() => moveItem('artworks', items, index, 1)}
                    aria-label="Mover para a frente"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex">
                  {item.status !== 'sold' && (
                    <button
                      className={iconBtn}
                      onClick={() => patchItem('artworks', item.id, { status: 'sold' })}
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
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Public profile
// ---------------------------------------------------------------------------

const PublicProfilePanel: React.FC<{ profile: Partial<PublicProfile> | null; loaded: boolean }> = ({
  profile,
  loaded,
}) => {
  const { settings, showToast } = useStudio();
  const fromSettings: PublicProfile = useMemo(
    () => ({
      name: settings.name,
      tagline: 'Sketch → Skin',
      bio: settings.description,
      city: 'Vila Nova de Gaia · Porto',
      address: settings.address,
      phone: settings.phone,
      whatsapp: settings.whatsappPhoneNumber || settings.phone,
      email: settings.email,
      instagram: settings.instagram,
      openingHours: settings.openingHours,
      depositInfo: '',
      bookingOpen: true,
    }),
    [settings]
  );
  const [form, setForm] = useState<PublicProfile>(fromSettings);
  const [saving, setSaving] = useState(false);
  const initialised = useRef(false);

  useEffect(() => {
    if (!loaded || initialised.current) return;
    setForm({ ...fromSettings, ...(profile ?? {}) });
    initialised.current = true;
  }, [loaded, profile, fromSettings]);

  const set = <K extends keyof PublicProfile>(key: K, value: PublicProfile[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await savePublicProfile(form);
      showToast('Perfil público atualizado no site.', 'success');
    } catch {
      showToast('Não foi possível guardar o perfil.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof PublicProfile, label: string, placeholder = '') => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={String(form[key] ?? '')}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value as never)}
      />
    </div>
  );

  return (
    <div className={`${cardClass} p-4 sm:p-6 max-w-3xl space-y-4`}>
      <p className="text-xs text-zinc-500">
        Estes dados são públicos e aparecem no site. Os dados internos do estúdio (automações, contas) não são partilhados.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {field('name', 'Nome no site', 'ARANT Tattoo')}
        {field('tagline', 'Frase de destaque', 'Sketch → Skin')}
        {field('city', 'Cidade / zona', 'Gaia · Porto · Portugal')}
        {field('address', 'Morada do estúdio')}
        {field('phone', 'Telefone')}
        {field('whatsapp', 'WhatsApp', '+351 9xx xxx xxx')}
        {field('email', 'E-mail')}
        {field('instagram', 'Instagram', '@arant.tattoo')}
        {field('openingHours', 'Horário')}
        {field('depositInfo', 'Informação sobre sinal', 'Sinal de 50€, descontado no preço final')}
      </div>
      <div>
        <label className={labelClass}>Sobre (bio)</label>
        <textarea className={inputClass} rows={4} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.bookingOpen} onChange={(e) => set('bookingOpen', e.target.checked)} />
        Aceitar pedidos de marcação pelo site
      </label>
      <div className="flex justify-end">
        <button className={primaryBtn} onClick={save} disabled={saving || !loaded}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Guardar perfil público
        </button>
      </div>
    </div>
  );
};
