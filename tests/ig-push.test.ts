// The Mac push: the script's page parser, and /api/instagram/push against a temporary database.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { postsIn, toIgMedia } from '../scripts/ig-push.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kadjoe-push-'));
process.env.KADJOE_SITE_DATA_DIR = dir;
process.env.KADJOE_SITE_MIGRATIONS_DIR = path.resolve('drizzle');
process.env.IG_PUSH_TOKEN = 'push-token';
process.env.SITE_ADMIN_TOKEN = 'admin-token';

const CDN = 'https://scontent-cgk1-1.cdninstagram.com/v/t51/';
const DONE = 'Client: Rumah Uji\nType: Residential\nLocation: Kemang\nStatus: Completed\nService: Build';
const WIP = 'Client: Kafe Uji\nType: F&B\nLocation: Senopati\nStatus: On progress\nService: Build';

// `first` picks distinct test images, so the near-duplicate check keeps every photo.
const carousel = (code: string, caption: string, at: string, n: number, first = 0) => ({
  id: `${code}-id`, shortcode: code, caption, media_type: 'CAROUSEL_ALBUM', permalink: `https://www.instagram.com/p/${code}/`, timestamp: at,
  children: { data: Array.from({ length: n }, (_, i) => ({ id: `${code}${i}`, media_type: 'IMAGE', media_url: `${CDN}p${first + i}.jpg?_nc_cat=1` })) },
});

beforeAll(async () => {
  const img = (r: number) => sharp({ create: { width: 64, height: 48, channels: 3, background: { r, g: 255 - r, b: 90 } } })
    .composite([{ input: Buffer.from(`<svg width="64" height="48"><rect x="${r % 40}" y="${r % 30}" width="20" height="14" fill="#fff"/></svg>`) }]).jpeg().toBuffer();
  const images = await Promise.all([20, 50, 80, 110, 140, 170, 200, 230].map(img));
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const m = /\/v\/t51\/p(\d)\.jpg/.exec(String(input));
    return m ? new Response(new Uint8Array(images[Number(m[1])])) : new Response('not mocked', { status: 500 });
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
  fs.rmSync(dir, { recursive: true, force: true });
});

const call = async (method: 'GET' | 'POST', qs: string, body?: unknown, token = 'push-token') => {
  const route = await import('@/app/api/instagram/push/route');
  const req = new Request(`http://x/api/instagram/push${qs}`, {
    method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return method === 'GET' ? route.GET(req) : route.POST(req);
};

describe('ig-push script parser', () => {
  it('reads a post page and keeps the uncut photo link', () => {
    const page = { code: 'ABCDE1', pk: '77', taken_at: 1793185172, media_type: 8, caption: { text: DONE },
      carousel_media: [
        { pk: '1', media_type: 1, image_versions2: { candidates: [{ url: `${CDN}a.webp?stp=dst-jpg_s640x640` }, { url: `${CDN}a.webp?_nc_cat=1` }] } },
        { pk: '2', media_type: 2 },
      ] };
    const html = `<script type="application/json">${JSON.stringify({ x: [{ code: 'ABCDE1', caption: { text: DONE } }, page] })}</script><script type="application/json">{bad</script>`;
    const m = toIgMedia(postsIn(html).get('ABCDE1'));
    expect(m).toMatchObject({ id: '77', shortcode: 'ABCDE1', media_type: 'CAROUSEL_ALBUM', timestamp: '2026-10-28T10:59:32.000Z', caption: DONE });
    expect(m.children?.data).toEqual([{ id: '1', media_type: 'IMAGE', media_url: `${CDN}a.webp?_nc_cat=1` }, { id: '2', media_type: 'VIDEO' }]);
  });
});

describe('/api/instagram/push', () => {
  it('refuses the admin token and links outside Instagram', async () => {
    expect((await call('GET', '?codes=ABCDE1', undefined, 'admin-token')).status).toBe(401);
    const bad = carousel('EVIL01', DONE, '2026-11-20T03:00:00.000Z', 1);
    bad.children.data[0].media_url = 'https://169.254.169.254/latest/meta-data';
    expect((await call('POST', '', { posts: [bad] })).status).toBe(400);
  });

  it('imports a finished project, holds work in progress with its links, then approves it', async () => {
    const { setInstagram } = await import('@/server/settings');
    const { approvePost } = await import('@/server/instagram/sync');
    const { db } = await import('@/server/db/client');
    const t = await import('@/server/db/schema');
    setInstagram({ token: null, importSince: '2026-08-18T00:00:00.000Z', autoPublish: true });

    expect(await (await call('GET', '?codes=PUSHok1,PUSHwip1')).json()).toEqual({ ok: true, need: ['PUSHok1', 'PUSHwip1'] });
    const r = await call('POST', '', { posts: [carousel('PUSHok1', DONE, '2026-11-20T03:00:00.000Z', 2), carousel('PUSHwip1', WIP, '2026-11-19T03:00:00.000Z', 2, 2)] });
    expect(await r.json()).toMatchObject({ ok: true, seen: 2, imported: 1, pending: 1 });

    const house = db.select().from(t.projects).all().find((p) => p.name === 'Rumah Uji')!;
    expect(db.select().from(t.media).all().filter((m) => m.projectId === house.id)).toHaveLength(2);
    expect(db.select().from(t.igSyncRuns).all().at(-1)).toMatchObject({ trigger: 'push', ok: true, imported: 1 });

    // Only the inbox post is asked for again (for fresh links); the imported one is done.
    expect((await (await call('GET', '?codes=PUSHok1,PUSHwip1')).json()).need).toEqual(['PUSHwip1']);
    const again = await call('POST', '', { posts: [carousel('PUSHwip1', WIP, '2026-11-19T03:00:00.000Z', 3, 4)] });
    expect(await again.json()).toMatchObject({ seen: 0, imported: 0 });

    // No API token: the approval uses the links of the latest push (3 photos now).
    const ok = await approvePost('PUSHwip1', null);
    expect(ok.added).toBe(3);
    expect(db.select().from(t.igPosts).all().find((p) => p.shortcode === 'PUSHwip1')!.status).toBe('imported');
  });

});
