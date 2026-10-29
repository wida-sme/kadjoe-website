import { asc, eq, sql } from 'drizzle-orm';
import { db, tx } from '../db/client';
import { partners, projectPartners } from '../db/schema';
import { newId, slugify } from '../ids';

export type PartnerInput = { name: string; kind: 'design' | 'photo'; instagram: string | null; website: string | null };

export const cleanHandle = (h: string | null | undefined) => {
  const v = (h ?? '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '').toLowerCase();
  return v || null;
};

function uniqueSlug(base: string, exceptId?: string) {
  const root = slugify(base.replace(/^@/, ''));
  for (let n = 1; ; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    const hit = db.select({ id: partners.id }).from(partners).where(eq(partners.slug, slug)).get();
    if (!hit || hit.id === exceptId) return slug;
  }
}

export function listPartners() {
  return db.select({
    id: partners.id, slug: partners.slug, name: partners.name, kind: partners.kind, instagram: partners.instagram,
    website: partners.website, needsReview: partners.needsReview,
    projects: sql<number>`(select count(*) from project_partners pp where pp.partner_id = partners.id)`,
  }).from(partners).orderBy(asc(partners.kind), asc(partners.name)).all();
}

export function createPartner(input: PartnerInput, needsReview = false) {
  const id = newId();
  db.insert(partners).values({ id, slug: uniqueSlug(input.name), name: input.name, kind: input.kind, instagram: cleanHandle(input.instagram), website: input.website, needsReview }).run();
  return id;
}

export function updatePartner(id: string, input: PartnerInput) {
  db.update(partners).set({
    name: input.name, slug: uniqueSlug(input.name, id), kind: input.kind, instagram: cleanHandle(input.instagram),
    website: input.website, needsReview: false, updatedAt: new Date().toISOString(),
  }).where(eq(partners.id, id)).run();
}

/** Credits of `fromId` move to `intoId`; `fromId` is deleted. For duplicates from the import. */
export function mergePartners(fromId: string, intoId: string) {
  if (fromId === intoId) return;
  tx(() => {
    for (const c of db.select().from(projectPartners).where(eq(projectPartners.partnerId, fromId)).all()) {
      db.insert(projectPartners).values({ ...c, partnerId: intoId }).onConflictDoNothing().run();
    }
    db.delete(partners).where(eq(partners.id, fromId)).run();
  });
}

export function deletePartner(id: string) {
  db.delete(partners).where(eq(partners.id, id)).run();
}

/** Finds a partner by Instagram handle, or creates one from the handle for a person to review. */
export function partnerForHandle(handle: string, kind: 'design' | 'photo') {
  const h = cleanHandle(handle);
  if (!h) return null;
  const hit = db.select({ id: partners.id }).from(partners).where(eq(partners.instagram, h)).get();
  if (hit) return hit.id;
  return createPartner({ name: `@${h}`, kind, instagram: h, website: null }, true);
}
