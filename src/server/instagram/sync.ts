import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { igPosts, igSyncRuns, partners, projectPartners, projects } from '../db/schema';
import { addPhoto, createProject } from '../admin/projects';
import { createPartner, partnerForHandle } from '../admin/partners';
import { getInstagram, setInstagram } from '../settings';
import { download, getMedia, InstagramError, listMedia, refreshToken, shortcodeOf, type IgMedia } from './api';
import { categoryFromType, inProgress, parseCaption, sameName, samePlace, serviceFrom, type Credit, type ParsedCaption } from './caption';
import { plainDashes } from '../legacy/parse';

// New Instagram posts become projects on the site. A post that cannot be placed with certainty waits
// in the dashboard's inbox instead of guessing: the old scraper merged two different "M House"
// projects because it matched on the name alone.

export type Candidate = { id: string; name: string; location: string | null; designerHandles: string[] };
export type Decision =
  | { action: 'skip'; note: string }
  | { action: 'pending'; note: string }
  | { action: 'append'; projectId: string }
  | { action: 'create' };

export function decide(parsed: ParsedCaption, post: { timestamp: string; hasImages: boolean }, ctx: { importSince: string | null; projects: Candidate[] }): Decision {
  if (!parsed.name) return { action: 'skip', note: 'No "Client :" line: not a project post' };
  if (!post.hasImages) return { action: 'pending', note: 'Video only: no photographs to import' };
  if (inProgress(parsed.status)) return { action: 'pending', note: `Status "${parsed.status}": work in progress` };
  if (ctx.importSince && post.timestamp < ctx.importSince) return { action: 'pending', note: 'Posted before the automatic import started' };
  if (!categoryFromType(parsed.type)) return { action: 'pending', note: parsed.type ? `Type "${parsed.type}" not recognised` : 'No "Type :" line' };

  const same = ctx.projects.filter((p) => sameName(p.name, parsed.name!));
  if (!same.length) return { action: 'create' };
  const handles = parsed.designers.map((d) => d.handle).filter((h): h is string => !!h);
  const verdicts = same.map((p) => {
    const place = samePlace(parsed.location, p.location);
    const designer = handles.length && p.designerHandles.length ? handles.some((h) => p.designerHandles.includes(h)) : null;
    if (place === true && designer !== false) return { p, v: 'same' as const };
    if (place === null && designer === true) return { p, v: 'same' as const };
    if (place === false || (place === null && designer === false)) return { p, v: 'different' as const };
    return { p, v: 'unsure' as const };
  });
  const matches = verdicts.filter((x) => x.v === 'same');
  if (matches.length === 1) return { action: 'append', projectId: matches[0].p.id };
  if (matches.length > 1) return { action: 'pending', note: `Matches ${matches.length} projects named ${parsed.name}` };
  if (verdicts.every((x) => x.v === 'different')) return { action: 'create' }; // same name, another place
  return { action: 'pending', note: `Same name as an existing project; location or designer does not confirm it` };
}

function candidates(): Candidate[] {
  const rows = db.select({ id: projects.id, name: projects.name, location: projects.location }).from(projects).all();
  const handles = new Map<string, string[]>();
  for (const r of db.select({ projectId: projectPartners.projectId, instagram: partners.instagram }).from(projectPartners)
    .innerJoin(partners, eq(partners.id, projectPartners.partnerId)).where(eq(projectPartners.role, 'design')).all()) {
    if (r.instagram) handles.set(r.projectId, [...(handles.get(r.projectId) ?? []), r.instagram]);
  }
  return rows.map((r) => ({ ...r, designerHandles: handles.get(r.id) ?? [] }));
}

