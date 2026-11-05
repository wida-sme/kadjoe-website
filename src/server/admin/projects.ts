import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { db, tx } from '../db/client';
import { heroSlides, igPosts, media, partners, projectPartners, projects, type Category, type ProjectStatus } from '../db/schema';
import { newId, slugify } from '../ids';
import { hashDistance, removeMediaFiles, writeMaster } from '../media/process';

// Write side of projects and their photographs, used by the dashboard and the Instagram import.

export type ProjectInput = {
  name: string;
  slug?: string;
  category: Category;
  typeLabel: string | null;
  location: string | null;
  year: string | null;
  service: string | null;
  inHouse: boolean;
  description: string | null;
  status: ProjectStatus;
  featured: boolean;
  sortDate: string;
  designers: string[]; // partner ids, in order
  photographers: string[];
};

export function uniqueProjectSlug(base: string, exceptId?: string) {
  const root = slugify(base);
  for (let n = 1; ; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    const hit = db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).get();
    if (!hit || hit.id === exceptId) return slug;
  }
}

export function listProjects(filter: { q?: string; category?: Category | null; status?: ProjectStatus | null } = {}) {
  const where = [];
  if (filter.q) {
    const q = `%${filter.q.trim()}%`;
    where.push(or(like(projects.name, q), like(projects.location, q), like(projects.slug, q)));
  }
  if (filter.category) where.push(eq(projects.category, filter.category));
  if (filter.status) where.push(eq(projects.status, filter.status));
  const rows = db.select({
    id: projects.id, slug: projects.slug, name: projects.name, category: projects.category, location: projects.location,
    year: projects.year, status: projects.status, featured: projects.featured, coverId: projects.coverId,
    source: projects.source, sortDate: projects.sortDate,
    photos: sql<number>`(select count(*) from media m where m.project_id = projects.id)`,
  }).from(projects).where(where.length ? and(...where) : undefined).orderBy(desc(projects.sortDate), asc(projects.name)).all();
  const designers = new Map<string, string[]>();
  if (rows.length) {
    for (const r of db.select({ projectId: projectPartners.projectId, name: partners.name }).from(projectPartners)
      .innerJoin(partners, eq(partners.id, projectPartners.partnerId))
      .where(and(eq(projectPartners.role, 'design'), inArray(projectPartners.projectId, rows.map((x) => x.id))))
      .orderBy(asc(projectPartners.position)).all()) {
      designers.set(r.projectId, [...(designers.get(r.projectId) ?? []), r.name]);
    }
  }
  return rows.map((r) => ({ ...r, designers: designers.get(r.id) ?? [] }));
}

export function getProjectForEdit(id: string) {
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return null;
  const photos = db.select().from(media).where(eq(media.projectId, id)).orderBy(asc(media.position)).all();
  const credits = db.select({ partnerId: projectPartners.partnerId, role: projectPartners.role }).from(projectPartners)
    .where(eq(projectPartners.projectId, id)).orderBy(asc(projectPartners.position)).all();
  const posts = db.select().from(igPosts).where(eq(igPosts.projectId, id)).orderBy(desc(igPosts.postedAt)).all();
  const hero = new Set(db.select({ mediaId: heroSlides.mediaId }).from(heroSlides).all().map((h) => h.mediaId));
  return {
    project,
    photos: photos.map((p) => ({ ...p, inHero: hero.has(p.id) })),
    designers: credits.filter((c) => c.role === 'design').map((c) => c.partnerId),
    photographers: credits.filter((c) => c.role === 'photo').map((c) => c.partnerId),
    posts,
  };
}

function writeCredits(projectId: string, designers: string[], photographers: string[]) {
  db.delete(projectPartners).where(eq(projectPartners.projectId, projectId)).run();
  designers.forEach((partnerId, position) => db.insert(projectPartners).values({ projectId, partnerId, role: 'design', position }).onConflictDoNothing().run());
  photographers.forEach((partnerId, position) => db.insert(projectPartners).values({ projectId, partnerId, role: 'photo', position }).onConflictDoNothing().run());
}

export function createProject(input: ProjectInput, source: 'manual' | 'instagram' = 'manual') {
  const id = newId();
  tx(() => {
    db.insert(projects).values({
      id, slug: uniqueProjectSlug(input.slug || input.name), name: input.name, category: input.category,
      typeLabel: input.typeLabel, location: input.location, year: input.year, service: input.service,
      inHouse: input.inHouse, description: input.description, status: input.status, featured: input.featured,
      sortDate: input.sortDate, source,
    }).run();
    writeCredits(id, input.designers, input.photographers);
  });
  return id;
}

export function updateProject(id: string, input: ProjectInput) {
  tx(() => {
    db.update(projects).set({
      slug: uniqueProjectSlug(input.slug || input.name, id), name: input.name, category: input.category,
      typeLabel: input.typeLabel, location: input.location, year: input.year, service: input.service,
      inHouse: input.inHouse, description: input.description, status: input.status, featured: input.featured,
      sortDate: input.sortDate, updatedAt: new Date().toISOString(),
    }).where(eq(projects.id, id)).run();
    writeCredits(id, input.designers, input.photographers);
  });
}

