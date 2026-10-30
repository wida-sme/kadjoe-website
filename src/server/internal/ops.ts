import { randomBytes } from 'node:crypto';
import { and, asc, eq, like, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { CATEGORIES, PROJECT_STATUSES, igPosts, partners, projects } from '../db/schema';
import * as P from '../admin/projects';
import * as R from '../admin/partners';
import { site } from '@/content/site';
import { authorizeUrl, getMe, InstagramError } from '../instagram/api';
import { approvePost, ignorePosts, inbox, recentPosts, runSync } from '../instagram/sync';
import { candidatesFor, defaultConfig } from '../profile/build';
import { clientsSchema, contactSchema, getClients, getContact, getInstagram, setInstagram, write as writeSetting } from '../settings';

// Everything the dashboard can read or change, as plain functions. The HTTP route and the legacy
// /admin server actions both call these; the callers own sign-in, caching and wording.

export type ErrorCode = 'invalid' | 'not_found' | 'duplicate_handle' | 'no_selection' | 'instagram_refused' | 'instagram_unreachable' | 'import_failed' | 'failed';
// `detail` is the old English message, kept only so /admin can show what it always showed; the route drops it.
export type OpResult = { ok: true; id?: string; message?: string; added?: number; skipped?: number } | { ok: false; code: ErrorCode; detail?: string };
const fail = (code: ErrorCode, detail?: string): OpResult => ({ ok: false, code, detail });
/** Shape the old dashboard actions return: the English message instead of a code. */
export const legacy = (r: OpResult) => (r.ok ? r : { ok: false as const, error: r.detail ?? 'Something went wrong' });
const first = (e: z.ZodError, fallback: string) => fail('invalid', e.issues[0]?.message ?? fallback);

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable();
const projectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  slug: z.string().trim().max(90).optional(),
  category: z.enum(CATEGORIES),
  typeLabel: text(60),
  location: text(160),
  year: text(20),
  service: text(60),
  inHouse: z.boolean(),
  description: text(1200),
  status: z.enum(PROJECT_STATUSES),
  featured: z.boolean(),
  sortDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  designers: z.array(z.string()).max(8),
  photographers: z.array(z.string()).max(8),
});
const ids = z.array(z.string().regex(/^[A-Za-z0-9_-]{12}$/)).min(1).max(500);
const partnerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  kind: z.enum(['design', 'photo']),
  instagram: z.string().trim().max(80).transform((v) => v || null).nullable(),
  website: z.union([z.literal(''), z.url()]).transform((v) => v || null).nullable(),
});
const approveSchema = z.object({
  shortcode: z.string().min(5).max(40),
  intoId: z.string().nullable(),
  name: z.string().trim().min(1).max(120).optional(),
  category: z.enum(CATEGORIES).optional(),
  location: z.string().trim().max(160).nullable().optional(),
  year: z.string().trim().max(20).nullable().optional(),
});
const str = z.string();
const obj = (b: unknown) => (b && typeof b === 'object' ? (b as Record<string, unknown>) : {});

const count = (q: { get: () => { n: number } | undefined }) => q.get()?.n ?? 0;
const n = sql<number>`count(*)`;

// ---------------------------------------------------------------------------------------------
// Reads

export const READ: Record<string, (params: URLSearchParams) => unknown> = {
  overview: () => ({
    published: count(db.select({ n }).from(projects).where(eq(projects.status, 'published'))),
    drafts: count(db.select({ n }).from(projects).where(eq(projects.status, 'draft'))),
    igPending: count(db.select({ n }).from(igPosts).where(eq(igPosts.status, 'pending'))),
    partnersReview: count(db.select({ n }).from(partners).where(eq(partners.needsReview, true))),
    igLastSync: getInstagram().lastSyncAt,
  }),
  'projects.list': (p) => {
    const category = CATEGORIES.find((c) => c === p.get('category')) ?? null;
    const status = PROJECT_STATUSES.find((s) => s === p.get('status')) ?? null;
    return P.listProjects({ q: p.get('q') ?? undefined, category, status });
  },
  'project.get': (p) => P.getProjectForEdit(p.get('id') ?? ''),
  'hero.get': (p) => ({
    hero: P.listHero(),
    featured: db.select({ id: projects.id, name: projects.name, coverId: projects.coverId, status: projects.status })
      .from(projects).where(eq(projects.featured, true)).orderBy(asc(projects.featuredOrder)).all(),
    candidates: P.heroCandidates(p.get('q') ?? ''),
  }),
  'partners.list': () => R.listPartners(),
  'contact.get': () => ({ contact: getContact(), clients: getClients() }),
  'instagram.get': () => {
    const s = getInstagram();
    return {
      connected: !!s.token, username: s.username, autoPublish: s.autoPublish, importSince: s.importSince,
      expiresAt: s.expiresAt, lastError: s.lastError,
      appReady: !!process.env.IG_APP_ID && !!process.env.IG_APP_SECRET,
      inbox: inbox(), recent: recentPosts(20),
    };
  },
  'profile.defaults': () => ({
    config: defaultConfig(),
    candidates: Object.fromEntries(CATEGORIES.map((c) => [c, candidatesFor(c)])),
  }),
};

