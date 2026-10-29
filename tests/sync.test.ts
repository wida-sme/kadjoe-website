// End to end: a mocked Instagram Graph API, a temporary database, one sync run.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kadjoe-sync-'));
process.env.KADJOE_SITE_DATA_DIR = dir;
process.env.KADJOE_SITE_MIGRATIONS_DIR = path.resolve('drizzle');

const GREENLAKE = 'Client : M House\nType : Residential\nLocation : Greenlake City\nService : Build\nStatus : Completed\nDesign : @beta.design.studio\nPhotography : @leowardistudio\n\n#kadjoekreasiindonesia';
const LATER_BSD = 'Client : M House\nType : Residential\nLocation : The Icon, Cluster Cosmo, BSD\nDesigned by: @se.designstudio\nPhotography : @harisabghi';

let jpeg: Buffer;
const posts = [
  {
    id: '901', caption: GREENLAKE, media_type: 'CAROUSEL_ALBUM', permalink: 'https://www.instagram.com/p/TESTgreen1/', shortcode: 'TESTgreen1',
    timestamp: '2026-11-02T03:00:00+0000',
    children: { data: [{ id: '9011', media_type: 'IMAGE', media_url: 'https://cdn.test/a.jpg' }, { id: '9012', media_type: 'IMAGE', media_url: 'https://cdn.test/b.jpg' }, { id: '9013', media_type: 'VIDEO', media_url: 'https://cdn.test/c.mp4' }] },
  },
  { id: '902', caption: LATER_BSD, media_type: 'IMAGE', media_url: 'https://cdn.test/d.jpg', permalink: 'https://www.instagram.com/p/TESTbsd2/', shortcode: 'TESTbsd2', timestamp: '2026-11-01T03:00:00+0000' },
  { id: '903', caption: 'Selamat Hari Raya! #kadjoe', media_type: 'IMAGE', media_url: 'https://cdn.test/e.jpg', permalink: 'https://www.instagram.com/p/TESTgreet/', shortcode: 'TESTgreet', timestamp: '2026-10-31T03:00:00+0000' },
];

beforeAll(async () => {
  // Distinct images, so the near-duplicate check keeps all of them.
  const make = (r: number, g: number) => sharp({ create: { width: 64, height: 48, channels: 3, background: { r, g, b: 90 } } })
    .composite([{ input: Buffer.from(`<svg width="64" height="48"><rect x="${r % 40}" y="${g % 30}" width="20" height="14" fill="#fff"/></svg>`) }]).jpeg().toBuffer();
  const images: Record<string, Buffer> = { a: await make(200, 10), b: await make(10, 200), d: await make(120, 120), e: await make(30, 60) };
  jpeg = images.a;
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.includes('/refresh_access_token')) return Response.json({ access_token: 'refreshed', expires_in: 5_184_000 });
    if (url.includes('/me/media')) return Response.json({ data: posts });
    const m = /cdn\.test\/(\w)\.jpg/.exec(url);
    if (m) return new Response(new Uint8Array(images[m[1]]), { headers: { 'content-type': 'image/jpeg' } });
    return new Response('not mocked', { status: 500 });
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('Instagram sync', () => {
  it('imports a new project, extends an existing one, skips greetings', async () => {
    const { createProject, addPhoto } = await import('@/server/admin/projects');
    const { createPartner } = await import('@/server/admin/partners');
    const { setInstagram } = await import('@/server/settings');
    const { runSync } = await import('@/server/instagram/sync');
    const { db } = await import('@/server/db/client');
    const t = await import('@/server/db/schema');

    // The M House already on the site: The Icon, BSD, by SE Design Studio.
    const se = createPartner({ name: 'SE Design Studio', kind: 'design', instagram: 'se.designstudio', website: null });
    const bsd = createProject({
      name: 'M House', category: 'residential', typeLabel: null, location: 'The Icon, Cluster Cosmo, BSD', year: '2021', service: 'Build',
      inHouse: false, description: null, status: 'published', featured: false, sortDate: '2021-10-08', designers: [se], photographers: [],
    });
    await addPhoto(bsd, jpeg, { source: 'upload' });
    setInstagram({ token: 'test-token', importSince: '2026-06-15T00:00:00.000Z', autoPublish: true });

    const first = await runSync('manual');
    expect(first).toMatchObject({ ok: true, seen: 3, imported: 2, pending: 0 });

    const houses = db.select().from(t.projects).all().filter((p) => p.name === 'M House');
    expect(houses).toHaveLength(2);
    const greenlake = houses.find((p) => p.location === 'Greenlake City')!;
    expect(greenlake.status).toBe('published');
    expect(greenlake.source).toBe('instagram');
    const greenPhotos = db.select().from(t.media).all().filter((m) => m.projectId === greenlake.id);
    expect(greenPhotos).toHaveLength(2); // the video in the carousel is left out

    // The later BSD post landed in the existing project, not in a new one.
    const bsdPhotos = db.select().from(t.media).all().filter((m) => m.projectId === bsd);
    expect(bsdPhotos).toHaveLength(2);

    const greet = db.select().from(t.igPosts).all().find((p) => p.shortcode === 'TESTgreet')!;
    expect(greet.status).toBe('not_project');

    // Credits: the designer handle became a partner waiting for a real name.
    const beta = db.select().from(t.partners).all().find((p) => p.instagram === 'beta.design.studio')!;
    expect(beta.needsReview).toBe(true);

    // A second run finds nothing new.
    const second = await runSync('manual');
    expect(second).toMatchObject({ ok: true, seen: 0, imported: 0 });
  });
});