export function setProjectFlags(id: string, patch: { status?: ProjectStatus; featured?: boolean }) {
  db.update(projects).set({ ...patch, updatedAt: new Date().toISOString() }).where(eq(projects.id, id)).run();
}

export function reorderFeatured(ids: string[]) {
  tx(() => ids.forEach((id, i) => db.update(projects).set({ featuredOrder: i }).where(eq(projects.id, id)).run()));
}

/** Deletes the project and its photographs (files included). Instagram posts stay known, so the
 *  next sync does not bring the project back. */
export function deleteProject(id: string) {
  const ids = db.select({ id: media.id }).from(media).where(eq(media.projectId, id)).all().map((m) => m.id);
  tx(() => {
    db.update(igPosts).set({ status: 'ignored', note: 'Project deleted in the dashboard' }).where(eq(igPosts.projectId, id)).run();
    if (ids.length) db.delete(media).where(inArray(media.id, ids)).run();
    db.delete(projects).where(eq(projects.id, id)).run();
  });
  ids.forEach(removeMediaFiles);
}

// ---------------------------------------------------------------------------------------------
// Photographs

function renumber(projectId: string) {
  const rows = db.select({ id: media.id }).from(media).where(eq(media.projectId, projectId)).orderBy(asc(media.position), asc(media.createdAt)).all();
  rows.forEach((r, i) => db.update(media).set({ position: i }).where(eq(media.id, r.id)).run());
}

/** Keeps the cover valid: an existing, visible photograph of the project, or the first one. */
function fixCover(projectId: string) {
  const p = db.select({ coverId: projects.coverId }).from(projects).where(eq(projects.id, projectId)).get();
  if (!p) return;
  const visible = db.select({ id: media.id }).from(media).where(and(eq(media.projectId, projectId), eq(media.hidden, false))).orderBy(asc(media.position)).all();
  if (!p.coverId || !visible.some((v) => v.id === p.coverId)) {
    db.update(projects).set({ coverId: visible[0]?.id ?? null }).where(eq(projects.id, projectId)).run();
  }
}

export function reorderPhotos(projectId: string, ids: string[]) {
  tx(() => {
    ids.forEach((id, i) => db.update(media).set({ position: i }).where(and(eq(media.id, id), eq(media.projectId, projectId))).run());
  });
}

export function setCover(projectId: string, mediaId: string) {
  const ok = db.select({ id: media.id }).from(media).where(and(eq(media.id, mediaId), eq(media.projectId, projectId))).get();
  if (ok) db.update(projects).set({ coverId: mediaId, updatedAt: new Date().toISOString() }).where(eq(projects.id, projectId)).run();
}

export function setPhotosHidden(projectId: string, ids: string[], hidden: boolean) {
  tx(() => {
    db.update(media).set({ hidden }).where(and(inArray(media.id, ids), eq(media.projectId, projectId))).run();
    fixCover(projectId);
  });
}

export function updatePhoto(id: string, patch: { alt?: string | null; focalX?: number; focalY?: number }) {
  db.update(media).set(patch).where(eq(media.id, id)).run();
}

export function deletePhotos(projectId: string, ids: string[]) {
  const own = db.select({ id: media.id }).from(media).where(and(inArray(media.id, ids), eq(media.projectId, projectId))).all().map((m) => m.id);
  tx(() => {
    if (own.length) db.delete(media).where(inArray(media.id, own)).run();
    renumber(projectId);
    fixCover(projectId);
  });
  own.forEach(removeMediaFiles);
}

/** Moves photographs to another project (appended at the end, in their current order). */
export function movePhotos(fromId: string, ids: string[], toId: string) {
  tx(() => {
    const moving = db.select({ id: media.id }).from(media).where(and(inArray(media.id, ids), eq(media.projectId, fromId))).orderBy(asc(media.position)).all();
    const start = db.select({ n: sql<number>`coalesce(max(${media.position}), -1)` }).from(media).where(eq(media.projectId, toId)).get()?.n ?? -1;
    moving.forEach((m, i) => db.update(media).set({ projectId: toId, position: start + 1 + i }).where(eq(media.id, m.id)).run());
    // The Instagram posts these photographs came from follow them.
    const codes = db.select({ code: media.igShortcode }).from(media).where(inArray(media.id, moving.map((m) => m.id))).all().map((r) => r.code).filter((c): c is string => !!c);
    for (const code of new Set(codes)) {
      const left = db.select({ n: sql<number>`count(*)` }).from(media).where(and(eq(media.igShortcode, code), eq(media.projectId, fromId))).get()?.n ?? 0;
      if (!left) db.update(igPosts).set({ projectId: toId }).where(eq(igPosts.shortcode, code)).run();
    }
    renumber(fromId); renumber(toId);
    fixCover(fromId); fixCover(toId);
  });
}

/** Splits the selected photographs into a new project that starts with the same credits. Used for
 *  posts the old scraper merged, like the two M Houses. */
