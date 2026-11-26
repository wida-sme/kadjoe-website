import { z } from 'zod';
import { checkToken } from '@/server/internal/auth';
import { pushPosts, wantedCodes } from '@/server/instagram/sync';

// The door for scripts/ig-push.mjs, which reads the public profile from a home or office connection.
// Its own token (IG_PUSH_TOKEN), never the admin one: it can only add posts.
export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const code = z.string().regex(/^[A-Za-z0-9_-]{5,40}$/);
// The server downloads these links, so only Instagram's CDN over https.
const cdn = z.url({ protocol: /^https$/, hostname: /(^|\.)(cdninstagram\.com|fbcdn\.net)$/ }).max(2000);
const child = z.object({ id: z.string().max(40), media_type: z.enum(['IMAGE', 'VIDEO']), media_url: cdn.optional() });
const post = z.object({
  id: z.string().max(40),
  shortcode: code,
  caption: z.string().max(5000).optional(),
  media_type: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM']),
  permalink: z.url().max(200),
  timestamp: z.iso.datetime(),
  media_url: cdn.optional(),
  children: z.object({ data: z.array(child).max(20) }).optional(),
});

/** GET ?codes=a,b,c → the codes to send. */
export async function GET(req: Request) {
  if (!checkToken(req, 'IG_PUSH_TOKEN')) return new Response('Unauthorized', { status: 401 });
  const codes = z.array(code).max(50).safeParse((new URL(req.url).searchParams.get('codes') ?? '').split(',').filter(Boolean));
  if (!codes.success) return json({ ok: false, code: 'invalid' }, 400);
  return json({ ok: true, need: wantedCodes(codes.data) });
}

/** POST { posts: [...] }, newest first, in the Instagram API's own shape; an empty list still records the run. */
export async function POST(req: Request) {
  if (!checkToken(req, 'IG_PUSH_TOKEN')) return new Response('Unauthorized', { status: 401 });
  const body = z.object({ posts: z.array(post).max(50) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ ok: false, code: 'invalid' }, 400);
  return json(await pushPosts(body.data.posts));
}
