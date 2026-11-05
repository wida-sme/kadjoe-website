import { renderToBuffer } from '@react-pdf/renderer';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { site } from '@/content/site';
import { db } from '../db/client';
import { CATEGORIES, media, partners, projectPartners, projects, type Category } from '../db/schema';
import { jpeg } from '../media/process';
import { getClients, getContact, getProfilePdf } from '../settings';
import { ProfileDocument, type PdfModel, type PdfPhoto, type PdfProject } from './document';

// Company profile = a choice of projects per category (or a hand-picked set) laid out as a PDF.

const LABEL: Record<Category, string> = { residential: 'Residential', fnb: 'F&B', commercial: 'Commercial' };

export const profileSchema = z.object({
  title: z.string().trim().min(1).max(60).default('Portfolio'),
  groups: z.array(z.object({
    category: z.enum(CATEGORIES),
    projectIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{12}$/)).max(40),
  })).min(1).max(3),
  sections: z.object({ about: z.boolean(), services: z.boolean(), clients: z.boolean(), contact: z.boolean() }),
  coverMediaId: z.string().regex(/^[A-Za-z0-9_-]{12}$/).nullable().default(null),
});
export type ProfileConfig = z.infer<typeof profileSchema>;

/** The projects offered for a category: selected-on-home first, then newest. */
export function candidatesFor(category: Category) {
  return db.select({ id: projects.id, name: projects.name, location: projects.location, year: projects.year, coverId: projects.coverId, featured: projects.featured })
    .from(projects).where(and(eq(projects.category, category), eq(projects.status, 'published')))
    .orderBy(desc(projects.featured), asc(projects.featuredOrder), desc(projects.sortDate)).all();
}

export function defaultConfig(categories: Category[] = [...CATEGORIES], perCategory = 6): ProfileConfig {
  return {
    title: 'Portfolio',
    groups: categories.map((category) => ({ category, projectIds: candidatesFor(category).slice(0, perCategory).map((p) => p.id) })),
    sections: { about: true, services: true, clients: true, contact: true },
    coverMediaId: null,
  };
}

async function pdfPhoto(m: { id: string; focalX: number; focalY: number; width: number; height: number }, width: number, fast = false): Promise<PdfPhoto | null> {
  const file = await jpeg(m.id, width, fast);
  return file ? { file, focalX: m.focalX, focalY: m.focalY, width: m.width, height: m.height } : null;
}

/** Three photographs per project: the cover leads (a landscape if the cover is not), two more follow. */
function choosePhotos<T extends { id: string; width: number; height: number }>(all: T[], coverId: string | null) {
  const cover = all.find((p) => p.id === coverId) ?? all[0];
  if (!cover) return [];
  const rest = all.filter((p) => p !== cover);
  const main = cover.width >= cover.height * 1.2 ? cover : rest.find((p) => p.width >= p.height * 1.2) ?? cover;
  const others = [cover, ...rest].filter((p) => p !== main);
  return [main, ...others.slice(0, 2)];
}

/** A preview (the finance app shows it beside the builder and rebuilds it on every change) embeds the photos at
 * this share of their print width: a fraction of the bytes, the same pages. */
const PREVIEW_SCALE = 0.4;