// ---------------------------------------------------------------------------------------------
// Writes

const MAX_UPLOAD = 30 * 1024 * 1024;

export const WRITE: Record<string, (body: unknown | FormData) => Promise<OpResult>> = {
  'project.save': async (b) => {
    const { id, input } = obj(b);
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) return first(parsed.error, 'Check the form');
    if (id) {
      if (typeof id !== 'string' || !db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).get()) return fail('not_found');
      P.updateProject(id, parsed.data);
      return { ok: true, id, message: 'Saved' };
    }
    return { ok: true, id: P.createProject(parsed.data), message: 'Created' };
  },

  'project.flags': async (b) => {
    const { id, patch } = obj(b);
    const s = z.object({ status: z.enum(PROJECT_STATUSES).optional(), featured: z.boolean().optional() }).safeParse(patch);
    if (!s.success || typeof id !== 'string') return fail('invalid', 'Invalid change');
    P.setProjectFlags(id, s.data);
    return { ok: true };
  },

  'project.delete': async (b) => {
    const { id } = obj(b);
    if (typeof id !== 'string') return fail('invalid');
    P.deleteProject(id);
    return { ok: true };
  },

  'photos.op': async (b) => {
    const { projectId, op, photoIds } = obj(b);
    const list = ids.safeParse(photoIds);
    if (!list.success) return fail('no_selection', 'Select photographs first');
    const o = z.enum(['order', 'cover', 'hide', 'show', 'delete', 'hero']).safeParse(op);
    if (!o.success || typeof projectId !== 'string') return fail('invalid');
    if (o.data === 'order') P.reorderPhotos(projectId, list.data);
    else if (o.data === 'cover') P.setCover(projectId, list.data[0]);
    else if (o.data === 'hide') P.setPhotosHidden(projectId, list.data, true);
    else if (o.data === 'show') P.setPhotosHidden(projectId, list.data, false);
    else if (o.data === 'delete') P.deletePhotos(projectId, list.data);
    else list.data.forEach(P.addHero);
    return { ok: true };
  },

  'photos.move': async (b) => {
    const { fromId, photoIds, toId } = obj(b);
    const list = ids.safeParse(photoIds);
    if (!list.success) return fail('no_selection', 'Select photographs first');
    if (typeof fromId !== 'string' || typeof toId !== 'string') return fail('invalid');
    P.movePhotos(fromId, list.data, toId);
    return { ok: true, id: toId, message: 'Moved' };
  },

  'project.split': async (b) => {
    const { fromId, photoIds, name } = obj(b);
    const list = ids.safeParse(photoIds);
    const nm = z.string().trim().min(1).max(120).safeParse(name);
    if (!list.success) return fail('no_selection', 'Select photographs first');
    if (!nm.success || typeof fromId !== 'string') return fail('invalid', 'Name the new project');
    return { ok: true, id: P.splitProject(fromId, list.data, nm.data), message: 'New project created as a draft' };
  },

  'project.merge': async (b) => {
    const { fromId, intoId } = obj(b);
    if (typeof fromId !== 'string' || typeof intoId !== 'string') return fail('invalid');
    P.mergeProjects(fromId, intoId);
    return { ok: true, id: intoId };
  },

  'photo.update': async (b) => {
    const { mediaId, patch } = obj(b);
    const s = z.object({
      alt: z.string().trim().max(200).transform((v) => v || null).nullable().optional(),
      focalX: z.number().min(0).max(1).optional(),
      focalY: z.number().min(0).max(1).optional(),
    }).safeParse(patch);
    if (!s.success || typeof mediaId !== 'string') return fail('invalid', 'Invalid value');
    P.updatePhoto(mediaId, s.data);
    return { ok: true };
  },

  'photos.upload': async (b) => {
    if (!(b instanceof FormData)) return fail('invalid');
    const projectId = b.get('projectId');
    if (typeof projectId !== 'string' || !projectId) return fail('invalid');
    const files = b.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return fail('no_selection', 'Choose photographs');
    let added = 0, skipped = 0;
    for (const f of files) {
      if (f.size > MAX_UPLOAD || !/^image\//.test(f.type)) { skipped++; continue; }
      try {
        const id = await P.addPhoto(projectId, Buffer.from(await f.arrayBuffer()), { source: 'upload', originalName: f.name });
        if (id) added++; else skipped++;
      } catch { skipped++; }
    }
    return { ok: true, added, skipped, message: skipped ? `${added} added, ${skipped} skipped` : `${added} added` };
  },

  'hero.op': async (b) => {
    const { op, values } = obj(b);
    const list = ids.safeParse(values);
    if (!list.success) return fail('no_selection', 'Nothing selected');
    const o = z.enum(['add', 'remove', 'order']).safeParse(op);
    if (!o.success) return fail('invalid');
    if (o.data === 'add') list.data.forEach(P.addHero);
    else if (o.data === 'remove') list.data.forEach(P.removeHero);
    else P.reorderHero(list.data);
    return { ok: true };
  },

  'featured.order': async (b) => {
    const list = ids.safeParse(obj(b).values);
    if (!list.success) return fail('no_selection', 'Nothing selected');
    P.reorderFeatured(list.data);
    return { ok: true };
  },

  'partner.save': async (b) => {
    const { id, input } = obj(b);
    const s = partnerSchema.safeParse(input);
    if (!s.success) return first(s.error, 'Check the form');
    try {
      if (id) {
        if (typeof id !== 'string' || !db.select({ id: partners.id }).from(partners).where(eq(partners.id, id)).get()) return fail('not_found');
        R.updatePartner(id, s.data);
        return { ok: true, id, message: 'Saved' };
      }
      return { ok: true, id: R.createPartner(s.data), message: 'Saved' };
    } catch (e) {
      return String(e).includes('UNIQUE') ? fail('duplicate_handle', 'That Instagram handle is already used') : fail('failed', 'Could not save');
    }
  },

  'partner.merge': async (b) => {
    const { fromId, intoId } = obj(b);
    if (typeof fromId !== 'string' || typeof intoId !== 'string') return fail('invalid');
    R.mergePartners(fromId, intoId);
    return { ok: true };
  },

  'partner.delete': async (b) => {
    const { id } = obj(b);
    if (typeof id !== 'string') return fail('invalid');
    R.deletePartner(id);
    return { ok: true };
  },

  'contact.save': async (b) => {
    const s = contactSchema.safeParse(obj(b).input);
    if (!s.success) return first(s.error, 'Check the form');
    writeSetting('contact', s.data);
    return { ok: true, message: 'Saved' };
  },

  'clients.save': async (b) => {
    const list = z.array(str).safeParse(obj(b).list);
    const s = clientsSchema.safeParse(list.success ? list.data.map((x) => x.trim()).filter(Boolean) : null);
    if (!s.success) return fail('invalid', 'Check the list');
    writeSetting('clients', s.data);
    return { ok: true, message: 'Saved' };
  },

  'instagram.sync': async () => {
    const r = await runSync('manual');
    return r.ok ? { ok: true, message: `${r.message}: ${r.imported} imported, ${r.pending} waiting` } : fail('failed', r.message);
  },

  /** For a long-lived token generated in the Meta app dashboard (Instagram > API setup > Generate token). */
  'instagram.token': async (b) => {
    const t = str.safeParse(obj(b).token);
    if (!t.success || t.data.trim().length < 20) return fail('invalid', 'Paste the whole token');
    const token = t.data.trim();
    try {
      const me = await getMe(token);
      setInstagram({
        token, userId: me.user_id ?? me.id, username: me.username, connectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 59 * 86_400_000).toISOString(), lastError: null,
      });
      return { ok: true, message: `Connected as @${me.username}` };
    } catch (e) {
      return e instanceof InstagramError
        ? fail('instagram_refused', `Instagram refused the token: ${e.message}`)
        : fail('instagram_unreachable', 'Could not reach Instagram');
    }
  },

  /** Starts the OAuth flow; the state lives in settings and is checked once by /api/instagram/callback. */
  'instagram.authorizeUrl': async () => {
    const appId = process.env.IG_APP_ID;
    if (!appId || !process.env.IG_APP_SECRET) return fail('invalid', 'Instagram app is not set up');
    const state = randomBytes(32).toString('base64url');
    setInstagram({ oauthState: state, oauthStateAt: new Date().toISOString() });
    return { ok: true, message: authorizeUrl(appId, `${site.url}/api/instagram/callback`, state) };
  },

  'instagram.disconnect': async () => {
    setInstagram({ token: null, userId: null, username: null, expiresAt: null, connectedAt: null });
    return { ok: true, message: 'Disconnected' };
  },

  'instagram.options': async (b) => {
    const s = z.object({ autoPublish: z.boolean(), importSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).safeParse(b);
    if (!s.success) return fail('invalid', 'Check the date');
    setInstagram({ autoPublish: s.data.autoPublish, importSince: s.data.importSince ? `${s.data.importSince}T00:00:00.000Z` : null });
    return { ok: true, message: 'Saved' };
  },

  'instagram.approve': async (b) => {
    const s = approveSchema.safeParse(b);
    if (!s.success) return first(s.error, 'Check the form');
    try {
      const { shortcode, intoId, ...overrides } = s.data;
      const r = await approvePost(shortcode, intoId, overrides);
      return { ok: true, id: r.projectId, message: `${r.added} photograph${r.added === 1 ? '' : 's'} imported` };
    } catch (e) {
      return fail('import_failed', e instanceof Error ? e.message.slice(0, 200) : 'Import failed');
    }
  },

  'instagram.ignore': async (b) => {
    const list = z.array(str).safeParse(obj(b).shortcodes);
    if (!list.success) return fail('invalid');
    ignorePosts(list.data.filter((s) => /^[A-Za-z0-9_-]{5,40}$/.test(s)));
    return { ok: true, message: 'Ignored' };
  },

  'instagram.ignoreOlder': async () => {
    db.update(igPosts).set({ status: 'ignored' }).where(and(eq(igPosts.status, 'pending'), like(igPosts.note, 'Posted before%'))).run();
    return { ok: true, message: 'Older posts ignored' };
  },
};
