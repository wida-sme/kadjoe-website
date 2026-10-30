// The finance app's API: token check, op routing and a few real writes against a temporary database.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kadjoe-internal-'));
process.env.KADJOE_SITE_DATA_DIR = dir;
process.env.KADJOE_SITE_MIGRATIONS_DIR = path.resolve('drizzle');
process.env.SITE_ADMIN_TOKEN = 'test-token';

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const auth = { authorization: 'Bearer test-token' };
const ctx = (op: string) => ({ params: Promise.resolve({ op }) });
const get = async (op: string, qs = '', headers: Record<string, string> = auth) => {
  const { GET } = await import('@/app/api/internal/[op]/route');
  return GET(new Request(`http://x/api/internal/${op}${qs}`, { headers }), ctx(op));
};
const post = async (op: string, body: unknown, headers: Record<string, string> = auth) => {
  const { POST } = await import('@/app/api/internal/[op]/route');
  const isForm = body instanceof FormData;
  return POST(new Request(`http://x/api/internal/${op}`, {
    method: 'POST', headers: isForm ? headers : { ...headers, 'content-type': 'application/json' }, body: isForm ? body : JSON.stringify(body),
  }), ctx(op));
};

const project = (name: string) => ({
  name, category: 'residential', typeLabel: null, location: 'Jakarta', year: '2026', service: null, inHouse: false,
  description: null, status: 'draft', featured: false, sortDate: '2026-10-01', designers: [], photographers: [],
});

describe('internal api', () => {
  it('rejects a missing, wrong or empty token', async () => {
    expect((await get('overview', '', {})).status).toBe(401);
    expect((await get('overview', '', { authorization: 'Bearer wrong' })).status).toBe(401);
    process.env.SITE_ADMIN_TOKEN = '';
    expect((await get('overview', '', { authorization: 'Bearer ' })).status).toBe(401);
    process.env.SITE_ADMIN_TOKEN = 'test-token';
    expect((await get('overview')).status).toBe(200);
  });

  it('404s an unknown op', async () => {
    expect((await get('nope')).status).toBe(404);
    expect((await post('nope', {})).status).toBe(404);
  });

  it('refuses an invalid project and saves a valid one', async () => {
    const r = await post('project.save', { id: null, input: project('') });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, code: 'invalid' });

    const ok = await post('project.save', { id: null, input: project('Rumah Uji') });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBeTruthy();
    const list = await (await get('projects.list', '?q=Uji')).json();
    expect(list.map((p: { id: string }) => p.id)).toContain(body.id);
    expect(await (await get('overview')).json()).toMatchObject({ drafts: 1, published: 0, igPending: 0 });
  });

  it('reports a taken instagram handle as duplicate_handle', async () => {
    const mk = (name: string) => ({ id: null, input: { name, kind: 'design', instagram: 'same.handle', website: '' } });
    expect((await post('partner.save', mk('Studio A'))).status).toBe(200);
    const r = await post('partner.save', mk('Studio B'));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, code: 'duplicate_handle' });
  });

  it('uploads a photograph by multipart', async () => {
    const created = await (await post('project.save', { id: null, input: project('Rumah Foto') })).json();
    const jpeg = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#c33' } }).jpeg().toBuffer();
    const form = new FormData();
    form.set('projectId', created.id);
    form.append('files', new File([new Uint8Array(jpeg)], 'a.jpg', { type: 'image/jpeg' }));
    const r = await post('photos.upload', form);
    expect(await r.json()).toMatchObject({ ok: true, added: 1, skipped: 0 });
    const got = await (await get('project.get', `?id=${created.id}`)).json();
    expect(got.photos).toHaveLength(1);
    expect((await get('project.get', '?id=missing')).status).toBe(404);
  });

  it('returns 500 failed when a read throws', async () => {
    const { READ } = await import('@/server/internal/ops');
    READ.boom = () => { throw new Error('x'); };
    const err = console.error; console.error = () => {};
    const r = await get('boom');
    console.error = err; delete READ.boom;
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false, code: 'failed' });
  });

  describe('instagram connect', () => {
    const callback = async (qs: string) => {
      const { GET } = await import('@/app/api/instagram/callback/route');
      return GET(new Request(`http://x/api/instagram/callback${qs}`));
    };
    const settings = () => import('@/server/settings');

    it('refuses without the Meta app keys', async () => {
      delete process.env.IG_APP_ID; delete process.env.IG_APP_SECRET;
      const r = await post('instagram.authorizeUrl', {});
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ ok: false, code: 'invalid' });
    });

    it('stores the state it puts in the authorize URL', async () => {
      process.env.IG_APP_ID = 'app'; process.env.IG_APP_SECRET = 'secret';
      const j = await (await post('instagram.authorizeUrl', {})).json();
      const state = new URL(j.message).searchParams.get('state');
      expect(state).toBeTruthy();
      expect((await settings()).getInstagram().oauthState).toBe(state);
    });

    it('sends a callback with a wrong, stale or missing state back to the finance app', async () => {
      process.env.FINANCE_URL = 'https://fin.test';
      const { getInstagram, setInstagram } = await settings();
      const state = getInstagram().oauthState!;
      const wrong = await callback('?code=c&state=nope');
      expect(wrong.headers.get('location')).toBe('https://fin.test/website/instagram?error=state');
      setInstagram({ oauthState: state, oauthStateAt: new Date(Date.now() - 11 * 60_000).toISOString() });
      expect((await callback(`?code=c&state=${state}`)).headers.get('location')).toBe('https://fin.test/website/instagram?error=state');
      expect(getInstagram().oauthState).toBeNull(); // used once, whatever the outcome
      expect((await callback(`?code=c&state=${state}`)).headers.get('location')).toBe('https://fin.test/website/instagram?error=state');
    });

    it('falls back to /admin/instagram without FINANCE_URL', async () => {
      delete process.env.FINANCE_URL;
      expect(new URL((await callback('?code=c&state=x')).headers.get('location')!).pathname).toBe('/admin/instagram');
    });
  });
});
