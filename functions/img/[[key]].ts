import { Env } from '../_lib/auth';

/** GET /img/<folder>/<file>: serves a public website photo from R2, cached for a year. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const key = Array.isArray(params.key) ? params.key.join('/') : String(params.key || '');
  if (!/^(portfolio|shop|artists|misc)\/[0-9a-f-]{36}\.(webp|jpg|png|avif)$/.test(key)) {
    return new Response('Not found', { status: 404 });
  }

  const object = await env.IMAGES.get(key, { onlyIf: request.headers, range: request.headers });
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('access-control-allow-origin', '*');

  // onlyIf matched an If-None-Match / If-Modified-Since: no body.
  if (!('body' in object) || !object.body) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
};
