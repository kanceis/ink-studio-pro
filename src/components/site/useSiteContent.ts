import { useEffect, useMemo, useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { subscribeCollection, subscribePublicProfile } from '../../services/studioStore';
import { PortfolioItem, PublicArtist, PublicProfile, ShopItem, ShopOrder } from '../../types';

export interface ArtistOption {
  id: string;
  label: string; // public display name if set, otherwise the internal name
}

/** Live portfolio, shop, orders and public profile from Firestore, plus the artist list. */
export const useSiteContent = () => {
  const { showToast, artists } = useStudio();
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [shop, setShop] = useState<ShopItem[]>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
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
      subscribeCollection('shop', (items) => setShop([...items].sort(byOrder)), onError),
      subscribeCollection(
        'orders',
        (items) => setOrders([...items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))),
        onError
      ),
      subscribePublicProfile((p) => {
        setProfile(p);
        setLoaded(true);
      }, onError),
    ];
    return () => unsubs.forEach((u) => u());
  }, [showToast]);

  const publicArtists: PublicArtist[] = useMemo(() => profile?.artists ?? [], [profile]);

  const artistOptions: ArtistOption[] = useMemo(
    () =>
      artists
        .filter((a) => a.active !== false)
        .map((a) => ({
          id: a.id,
          label: publicArtists.find((p) => p.id === a.id)?.displayName || a.name,
        })),
    [artists, publicArtists]
  );

  const artistLabel = (id?: string) => (id ? artistOptions.find((a) => a.id === id)?.label ?? '—' : '');

  return { portfolio, shop, orders, profile, loaded, artistOptions, artistLabel };
};

export type SiteContent = ReturnType<typeof useSiteContent>;
