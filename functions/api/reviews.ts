/**
 * GET /api/reviews  (called by the public site)
 * The studio's Google rating and its recent 4 and 5 star reviews, read live from the Places API (New).
 *
 * Nothing is stored: the Google Maps Platform terms only allow keeping the place ID, so the reviews are
 * fetched from Google and cached for a few hours (in this worker and in the edge cache), not saved in Firestore.
 * Google picks which reviews the API returns (up to 5). The site must show the Google attribution and
 * each author's name with a link to their profile.
 *
 * Secrets: GOOGLE_PLACES_API_KEY (restricted to the Places API) and GOOGLE_PLACE_ID.
 * Without them the endpoint answers 503 not_configured and the site hides the section.
 */
import { Env, json, corsHeaders } from '../_lib/auth';

interface PlaceReview {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  publishTime?: string;
  relativePublishTimeDescription?: string;
  googleMapsUri?: string;
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
}

interface Place {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  googleMapsLinks?: { reviewsUri?: string; writeAReviewUri?: string; placeUri?: string };
  reviews?: PlaceReview[];
}

export interface ReviewsPayload {
  rating: number | null;
  count: number;
  reviewsUrl: string | null;
  writeReviewUrl: string | null;
  reviews: {
    author: string;
    authorUrl: string | null;
    authorPhoto: string | null;
    rating: number;
    text: string;
    publishTime: string | null;
    relativeTime: string | null;
    url: string | null;
  }[];
  demo?: boolean;
}

const TTL_SECONDS = 6 * 60 * 60;
const MIN_RATING = 4;
let memo: { at: number; key: string; body: ReviewsPayload } | null = null;

const https = (u: unknown): string | null => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);

export const toPayload = (place: Place, placeId: string): ReviewsPayload => ({
  rating: typeof place.rating === 'number' ? Math.round(place.rating * 10) / 10 : null,
  count: Number(place.userRatingCount) || 0,
  reviewsUrl: https(place.googleMapsLinks?.reviewsUri) || https(place.googleMapsUri),
  writeReviewUrl:
    https(place.googleMapsLinks?.writeAReviewUri) ||
    `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`,
  reviews: (place.reviews || [])
    .map((r) => ({
      author: String(r.authorAttribution?.displayName || '').trim(),
      authorUrl: https(r.authorAttribution?.uri),
      authorPhoto: https(r.authorAttribution?.photoUri),
      rating: Number(r.rating) || 0,
      text: String(r.text?.text || r.originalText?.text || '').trim(),
      publishTime: r.publishTime || null,
      relativeTime: r.relativePublishTimeDescription || null,
      url: https(r.googleMapsUri),
    }))
    .filter((r) => r.rating >= MIN_RATING && r.text && r.author)
    .sort((a, b) => String(b.publishTime).localeCompare(String(a.publishTime))),
});

/** Local development only (REVIEWS_DEMO=1): clearly marked placeholder content, never real opinions. */
const demoPayload = (): ReviewsPayload => ({
  demo: true,
  rating: 4.8,
  count: 38,
  reviewsUrl: 'https://www.google.com/maps',
  writeReviewUrl: 'https://www.google.com/maps',
  reviews: [1, 2, 3, 4].map((i) => ({
    author: `Cliente de exemplo ${i}`,
    authorUrl: null,
    authorPhoto: null,
    rating: i === 3 ? 4 : 5,
    text: 'Crítica de exemplo. No site a sério aparece aqui o texto que a pessoa escreveu no Google, tal e qual.',
    publishTime: `2026-10-${String(30 - i * 5).padStart(2, '0')}T12:00:00Z`,
    relativeTime: ['há uma semana', 'há 2 semanas', 'há um mês', 'há 2 meses'][i - 1],
    url: null,
  })),
});

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) =>
  new Response(null, { status: 204, headers: corsHeaders(request, env) });

export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const cors = corsHeaders(request, env);
  const cacheHeaders = { ...cors, 'cache-control': `public, max-age=${TTL_SECONDS}`, vary: 'origin' };

  if (!env.GOOGLE_PLACES_API_KEY || !env.GOOGLE_PLACE_ID) {
    if (env.REVIEWS_DEMO === '1') return json(demoPayload(), 200, cors);
    return json({ error: 'not_configured' }, 503, cors);
  }

  const placeId = env.GOOGLE_PLACE_ID.trim();
  if (memo && memo.key === placeId && Date.now() - memo.at < TTL_SECONDS * 1000) return json(memo.body, 200, cacheHeaders);

  // Edge cache, shared by every visitor (works on a custom domain; on *.pages.dev it is simply skipped).
  const cacheKey = new Request(`https://reviews.cache/${encodeURIComponent(placeId)}`);
  const cache = typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined;
  const hit = cache ? await cache.match(cacheKey).catch(() => undefined) : undefined;
  if (hit) {
    const body = (await hit.json()) as ReviewsPayload;
    memo = { at: Date.now(), key: placeId, body };
    return json(body, 200, cacheHeaders);
  }

  const base = (env.PLACES_API_BASE || 'https://places.googleapis.com').replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/v1/places/${encodeURIComponent(placeId)}?languageCode=pt&regionCode=PT`, {
      headers: {
        'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri,googleMapsLinks,reviews',
      },
    });
  } catch (err) {
    console.error('reviews: places fetch failed', err);
    return json({ error: 'unavailable' }, 502, cors);
  }
  if (!res.ok) {
    console.error('reviews: places answered', res.status, await res.text().catch(() => ''));
    return json({ error: 'unavailable' }, 502, cors);
  }

  const body = toPayload((await res.json()) as Place, placeId);
  memo = { at: Date.now(), key: placeId, body };
  if (cache) {
    waitUntil(
      cache
        .put(cacheKey, new Response(JSON.stringify(body), { headers: { 'cache-control': `public, max-age=${TTL_SECONDS}` } }))
        .catch(() => undefined)
    );
  }
  return json(body, 200, cacheHeaders);
};