export function splitProject(fromId: string, ids: string[], name: string) {
  const from = db.select().from(projects).where(eq(projects.id, fromId)).get();
  if (!from) throw new Error('Project not found');
  const credits = db.select().from(projectPartners).where(eq(projectPartners.projectId, fromId)).all();
  const id = createProject({
    name, category: from.category, typeLabel: from.typeLabel, location: from.location, year: from.year,
    service: from.service, inHouse: from.inHouse, description: null, status: 'draft', featured: false,
    sortDate: from.sortDate,
    designers: credits.filter((c) => c.role === 'design').map((c) => c.partnerId),
    photographers: credits.filter((c) => c.role === 'photo').map((c) => c.partnerId),
  });
  movePhotos(fromId, ids, id);
  return id;
}

/** Moves every photograph of `fromId` into `toId`, joins the credits, deletes `fromId`. */
export function mergeProjects(fromId: string, toId: string) {
  if (fromId === toId) return;
  const all = db.select({ id: media.id }).from(media).where(eq(media.projectId, fromId)).all().map((m) => m.id);
  movePhotos(fromId, all, toId);
  tx(() => {
    const credits = db.select().from(projectPartners).where(eq(projectPartners.projectId, fromId)).all();
    for (const c of credits) db.insert(projectPartners).values({ ...c, projectId: toId, position: 99 }).onConflictDoNothing().run();
    db.update(igPosts).set({ projectId: toId }).where(eq(igPosts.projectId, fromId)).run();
    db.delete(projects).where(eq(projects.id, fromId)).run();
  });
}

/** Stores an uploaded or downloaded photograph for a project. Skips a near-duplicate of a photograph
 *  the project already has and returns null. */
export async function addPhoto(projectId: string | null, input: Buffer, meta: {
  source: 'upload' | 'instagram'; originalName?: string | null; igMediaId?: string | null; igShortcode?: string | null;
  igIndex?: number | null; takenAt?: string | null;
}) {
  const id = newId();
  const info = await writeMaster(id, input);
  if (projectId) {
    const hashes = db.select({ hash: media.hash }).from(media).where(eq(media.projectId, projectId)).all();
    if (hashes.some((h) => hashDistance(h.hash, info.hash) <= 3)) { removeMediaFiles(id); return null; }
  }
  tx(() => {
    const position = projectId
      ? (db.select({ n: sql<number>`coalesce(max(${media.position}), -1)` }).from(media).where(eq(media.projectId, projectId)).get()?.n ?? -1) + 1
      : 0;
    db.insert(media).values({ id, projectId, ...info, position, source: meta.source, originalName: meta.originalName ?? null,
      igMediaId: meta.igMediaId ?? null, igShortcode: meta.igShortcode ?? null, igIndex: meta.igIndex ?? null, takenAt: meta.takenAt ?? null }).run();
    if (projectId) fixCover(projectId);
  });
  return id;
}

// ---------------------------------------------------------------------------------------------
// Hero

export function listHero() {
  return db.select({
    id: heroSlides.id, position: heroSlides.position, mediaId: media.id, width: media.width, height: media.height,
    focalX: media.focalX, focalY: media.focalY, projectId: media.projectId, projectName: projects.name, projectStatus: projects.status,
  }).from(heroSlides).innerJoin(media, eq(media.id, heroSlides.mediaId)).leftJoin(projects, eq(projects.id, media.projectId))
    .orderBy(asc(heroSlides.position)).all();
}

export function addHero(mediaId: string) {
  const exists = db.select({ id: heroSlides.id }).from(heroSlides).where(eq(heroSlides.mediaId, mediaId)).get();
  if (exists) return;
  const n = db.select({ n: sql<number>`coalesce(max(${heroSlides.position}), -1)` }).from(heroSlides).get()?.n ?? -1;
  db.insert(heroSlides).values({ id: newId(), mediaId, position: n + 1 }).run();
}

export function removeHero(id: string) {
  db.delete(heroSlides).where(eq(heroSlides.id, id)).run();
}

export function reorderHero(ids: string[]) {
  tx(() => ids.forEach((id, i) => db.update(heroSlides).set({ position: i }).where(eq(heroSlides.id, id)).run()));
}

/** Photographs to choose hero images from: landscape, from published projects, newest first. */
// The finance app groups these into project albums and filters them itself, so it needs every one.
// shortcut: one capped list (3000 rows of ids and names); page it if the archive grows past that.
export function heroCandidates(q?: string) {
  const where = [eq(projects.status, 'published'), eq(media.hidden, false), sql`${media.width} > ${media.height} * 1.2`];
  if (q?.trim()) where.push(like(projects.name, `%${q.trim()}%`));
  return db.select({ mediaId: media.id, projectId: projects.id, projectName: projects.name, location: projects.location })
    .from(media).innerJoin(projects, eq(projects.id, media.projectId))
    .where(and(...where)).orderBy(desc(projects.sortDate), asc(media.position)).limit(3000).all();
}
