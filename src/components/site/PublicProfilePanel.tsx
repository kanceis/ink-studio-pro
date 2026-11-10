import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { savePublicProfile } from '../../services/studioStore';
import { uploadImage, deleteImage } from '../../services/imageUpload';
import { InstagramPost, PublicArtist, PublicProfile, UploadedImage } from '../../types';
import { cardClass, ghostBtn, iconBtn, inputClass, labelClass, PhotoPicker, primaryBtn } from './ui';
import { SiteContent } from './useSiteContent';

const API_BASE = (import.meta.env.VITE_IMAGES_API_BASE || '').replace(/\/$/, '');
const MAX_POSTS = 6;
const POST_URL = /^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[\w-]+\/?(\?.*)?$/;

/** An Instagram post being edited: either already uploaded (image) or waiting to upload (file). */
interface PostDraft {
  id: string;
  image?: UploadedImage;
  file?: File | null;
  url: string;
  alt: string;
}

type ReviewsStatus =
  | { state: 'loading' }
  | { state: 'off' }
  | { state: 'error' }
  | { state: 'on'; rating: number | null; count: number; shown: number; demo?: boolean };

/** Studio info and artist profiles shown on the public site (meta/public). */
export const PublicProfilePanel: React.FC<{ content: SiteContent }> = ({ content }) => {
  const { settings, artists, showToast } = useStudio();
  const { profile, loaded } = content;

  const defaults: PublicProfile = useMemo(
    () => ({
      name: 'ARANT Tattoo',
      tagline: 'Sketch → Skin',
      bio: settings.description,
      city: 'Gaia · Porto · Portugal',
      address: settings.address,
      phone: settings.phone,
      whatsapp: settings.whatsappPhoneNumber || settings.phone,
      email: settings.email,
      instagram: settings.instagram,
      openingHours: settings.openingHours,
      depositInfo: '',
      bookingOpen: true,
      merchStoreUrl: '',
      artists: [],
    }),
    [settings]
  );

  const [form, setForm] = useState<PublicProfile>(defaults);
  const [photoFiles, setPhotoFiles] = useState<Record<string, File | null>>({});
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState<PostDraft[]>([]);
  const [reviews, setReviews] = useState<ReviewsStatus>({ state: 'loading' });
  const initialised = useRef(false);

  useEffect(() => {
    if (!loaded || initialised.current) return;
    setForm({ ...defaults, ...(profile ?? {}) });
    setPosts((profile?.instagramPosts ?? []).map((p) => ({ id: p.id, image: p.image, url: p.url, alt: p.alt || '' })));
    initialised.current = true;
  }, [loaded, profile, defaults]);

  // What the site would show right now in the Google reviews section.
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/reviews`)
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 503) return setReviews({ state: 'off' });
        if (!res.ok) return setReviews({ state: 'error' });
        const body = await res.json();
        setReviews({ state: 'on', rating: body.rating, count: body.count, shown: body.reviews?.length || 0, demo: body.demo });
      })
      .catch(() => alive && setReviews({ state: 'error' }));
    return () => {
      alive = false;
    };
  }, []);

  const setPost = (id: string, patch: Partial<PostDraft>) =>
    setPosts((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const movePost = (id: string, dir: -1 | 1) =>
    setPosts((list) => {
      const i = list.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  // One public entry per internal artist; new artists start hidden until filled in.
  const publicArtists: PublicArtist[] = useMemo(
    () =>
      artists.map(
        (a) =>
          form.artists?.find((p) => p.id === a.id) ?? {
            id: a.id,
            displayName: a.name,
            fullName: '',
            bio: a.bio || '',
            instagram: '',
            styles: a.specialties?.join(' · ') || '',
            visible: false,
            acceptsBookings: true,
          }
      ),
    [artists, form.artists]
  );

  const set = <K extends keyof PublicProfile>(key: K, value: PublicProfile[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setArtist = (id: string, patch: Partial<PublicArtist>) =>
    setForm((f) => ({
      ...f,
      artists: publicArtists.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));

  const save = async () => {
    const badPost = posts.find((p) => !POST_URL.test(p.url.trim()) || (!p.image && !p.file));
    if (badPost) {
      showToast(
        !badPost.image && !badPost.file
          ? 'Falta a imagem de um dos posts do Instagram.'
          : 'Cola o link completo de cada post do Instagram (https://www.instagram.com/p/...).',
        'error'
      );
      return;
    }
    setSaving(true);
    try {
      const finalArtists: PublicArtist[] = [];
      for (const a of publicArtists) {
        const file = photoFiles[a.id];
        if (file) {
          const photo = await uploadImage(file, 'artists');
          if (a.photo?.key) deleteImage(a.photo.key).catch(console.error);
          finalArtists.push({ ...a, photo });
        } else {
          finalArtists.push(a);
        }
      }
      const instagramPosts: InstagramPost[] = [];
      for (const p of posts) {
        const image = p.file ? await uploadImage(p.file, 'instagram') : p.image!;
        if (p.file && p.image?.key) deleteImage(p.image.key).catch(console.error);
        instagramPosts.push({ id: p.id, image, url: p.url.trim(), alt: p.alt.trim() });
      }
      const kept = new Set(instagramPosts.map((p) => p.image.key));
      for (const old of form.instagramPosts ?? []) {
        if (old.image?.key && !kept.has(old.image.key)) deleteImage(old.image.key).catch(console.error);
      }
      const next = { ...form, artists: finalArtists, instagramPosts };
      await savePublicProfile(next);
      setForm(next);
      setPosts(instagramPosts.map((p) => ({ id: p.id, image: p.image, url: p.url, alt: p.alt || '' })));
      setPhotoFiles({});
      showToast('Perfil público atualizado no site.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Não foi possível guardar o perfil.', 'error');
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
    <div className="space-y-6 max-w-4xl">
      <div className={`${cardClass} p-4 sm:p-6 space-y-4`}>
        <h3 className="font-bold">Estúdio</h3>
        <p className="text-xs text-zinc-500">
          Estes dados são públicos e aparecem no site. Os dados internos (automações, comissões, contas) não são partilhados.
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
          {field('merchStoreUrl', 'Loja de merch (Redbubble)', 'https://www.redbubble.com/people/...')}
        </div>
        <div>
          <label className={labelClass}>Sobre o estúdio</label>
          <textarea className={inputClass} rows={4} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.bookingOpen} onChange={(e) => set('bookingOpen', e.target.checked)} />
          Aceitar pedidos de marcação pelo site
        </label>
      </div>

      <div className={`${cardClass} p-4 sm:p-6 space-y-4`}>
        <div>
          <h3 className="font-bold">Artistas no site</h3>
          <p className="text-xs text-zinc-500">
            Um perfil por artista do separador "Artistas". Só os marcados como visíveis aparecem no site.
          </p>
        </div>
        {publicArtists.length === 0 && (
          <p className="text-sm text-zinc-500">Adiciona primeiro os artistas no separador "Artistas & Estatísticas".</p>
        )}
        {publicArtists.map((a) => (
          <div key={a.id} className="grid sm:grid-cols-[150px_1fr] gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <PhotoPicker
              label="Foto"
              aspect="aspect-[3/4]"
              current={a.photo}
              file={photoFiles[a.id] ?? null}
              onFile={(f) => setPhotoFiles((p) => ({ ...p, [a.id]: f }))}
            />
            <div className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Nome artístico</label>
                  <input
                    className={inputClass}
                    value={a.displayName}
                    onChange={(e) => setArtist(a.id, { displayName: e.target.value })}
                    placeholder="Arants"
                  />
                </div>
                <div>
                  <label className={labelClass}>Nome completo</label>
                  <input
                    className={inputClass}
                    value={a.fullName || ''}
                    onChange={(e) => setArtist(a.id, { fullName: e.target.value })}
                    placeholder="Miguel Alves"
                  />
                </div>
                <div>
                  <label className={labelClass}>Instagram</label>
                  <input
                    className={inputClass}
                    value={a.instagram || ''}
                    onChange={(e) => setArtist(a.id, { instagram: e.target.value })}
                    placeholder="@conta, @outra_conta"
                    title="Mais de uma conta? Separa com vírgulas."
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-[1fr_140px] gap-3">
                <div>
                  <label className={labelClass}>Estilos</label>
                  <input
                    className={inputClass}
                    value={a.styles || ''}
                    onChange={(e) => setArtist(a.id, { styles: e.target.value })}
                    placeholder="Sketch · Black & Red · Ilustração"
                  />
                </div>
                <div>
                  <label className={labelClass}>Preço desde (€)</label>
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={a.priceFrom ?? ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(',', '.');
                      setArtist(a.id, { priceFrom: v === '' ? undefined : Number(v) });
                    }}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Bio</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={a.bio || ''}
                  onChange={(e) => setArtist(a.id, { bio: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={a.visible} onChange={(e) => setArtist(a.id, { visible: e.target.checked })} />
                  Visível no site
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={a.acceptsBookings}
                    onChange={(e) => setArtist(a.id, { acceptsBookings: e.target.checked })}
                  />
                  Aceita marcações
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={`${cardClass} p-4 sm:p-6 space-y-4`}>
        <div>
          <h3 className="font-bold">Críticas do Google</h3>
          <p className="text-xs text-zinc-500">
            O site mostra a média, o número de críticas e as críticas recentes de 4 e 5 estrelas, lidas do Google na hora.
            Não se guardam aqui: as regras do Google só deixam mostrá-las a partir do Google.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.showGoogleReviews !== false}
            onChange={(e) => set('showGoogleReviews', e.target.checked)}
          />
          Mostrar as críticas do Google no site
        </label>
        <p className="text-sm rounded-lg bg-zinc-50 dark:bg-zinc-950 px-3 py-2">
          {reviews.state === 'loading' && 'A ver o estado da ligação ao Google…'}
          {reviews.state === 'off' &&
            'Ainda não está ligado ao Google. Falta pôr a chave da Places API e o ID do estúdio no Cloudflare (ver README).'}
          {reviews.state === 'error' && 'O Google não respondeu agora. O site esconde a secção até voltar a responder.'}
          {reviews.state === 'on' &&
            `${reviews.demo ? 'Dados de exemplo (desenvolvimento). ' : ''}${
              reviews.rating != null ? `${reviews.rating.toLocaleString('pt-PT')} ★ · ` : ''
            }${reviews.count} críticas no Google · ${reviews.shown} recentes de 4–5 estrelas para mostrar.`}
        </p>
      </div>

      <div className={`${cardClass} p-4 sm:p-6 space-y-4`}>
        <div>
          <h3 className="font-bold">Instagram no site</h3>
          <p className="text-xs text-zinc-500">
            Até {MAX_POSTS} posts escolhidos à mão, com o @ do estúdio acima. Põe a foto do post e o link dele: quem
            carregar na foto abre o post no Instagram.
          </p>
        </div>
        {posts.length === 0 && <p className="text-sm text-zinc-500">Sem posts, a secção não aparece no site.</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((p, i) => (
            <div key={p.id} className="space-y-2 rounded-lg border border-zinc-100 dark:border-zinc-800 p-3">
              <PhotoPicker
                label={`Post ${i + 1}`}
                aspect="aspect-square"
                current={p.image}
                file={p.file ?? null}
                onFile={(f) => setPost(p.id, { file: f })}
              />
              <input
                className={inputClass}
                value={p.url}
                placeholder="https://www.instagram.com/p/..."
                aria-label={`Link do post ${i + 1}`}
                onChange={(e) => setPost(p.id, { url: e.target.value })}
              />
              <input
                className={inputClass}
                value={p.alt}
                placeholder="O que se vê na foto (para leitores de ecrã)"
                aria-label={`Descrição do post ${i + 1}`}
                onChange={(e) => setPost(p.id, { alt: e.target.value })}
              />
              <div className="flex justify-between">
                <div className="flex gap-1">
                  <button type="button" className={iconBtn} disabled={i === 0} onClick={() => movePost(p.id, -1)} aria-label="Mover para trás">
                    ←
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    disabled={i === posts.length - 1}
                    onClick={() => movePost(p.id, 1)}
                    aria-label="Mover para a frente"
                  >
                    →
                  </button>
                </div>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => setPosts((list) => list.filter((x) => x.id !== p.id))}
                  aria-label={`Tirar o post ${i + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        {posts.length < MAX_POSTS && (
          <button
            type="button"
            className={ghostBtn}
            onClick={() => setPosts((list) => [...list, { id: crypto.randomUUID(), url: '', alt: '', file: null }])}
          >
            <Plus className="w-4 h-4" /> Adicionar post
          </button>
        )}
      </div>

      <div className="flex justify-end">
        <button className={primaryBtn} onClick={save} disabled={saving || !loaded}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Guardar perfil público
        </button>
      </div>
    </div>
  );
};
