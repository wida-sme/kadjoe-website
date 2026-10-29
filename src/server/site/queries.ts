import 'server-only';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { heroSlides, media, partners, projectPartners, projects, type Category } from '../db/schema';

// Read side of the public site. Only published projects and visible photographs leave this module.

export type Photo = {
  id: string; width: number; height: number; blur: string; color: string;
  focalX: number; focalY: number; alt: string | null;
};
export type Credit = { name: string; slug: string; instagram: string | null };
export type ProjectCard = {
  id: string; no: number; slug: string; name: string; category: Category; typeLabel: string | null;
  location: string | null; year: string | null; service: string | null; inHouse: boolean;
  designers: Credit[]; cover: Photo | null;
};
export type ProjectDetail = ProjectCard & {
  description: string | null; photographers: Credit[]; photos: Photo[];
};

export const CATEGORY_LABEL: Record<Category, string> = { residential: 'Residential', fnb: 'F&B', commercial: 'Commercial' };
export const CATEGORY_SLUG: Record<Category, string> = { residential: 'residential', fnb: 'fnb', commercial: 'commercial' };

const photoCols = {
  id: media.id, width: media.width, height: media.height, blur: media.blur, color: media.color,
  focalX: media.focalX, focalY: media.focalY, alt: media.alt,
};

const published = eq(projects.status, 'published');

function creditsFor(projectIds: string[], role: 'design' | 'photo') {
  const map = new Map<string, Credit[]>();
  if (!projectIds.length) return map;
  const rows = db
    .select({ projectId: projectPartners.projectId, name: partners.name, slug: partners.slug, instagram: partners.instagram })
    .from(projectPartners)
    .innerJoin(partners, eq(partners.id, projectPartners.partnerId))
    .where(and(inArray(projectPartners.projectId, projectIds), eq(projectPartners.role, role)))
    .orderBy(asc(projectPartners.position))
    .all();
  for (const r of rows) {
    const list = map.get(r.projectId) ?? [];
    list.push({ name: r.name, slug: r.slug, instagram: r.instagram });
    map.set(r.projectId, list);
  }
  return map;
}

function coversFor(coverIds: (string | null)[]) {
  const ids = coverIds.filter((x): x is string => !!x);
  const map = new Map<string, Photo>();
  if (!ids.length) return map;
  for (const p of db.select(photoCols).from(media).where(inArray(media.id, ids)).all()) map.set(p.id, p);
  return map;
}

/** Each published project's number in the register (the order of /projects, newest first). */
function registerNumbers() {
  const order = db.select({ id: projects.id }).from(projects).where(published).orderBy(desc(projects.sortDate), asc(projects.name)).all();
  return new Map(order.map((r, i) => [r.id, i + 1]));
}

type ProjectRow = typeof projects.$inferSelect;
function toCards(rows: ProjectRow[]): ProjectCard[] {
  const ids = rows.map((r) => r.id);
  const numbers = registerNumbers();
  const designers = creditsFor(ids, 'design');
  const covers = coversFor(rows.map((r) => r.coverId));
  return rows.map((r) => ({
    id: r.id, no: numbers.get(r.id) ?? 0, slug: r.slug, name: r.name, category: r.category, typeLabel: r.typeLabel,
    location: r.location, year: r.year, service: r.service, inHouse: r.inHouse,
    designers: designers.get(r.id) ?? [],
    cover: (r.coverId && covers.get(r.coverId)) || null,
  }));
}

export function getProjects(): ProjectCard[] {
  const rows = db.select().from(projects).where(published).orderBy(desc(projects.sortDate), asc(projects.name)).all();
  return toCards(rows);
}

export function getFeaturedProjects(limit = 6): ProjectCard[] {
  const rows = db.select().from(projects)
    .where(and(published, eq(projects.featured, true)))
    .orderBy(asc(projects.featuredOrder), desc(projects.sortDate))
    .limit(limit).all();
  return toCards(rows);
}

export function getCategoryCounts(): Record<Category, number> {
  const out: Record<Category, number> = { residential: 0, fnb: 0, commercial: 0 };
  for (const r of db.select({ c: projects.category, n: sql<number>`count(*)` }).from(projects).where(published).groupBy(projects.category).all()) out[r.c] = r.n;
  return out;
}

