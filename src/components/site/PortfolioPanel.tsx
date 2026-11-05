import React, { useState } from 'react';
import { Plus, Trash2, Pencil, Eye, EyeOff, Star, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { saveItem, patchItem, removeItem, newId } from '../../services/studioStore';
import { uploadImage, deleteImage } from '../../services/imageUpload';
import { PortfolioCategory, PortfolioItem, UploadedImage } from '../../types';
import {
  cardClass,
  chip,
  EmptyState,
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

export const CATEGORY_LABELS: Record<PortfolioCategory, string> = {
  tattoo: 'Tattoo',
  drawing: 'Drawing',
  art: 'Art',
  flash: 'Flash',
};

type Draft = Omit<PortfolioItem, 'id' | 'image' | 'order' | 'createdAt'> & { id?: string; image?: UploadedImage };

export const PortfolioPanel: React.FC<{ content: SiteContent }> = ({ content }) => {
  const items = content.portfolio;
  const { showToast } = useStudio();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<PortfolioCategory | 'all'>('all');
  const [artist, setArtist] = useState<string>('all');

  const visible = items.filter(
    (i) => (category === 'all' || i.category === category) && (artist === 'all' || i.artistId === artist)
  );

  const open = (item?: PortfolioItem) => {
    setFile(null);
    setDraft(
      item
        ? { ...item }
        : {
            title: '',
            category: category === 'all' ? 'tattoo' : category,
            artistId: artist === 'all' ? content.artistOptions[0]?.id : artist,
            style: '',
            description: '',
            published: true,
            featured: false,
          }
    );
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) return showToast('Dá um título à peça.', 'info');
    if (!file && !draft.image) return showToast('Escolhe uma foto.', 'info');
    setSaving(true);
    try {
      const image = file ? await uploadImage(file, 'portfolio') : draft.image!;
      const existing = draft.id ? items.find((i) => i.id === draft.id) : undefined;
      const isFlash = draft.category === 'flash';
      const priceFrom = isFlash && draft.priceFrom !== undefined && String(draft.priceFrom) !== '' ? Number(String(draft.priceFrom).replace(',', '.')) : undefined;
      if (priceFrom !== undefined && (!Number.isFinite(priceFrom) || priceFrom < 0)) {
        setSaving(false);
        return showToast('Indica um preço válido.', 'info');
      }
      const item: PortfolioItem = {
        id: draft.id || newId('work'),
        title: draft.title.trim(),
        category: draft.category,
        artistId: draft.artistId || undefined,
        style: draft.style?.trim() || undefined,
        description: draft.description?.trim() || undefined,
        published: draft.published,
        featured: draft.featured,
        image,
        order: existing?.order ?? nextOrder(items),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        ...(isFlash
          ? {
              flashNumber: draft.flashNumber?.trim() || undefined,
              flashSize: draft.flashSize?.trim() || undefined,
              flashSessions: draft.flashSessions ? Number(draft.flashSessions) || undefined : undefined,
              priceFrom,
              available: draft.available !== false,
            }
          : {}),
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
                <label className={labelClass}>Artista</label>
                <select
                  className={inputClass}
                  value={draft.artistId || ''}
                  onChange={(e) => setDraft({ ...draft, artistId: e.target.value || undefined })}
                >
                  <option value="">—</option>
                  {content.artistOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
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
            </div>
            {draft.category === 'flash' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 p-3">
                <div>
                  <label className={labelClass}>Nº do flash</label>
                  <input
                    className={inputClass}
                    value={draft.flashNumber || ''}
                    onChange={(e) => setDraft({ ...draft, flashNumber: e.target.value })}
                    placeholder="07"
                  />
                </div>
                <div>
                  <label className={labelClass}>Medidas</label>
                  <input
                    className={inputClass}
                    value={draft.flashSize || ''}
                    onChange={(e) => setDraft({ ...draft, flashSize: e.target.value })}
                    placeholder="8 x 12 cm"
                  />
                </div>
                <div>
                  <label className={labelClass}>Sessões</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={draft.flashSessions ?? ''}
                    onChange={(e) => setDraft({ ...draft, flashSessions: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className={labelClass}>Preço desde (€)</label>
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={draft.priceFrom ?? ''}
                    onChange={(e) => setDraft({ ...draft, priceFrom: e.target.value as unknown as number })}
                    placeholder="80"
                  />
                </div>
                <label className="col-span-2 sm:col-span-4 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.available !== false}
                    onChange={(e) => setDraft({ ...draft, available: e.target.checked })}
                  />
                  Disponível (desmarca quando já foi tatuado; sai da lista do site)
                </label>
              </div>
            )}
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
                <option value="Fine line" />
                <option value="Flash" />
              </datalist>
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'tattoo', 'drawing', 'art', 'flash'] as const).map((c) => (
              <button key={c} className={chip(category === c)} onClick={() => setCategory(c)}>
                {c === 'all' ? `Todas (${items.length})` : CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          {content.artistOptions.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button className={chip(artist === 'all')} onClick={() => setArtist('all')}>
                Todos os artistas
              </button>
              {content.artistOptions.map((a) => (
                <button key={a.id} className={chip(artist === a.id)} onClick={() => setArtist(a.id)}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className={primaryBtn} onClick={() => open()}>
          <Plus className="w-4 h-4" /> Nova peça
        </button>
      </div>

      {visible.length === 0 && <EmptyState>Ainda não há peças aqui. Carrega a primeira foto em "Nova peça".</EmptyState>}

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
                {item.category === 'flash' && item.available === false && (
                  <span className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-600 text-white">
                    Já tatuado
                  </span>
                )}
              </div>
              <div className="p-2.5 flex-1">
                <p className="text-sm font-semibold truncate">{item.title}</p>
                <p className="text-[11px] text-zinc-500 truncate">
                  {[
                    content.artistLabel(item.artistId),
                    item.category === 'flash' && item.flashNumber ? `Flash #${item.flashNumber}` : CATEGORY_LABELS[item.category],
                    item.style,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
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
