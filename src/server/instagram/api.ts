// Instagram API with Instagram Login (graph.instagram.com). Needs a professional (business or
// creator) account and the instagram_business_basic permission. Read-only: we never post.

const GRAPH = 'https://graph.instagram.com';
const VERSION = process.env.IG_GRAPH_VERSION || 'v23.0';
const TIMEOUT = 20_000;

export class InstagramError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number) { super(message); }
  /** The token is no longer valid: the account must be connected again. */
  get expired() { return this.status === 401 || this.code === 190; }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error ?? {};
    // Never echo the URL: it carries the token.
    throw new InstagramError(e.message ? String(e.message).slice(0, 200) : `Instagram answered ${res.status}`, res.status, e.code);
  }
  return body as T;
}

export type IgChild = { id: string; media_type: 'IMAGE' | 'VIDEO'; media_url?: string; thumbnail_url?: string };
export type IgMedia = {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_product_type?: string;
  permalink: string;
  shortcode?: string;
  timestamp: string;
  media_url?: string;
  thumbnail_url?: string;
  children?: { data: IgChild[] };
};

const FIELDS = 'id,caption,media_type,media_product_type,permalink,shortcode,timestamp,media_url,thumbnail_url,children{id,media_type,media_url,thumbnail_url}';

export function getMe(token: string) {
  return call<{ user_id?: string; id: string; username: string; account_type?: string }>(
    `${GRAPH}/${VERSION}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(token)}`,
  );
}

/** Newest first, one page at a time. */
export function listMedia(token: string, after?: string) {
  const q = new URLSearchParams({ fields: FIELDS, limit: '25', access_token: token });
  if (after) q.set('after', after);
  return call<{ data: IgMedia[]; paging?: { cursors?: { after?: string }; next?: string } }>(`${GRAPH}/${VERSION}/me/media?${q}`);
}

/** A post again, for fresh image URLs (the CDN links expire). */
export function getMedia(token: string, id: string) {
  return call<IgMedia>(`${GRAPH}/${VERSION}/${encodeURIComponent(id)}?fields=${FIELDS}&access_token=${encodeURIComponent(token)}`);
}

/** Long-lived tokens last 60 days and can be refreshed once they are a day old. */
export function refreshToken(token: string) {
  return call<{ access_token: string; expires_in: number }>(
    `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
  );
}

export function authorizeUrl(appId: string, redirectUri: string, state: string) {
  const q = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, response_type: 'code', scope: 'instagram_business_basic', state });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

/** OAuth code → short-lived token → long-lived token. */
export async function exchangeCode(appId: string, secret: string, redirectUri: string, code: string) {
  const form = new URLSearchParams({ client_id: appId, client_secret: secret, grant_type: 'authorization_code', redirect_uri: redirectUri, code });
  const short = await call<{ access_token: string; user_id: string | number }>('https://api.instagram.com/oauth/access_token', {
    method: 'POST', body: form, headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  const long = await call<{ access_token: string; expires_in: number }>(
    `${GRAPH}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(secret)}&access_token=${encodeURIComponent(short.access_token)}`,
  );
  return { token: long.access_token, expiresIn: long.expires_in, userId: String(short.user_id) };
}

/** Downloads one image from Instagram's CDN, with a size cap. */
export async function download(url: string, max = 30 * 1024 * 1024) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000), cache: 'no-store' });
  if (!res.ok) throw new InstagramError(`Image download failed (${res.status})`, res.status);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > max) throw new InstagramError('Image too large', 413);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > max) throw new InstagramError('Image too large', 413);
  return buf;
}

export const shortcodeOf = (m: Pick<IgMedia, 'shortcode' | 'permalink'>) =>
  m.shortcode || /\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/.exec(m.permalink)?.[1] || null;
