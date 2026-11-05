import { Env, json, corsHeaders, isStudioMember } from '../../_lib/auth';

const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
};
const FOLDERS = new Set(['portfolio', 'shop', 'artists', 'instagram', 'misc']);

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) =>
  new Response(null, { status: 204, headers: corsHeaders(request, env) });

/**
 * POST /api/images?folder=portfolio
 * Body: the image bytes (Content-Type image/webp, image/jpeg, image/png or image/avif).
 * Returns { key, url } where url is the public address of the photo.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const cors = corsHeaders(request, env);
  if (!(await isStudioMember(request, env))) return json({ error: 'not_allowed' }, 403, cors);

  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();
  const ext = EXTENSIONS[contentType];
  if (!ext) return json({ error: 'unsupported_type' }, 415, cors);

  const length = Number(request.headers.get('content-length') || '0');
  if (length > MAX_BYTES) return json({ error: 'too_large' }, 413, cors);

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return json({ error: 'empty' }, 400, cors);
  if (body.byteLength > MAX_BYTES) return json({ error: 'too_large' }, 413, cors);

  const folderParam = new URL(request.url).searchParams.get('folder') || 'misc';
  const folder = FOLDERS.has(folderParam) ? folderParam : 'misc';
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  await env.IMAGES.put(key, body, {
    httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
  });

  const url = `${new URL(request.url).origin}/img/${key}`;
  return json({ key, url }, 201, cors);
};