export async function buildModel(cfg: ProfileConfig, opts: { preview?: boolean } = {}): Promise<PdfModel> {
  const photo = (m: Parameters<typeof pdfPhoto>[0], width: number) => (opts.preview ? pdfPhoto(m, Math.round(width * PREVIEW_SCALE), true) : pdfPhoto(m, width));
  const ids = cfg.groups.flatMap((g) => g.projectIds);
  const rows = ids.length ? db.select().from(projects).where(inArray(projects.id, ids)).all() : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const credits = ids.length ? db.select({ projectId: projectPartners.projectId, role: projectPartners.role, name: partners.name })
    .from(projectPartners).innerJoin(partners, eq(partners.id, projectPartners.partnerId))
    .where(inArray(projectPartners.projectId, ids)).orderBy(asc(projectPartners.position)).all() : [];
  const photosOf = new Map<string, (typeof media.$inferSelect)[]>();
  if (ids.length) {
    for (const m of db.select().from(media).where(and(inArray(media.projectId, ids), eq(media.hidden, false))).orderBy(asc(media.position)).all()) {
      photosOf.set(m.projectId!, [...(photosOf.get(m.projectId!) ?? []), m]);
    }
  }

  // Every project's photographs at once: on a cold cache each is a sharp resize, and sharp runs them side by side.
  const groups = (await Promise.all(cfg.groups.map(async (g) => {
    const list = await Promise.all(g.projectIds.flatMap((id) => {
      const p = byId.get(id);
      if (!p) return [];
      return [(async (): Promise<PdfProject> => {
        const chosen = choosePhotos(photosOf.get(id) ?? [], p.coverId);
        const photos = (await Promise.all(chosen.map((m, i) => photo(m, i === 0 ? 1600 : 1000)))).filter((x): x is PdfPhoto => !!x);
        const names = (role: 'design' | 'photo') => credits.filter((c) => c.projectId === id && c.role === role).map((c) => c.name.replace(/^@/, ''));
        return {
          name: p.name, category: LABEL[p.category], typeLabel: p.typeLabel, location: p.location, year: p.year, service: p.service,
          design: names('design').join(' and ') || (p.inHouse ? 'Kadjoe' : null), photography: names('photo').join(' and ') || null, photos,
        };
      })()];
    }));
    return { label: LABEL[g.category], projects: list };
  }))).filter((g) => g.projects.length);

  const saved = getProfilePdf();
  const pick = (id: string | null) => (id ? db.select().from(media).where(eq(media.id, id)).get() : undefined);
  const coverMedia = pick(cfg.coverMediaId ?? saved.coverMediaId)
    ?? (() => { const first = byId.get(cfg.groups.find((g) => g.projectIds.length)?.projectIds[0] ?? ''); const ph = first ? choosePhotos(photosOf.get(first.id) ?? [], first.coverId) : []; return ph[0]; })();
  const aboutSource = rows.find((r) => r.id !== (cfg.groups[0]?.projectIds[0] ?? '') && (photosOf.get(r.id) ?? []).some((m) => m.height > m.width));
  const aboutPhoto = pick(saved.aboutMediaId) ?? (aboutSource ? (photosOf.get(aboutSource.id) ?? []).find((m) => m.height > m.width) : undefined);
  const contact = getContact();
  const [cover, about] = await Promise.all([
    coverMedia ? photo(coverMedia, 1920) : null,
    cfg.sections.about && aboutPhoto ? photo(aboutPhoto, 1400) : null,
  ]);

  return {
    title: cfg.title,
    scope: groups.map((g) => g.label).join(', ').replace(/, ([^,]*)$/, ' and $1'),
    year: String(new Date().getFullYear()),
    legalName: site.legalName,
    cover,
    about: cfg.sections.about ? { paragraphs: saved.about ?? [...site.about], photo: about } : null,
    services: cfg.sections.services ? saved.services ?? site.services.map((x) => ({ name: x.name, text: x.text })) : null,
    groups,
    clients: cfg.sections.clients ? saved.clients ?? getClients() : null,
    contact: cfg.sections.contact ? { addressLines: contact.addressLines, email: contact.email, instagram: contact.instagram, phone: contact.phone, website: site.url } : null,
  };
}

export async function renderProfile(cfg: ProfileConfig, opts: { preview?: boolean } = {}) {
  const model = await buildModel(cfg, opts);
  return renderToBuffer(<ProfileDocument m={model} />);
}

export function profileFileName(cfg: ProfileConfig) {
  const scope = cfg.groups.map((g) => LABEL[g.category].replace('&', 'n')).join('-');
  return `Kadjoe-${cfg.title.replace(/[^A-Za-z0-9]+/g, '-')}-${scope}-${new Date().getFullYear()}.pdf`;
}