function creditIds(credits: Credit[], kind: 'design' | 'photo') {
  const ids: string[] = [];
  for (const c of credits) {
    let id: string | null = null;
    if (c.handle) id = partnerForHandle(c.handle, kind);
    else if (c.name) {
      id = db.select({ id: partners.id }).from(partners).where(sql`lower(${partners.name}) = ${c.name.toLowerCase()}`).get()?.id
        ?? createPartner({ name: c.name, kind, instagram: null, website: null }, true);
    }
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function imagesOf(m: IgMedia) {
  if (m.media_type === 'CAROUSEL_ALBUM') return (m.children?.data ?? []).filter((c) => c.media_type === 'IMAGE' && c.media_url).map((c) => c.media_url!);
  if (m.media_type === 'IMAGE' && m.media_url) return [m.media_url];
  return [];
}

async function importImages(projectId: string, m: IgMedia, shortcode: string) {
  let added = 0;
  const urls = imagesOf(m);
  for (const [i, url] of urls.entries()) {
    const id = await addPhoto(projectId, await download(url), {
      source: 'instagram', igMediaId: m.id, igShortcode: shortcode, igIndex: i, takenAt: m.timestamp,
    });
    if (id) added++;
  }
  return added;
}

/** Creates the project (or uses `intoId`), downloads the photographs, records the post as imported. */
export async function importPost(m: IgMedia, parsed: ParsedCaption, intoId: string | null, overrides: Partial<{ name: string; location: string | null; category: 'residential' | 'fnb' | 'commercial'; year: string | null }> = {}) {
  const shortcode = shortcodeOf(m)!;
  const date = m.timestamp.slice(0, 10);
  let projectId = intoId;
  if (!projectId) {
    const cat = overrides.category ? { category: overrides.category, typeLabel: categoryFromType(parsed.type)?.typeLabel ?? null } : categoryFromType(parsed.type);
    if (!cat) throw new Error('Choose a category');
    // Visible text carries no em or en dashes (captions often do: "The Icon - Cluster Cosmo, BSD").
    const location = overrides.location !== undefined ? overrides.location : parsed.location;
    const year = overrides.year !== undefined ? overrides.year : parsed.year ?? date.slice(0, 4);
    projectId = createProject({
      name: plainDashes(overrides.name ?? parsed.name ?? 'Untitled'), category: cat.category, typeLabel: cat.typeLabel,
      location: location ? plainDashes(location) : null,
      year: year ? plainDashes(year) : null,
      service: serviceFrom(parsed.service) ?? 'Build', inHouse: parsed.inHouse, description: null,
      status: getInstagram().autoPublish ? 'published' : 'draft', featured: false, sortDate: date,
      designers: creditIds(parsed.designers, 'design'), photographers: creditIds(parsed.photographers, 'photo'),
    }, 'instagram');
  } else {
    // Credits named in a later post join the project; a newer post moves it up the list.
    for (const [kind, list] of [['design', parsed.designers], ['photo', parsed.photographers]] as const) {
      for (const partnerId of creditIds(list, kind)) {
        db.insert(projectPartners).values({ projectId, partnerId, role: kind, position: 50 }).onConflictDoNothing().run();
      }
    }
    db.update(projects).set({ sortDate: sql`max(${projects.sortDate}, ${date})`, updatedAt: new Date().toISOString() }).where(eq(projects.id, projectId)).run();
  }
  const added = await importImages(projectId, m, shortcode);
  db.insert(igPosts).values({
    shortcode, igMediaId: m.id, permalink: m.permalink, caption: m.caption ?? null, postedAt: m.timestamp, mediaType: m.media_type,
    status: 'imported', projectId, parsed, importedAt: new Date().toISOString(), note: `${added} photograph${added === 1 ? '' : 's'}`,
  }).onConflictDoUpdate({ target: igPosts.shortcode, set: { status: 'imported', projectId, importedAt: new Date().toISOString(), note: `${added} photograph${added === 1 ? '' : 's'}`, igMediaId: m.id } }).run();
  return { projectId, added };
}

let running: Promise<SyncSummary> | null = null;
export type SyncSummary = { ok: boolean; seen: number; imported: number; pending: number; message: string };

/** One pass over the newest posts. Never runs twice at the same time. */
export function runSync(trigger: 'schedule' | 'manual'): Promise<SyncSummary> {
  if (running) return running;
  running = doSync(trigger).finally(() => { running = null; });
  return running;
}

async function doSync(trigger: 'schedule' | 'manual'): Promise<SyncSummary> {
  const state = getInstagram();
  if (!state.token) return { ok: false, seen: 0, imported: 0, pending: 0, message: 'Instagram is not connected' };
  const runId = db.insert(igSyncRuns).values({ startedAt: new Date().toISOString(), trigger }).returning({ id: igSyncRuns.id }).get().id;
  const sum: SyncSummary = { ok: true, seen: 0, imported: 0, pending: 0, message: '' };
  try {
    // A failed renewal is not fatal: the current token may still be valid for weeks.
    await maybeRefresh().catch(() => {});
    const token = getInstagram().token!;
    const known = new Set(db.select({ s: igPosts.shortcode }).from(igPosts).all().map((r) => r.s));
    let after: string | undefined;
    // The first run walks back through the whole account (at most 20 pages); later runs stop at the
    // first page that holds a post already seen.
    for (let page = 0; page < 20; page++) {
      const res = await listMedia(token, after);
      let sawKnown = false;
      for (const m of res.data) {
        const shortcode = shortcodeOf(m);
        if (!shortcode) continue;
        if (known.has(shortcode)) { sawKnown = true; continue; }
        known.add(shortcode);
        sum.seen++;
        const parsed = parseCaption(m.caption);
        const d = decide(parsed, { timestamp: m.timestamp, hasImages: imagesOf(m).length > 0 }, { importSince: state.importSince, projects: candidates() });
        const base = { shortcode, igMediaId: m.id, permalink: m.permalink, caption: m.caption ?? null, postedAt: m.timestamp, mediaType: m.media_type, parsed };
        if (d.action === 'skip') {
          db.insert(igPosts).values({ ...base, status: 'not_project', note: d.note }).onConflictDoNothing().run();
        } else if (d.action === 'pending') {
          db.insert(igPosts).values({ ...base, status: 'pending', note: d.note }).onConflictDoNothing().run();
          sum.pending++;
        } else {
          try {
            await importPost(m, parsed, d.action === 'append' ? d.projectId : null);
            sum.imported++;
          } catch (e) {
            db.insert(igPosts).values({ ...base, status: 'error', note: e instanceof Error ? e.message.slice(0, 200) : 'Import failed' }).onConflictDoNothing().run();
          }
        }
      }
      after = res.paging?.next ? res.paging.cursors?.after : undefined;
      if (sawKnown || !after) break;
    }
    sum.message = `${sum.seen} new post${sum.seen === 1 ? '' : 's'}`;
    setInstagram({ lastSyncAt: new Date().toISOString(), lastError: null });
  } catch (e) {
    sum.ok = false;
    sum.message = e instanceof InstagramError && e.expired ? 'The connection expired. Connect Instagram again.' : e instanceof Error ? e.message.slice(0, 200) : 'Sync failed';
    setInstagram({ lastSyncAt: new Date().toISOString(), lastError: sum.message });
  }
  db.update(igSyncRuns).set({ finishedAt: new Date().toISOString(), ok: sum.ok, seen: sum.seen, imported: sum.imported, pending: sum.pending, message: sum.message }).where(eq(igSyncRuns.id, runId)).run();
  return sum;
}

/** Long-lived tokens last 60 days; refresh when fewer than 14 remain. */
export async function maybeRefresh() {
  const s = getInstagram();
  if (!s.token) return;
  const left = s.expiresAt ? new Date(s.expiresAt).getTime() - Date.now() : 0;
  if (s.expiresAt && left > 14 * 86_400_000) return;
  const r = await refreshToken(s.token);
  setInstagram({ token: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000).toISOString() });
}

// ---------------------------------------------------------------------------------------------
// Inbox actions

export async function approvePost(shortcode: string, intoId: string | null, overrides: Parameters<typeof importPost>[3] = {}) {
  const post = db.select().from(igPosts).where(eq(igPosts.shortcode, shortcode)).get();
  const token = getInstagram().token;
  if (!post?.igMediaId) throw new Error('This post has no Instagram id; open it on Instagram and upload the photographs instead');
  if (!token) throw new Error('Instagram is not connected');
  const fresh = await getMedia(token, post.igMediaId); // image links expire, ask again
  return importPost(fresh, parseCaption(fresh.caption), intoId, overrides);
}

export function ignorePosts(shortcodes: string[]) {
  if (!shortcodes.length) return;
  db.update(igPosts).set({ status: 'ignored' }).where(and(inArray(igPosts.shortcode, shortcodes), sql`${igPosts.status} != 'imported'`)).run();
}

export function inbox() {
  return db.select().from(igPosts).where(inArray(igPosts.status, ['pending', 'error'])).orderBy(desc(igPosts.postedAt)).all();
}

export function recentPosts(limit = 30) {
  return db.select({ post: igPosts, projectName: projects.name }).from(igPosts).leftJoin(projects, eq(projects.id, igPosts.projectId))
    .where(inArray(igPosts.status, ['imported', 'ignored', 'not_project'])).orderBy(desc(igPosts.fetchedAt), desc(igPosts.postedAt)).limit(limit).all();
}
