import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { savePublicProfile } from '../../services/studioStore';
import { uploadImage, deleteImage } from '../../services/imageUpload';
import { PublicArtist, PublicProfile } from '../../types';
import { cardClass, inputClass, labelClass, PhotoPicker, primaryBtn } from './ui';
import { SiteContent } from './useSiteContent';

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
  const initialised = useRef(false);

  useEffect(() => {
    if (!loaded || initialised.current) return;
    setForm({ ...defaults, ...(profile ?? {}) });
    initialised.current = true;
  }, [loaded, profile, defaults]);

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
      const next = { ...form, artists: finalArtists };
      await savePublicProfile(next);
      setForm(next);
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
                    placeholder="@"
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

      <div className="flex justify-end">
        <button className={primaryBtn} onClick={save} disabled={saving || !loaded}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Guardar perfil público
        </button>
      </div>
    </div>
  );
};