export function getProject(slug: string): ProjectDetail | null {
  const row = db.select().from(projects).where(and(eq(projects.slug, slug), published)).get();
  if (!row) return null;
  const [card] = toCards([row]);
  const photos = db.select(photoCols).from(media)
    .where(and(eq(media.projectId, row.id), eq(media.hidden, false)))
    .orderBy(asc(media.position)).all();
  // The cover leads the gallery.
  const cover = photos.find((p) => p.id === row.coverId);
  const ordered = cover ? [cover, ...photos.filter((p) => p !== cover)] : photos;
  return { ...card, description: row.description, photographers: creditsFor([row.id], 'photo').get(row.id) ?? [], photos: ordered };
}

/** The project after this one in the index order, wrapping around. */
export function getNextProject(slug: string): ProjectCard | null {
  const all = db.select({ slug: projects.slug }).from(projects).where(published).orderBy(desc(projects.sortDate), asc(projects.name)).all();
  const i = all.findIndex((p) => p.slug === slug);
  if (i < 0 || all.length < 2) return null;
  const next = db.select().from(projects).where(eq(projects.slug, all[(i + 1) % all.length].slug)).get();
  return next ? toCards([next])[0] : null;
}

export type HeroSlide = { photo: Photo; project: ProjectCard | null };
export function getHeroSlides(): HeroSlide[] {
  const rows = db.select({ ...photoCols, projectId: media.projectId }).from(heroSlides)
    .innerJoin(media, eq(media.id, heroSlides.mediaId))
    .orderBy(asc(heroSlides.position)).all();
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter((x): x is string => !!x))];
  const cards = new Map(projectIds.length
    ? toCards(db.select().from(projects).where(and(inArray(projects.id, projectIds), published)).all()).map((c) => [c.id, c])
    : []);
  return rows.map(({ projectId, ...photo }) => ({ photo, project: (projectId && cards.get(projectId)) || null }));
}

export type PartnerEntry = { name: string; slug: string; instagram: string | null; website: string | null; projects: ProjectCard[] };

/** Design studios with at least one published project, shuffled on every call: no order reads as a ranking. */
export function getDesignPartners(): PartnerEntry[] {
  const rows = db
    .select({ partner: partners, projectId: projectPartners.projectId })
    .from(partners)
    .innerJoin(projectPartners, and(eq(projectPartners.partnerId, partners.id), eq(projectPartners.role, 'design')))
    .innerJoin(projects, and(eq(projects.id, projectPartners.projectId), published))
    .where(eq(partners.kind, 'design'))
    .all();
  if (!rows.length) return [];
  const cards = new Map(toCards(db.select().from(projects).where(inArray(projects.id, [...new Set(rows.map((r) => r.projectId))])).all()).map((c) => [c.id, c]));
  const byPartner = new Map<string, PartnerEntry>();
  for (const r of rows) {
    const entry = byPartner.get(r.partner.id) ?? { name: r.partner.name, slug: r.partner.slug, instagram: r.partner.instagram, website: r.partner.website, projects: [] };
    const card = cards.get(r.projectId);
    if (card) entry.projects.push(card);
    byPartner.set(r.partner.id, entry);
  }
  return shuffle([...byPartner.values()]);
}

export function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** One photograph per category for the category index: the newest featured project, else the newest. */
export function getCategoryCovers(): Partial<Record<Category, Photo>> {
  const out: Partial<Record<Category, Photo>> = {};
  const rows = db.select({ category: projects.category, coverId: projects.coverId }).from(projects)
    .where(and(published, sql`${projects.coverId} is not null`))
    .orderBy(desc(projects.featured), desc(projects.sortDate)).all();
  const covers = coversFor(rows.map((r) => r.coverId));
  for (const r of rows) if (!out[r.category] && r.coverId && covers.get(r.coverId)) out[r.category] = covers.get(r.coverId);
  return out;
}

export const designLine = (p: Pick<ProjectCard, 'designers' | 'inHouse'>) =>
  p.designers.length ? p.designers.map((d) => d.name).join(' and ') : p.inHouse ? 'Kadjoe' : null;

export const sheetNo = (n: number) => String(n).padStart(3, '0');
