import { Env, json, corsHeaders, isStudioMember } from '../../_lib/auth';

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) =>
  new Response(null, { status: 204, headers: corsHeaders(request, env) });

/** DELETE /api/images/<folder>/<file>: removes a photo from R2 (members only). */
export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const cors = corsHeaders(request, env);
  if (!(await isStudioMember(request, env))) return json({ error: 'not_allowed' }, 403, cors);

  const key = Array.isArray(params.key) ? params.key.join('/') : String(params.key || '');
  if (!/^(portfolio|shop|artists|misc)\/[0-9a-f-]{36}\.(webp|jpg|png|avif)$/.test(key)) {
    return json({ error: 'bad_key' }, 400, cors);
  }
  await env.IMAGES.delete(key);
  return json({ deleted: key }, 200, cors);
};
