// One-off: builds the site database and photographs from the previous static site (projects,
// credits, gallery order) and the WordPress backup (full-resolution originals of the photographs the
// old site took from kadjoe.com). Both sources are only read.
//
//   npm run import:legacy -- --site ../kadjoe-website --wp-zip ~/Downloads/kadjoe-backup-website/well-known.zip [--reset]
//
// Corrections made here, on purpose:
//   - M House was two projects merged by the old Instagram scraper. They are split by post:
//     The Icon BSD (2021, SE Design Studio) and Greenlake City (2022, Beta Design Studio).
//   - Retail, Office and Wellness become one category, Commercial; the old sector stays as a label.
//   - Near-duplicate photographs inside a project are dropped (difference hash).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { eq, sql } from 'drizzle-orm';
import { openDatabase } from '../src/server/db/client';
import * as t from '../src/server/db/schema';
import { newId, slugify } from '../src/server/ids';
import {
  categoryOf, imageOrigin, parseHome, parseProjectPage, plainDashes, serviceOf, shortcodeDate,
  type LegacyCredit, type LegacyProject,
} from '../src/server/legacy/parse';
import { hashDistance, writeMaster } from '../src/server/media/process';
import { DATA_DIR, DB_FILE, MEDIA_DIR } from '../src/server/paths';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i > -1 ? args[i + 1] : d; };
const home = (p: string) => p.replace(/^~(?=\/)/, os.homedir());
const SITE = path.resolve(home(opt('site', '../kadjoe-website')));
const WP_ZIP = path.resolve(home(opt('wp-zip', '~/Downloads/kadjoe-backup-website/well-known.zip')));
const LIMIT = Number(opt('limit', '0')); // import only the first N projects (for quick trials)

if (args.includes('--reset')) {
  for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) fs.rmSync(f, { force: true });
  fs.rmSync(MEDIA_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DATA_DIR, { recursive: true });
const { db, sqlite } = openDatabase();
if ((db.select({ n: sql<number>`count(*)` }).from(t.projects).get()?.n ?? 0) > 0) {
  console.error('The database already has projects. Run with --reset to rebuild it.');
  process.exit(1);
}

// ------------------------------------------------------------------------------------------------
// Names and corrections

const DESIGN_NAMES: Record<string, string> = {
  mjofficeteam: 'MJ Office',
  a_a_practice: 'A-A Practice',
};
const PHOTO_NAMES: Record<string, string> = {
  leowardistudio: 'Leowardi Studio',
  ernesttheofilus: 'Ernest Theofilus',
  'textural.studio': 'Textural Studio',
};

type Credit = [name: string, instagram: string];
type Split = {
  slug: string; name: string; location: string; year: string;
  designers: Credit[]; photographers: Credit[]; take: (file: string) => boolean;
};
const SPLITS: Record<string, Split[]> = {
  'm-house': [
    {
      slug: 'm-house-bsd', name: 'M House', location: 'The Icon, Cluster Cosmo, BSD', year: '2021',
      designers: [['SE Design Studio', 'se.designstudio']], photographers: [['@harisabghi', 'harisabghi']],
      take: (f) => f.startsWith('w_') || /^i_(CUrV9KlvMfY|CUt6TmKvqTk|CUwn3rjPydo)_/.test(f),
    },
    {
      slug: 'm-house-greenlake-city', name: 'M House', location: 'Greenlake City', year: '2022',
      designers: [['Beta Design Studio', 'beta.design.studio']], photographers: [['Leowardi Studio', 'leowardistudio']],
      take: (f) => /^i_(Cfygsf4votG|CgESGDNug4B|CgZlSScPTwM|Cg1xwSMvsxo|ChMmCjOvRzX|ChvuHy0vBw4)_/.test(f),
    },
  ],
};

// ------------------------------------------------------------------------------------------------
// Sources

const legacy: LegacyProject[] = fs.readdirSync(path.join(SITE, 'projects'))
  .filter((f) => f.endsWith('.html'))
  .sort()
  .map((f) => parseProjectPage(f.slice(0, -5), fs.readFileSync(path.join(SITE, 'projects', f), 'utf8')));
const homePage = parseHome(fs.readFileSync(path.join(SITE, 'index.html'), 'utf8'));

// WordPress originals: w_<yyyymm>_<base>.webp was cut from wp-content/uploads/<yyyy>/<mm>/<base>.<ext>.
const zipIndex = new Map<string, { size: number; name: string }[]>();
for (const line of execFileSync('unzip', ['-l', WP_ZIP], { maxBuffer: 64 << 20 }).toString('utf8').split('\n')) {
  const m = /^\s*(\d+)\s+\S+\s+\S+\s+(wp-content\/uploads\/(\d{4})\/(\d{2})\/(.+)\.(jpe?g|png|webp))$/i.exec(line);
  if (!m) continue;
  const key = `${m[3]}${m[4]}/${m[5].replace(/-scaled$/, '')}`;
  const list = zipIndex.get(key) ?? [];
  list.push({ size: Number(m[1]), name: m[2] });
  zipIndex.set(key, list);
}
const byBase = new Map<string, { size: number; name: string }[]>();
for (const [key, list] of zipIndex) {
  const base = key.slice(7);
  byBase.set(base, [...(byBase.get(base) ?? []), ...list]);
}
function wpOriginal(month: string, base: string): Buffer | null {
  // The old site named files by the month it found them in; WordPress sometimes filed them elsewhere.
  const list = zipIndex.get(`${month}/${base}`) ?? byBase.get(base);
  if (!list?.length) return null;
  const best = [...list].sort((a, b) => b.size - a.size)[0];
  const pattern = best.name.replace(/[[\]*?]/g, (c) => `[${c}]`); // unzip treats names as patterns
  return execFileSync('unzip', ['-p', WP_ZIP, pattern], { maxBuffer: 256 << 20 });
}

// ------------------------------------------------------------------------------------------------
// Partners

const partnerIds = new Map<string, string>(); // `${kind}:${instagram || name}` -> id
const usedSlugs = new Set<string>();
const uniqueSlug = (base: string) => {
  let s = base, n = 2;
  while (usedSlugs.has(s)) s = `${base}-${n++}`;
  usedSlugs.add(s);
  return s;
};

function partnerFor(kind: 'design' | 'photo', credit: { name: string; instagram: string | null }) {
  const handle = credit.instagram?.toLowerCase() ?? null;
  const key = `${kind}:${handle ?? credit.name.toLowerCase()}`;
  const existing = partnerIds.get(key);
  if (existing) return existing;
  const known = handle ? (kind === 'design' ? DESIGN_NAMES[handle] : PHOTO_NAMES[handle]) : undefined;
  const raw = known ?? (kind === 'photo' && handle ? `@${handle}` : plainDashes(credit.name));
  const id = newId();
  db.insert(t.partners).values({
    id, kind, name: raw, instagram: handle, slug: uniqueSlug(slugify(raw.replace(/^@/, ''))),
    needsReview: kind === 'photo' && !known,
  }).run();
  partnerIds.set(key, id);
  return id;
}

// ------------------------------------------------------------------------------------------------
// Projects and photographs

type Job = { projectId: string; file: string; position: number };
type Plan = {
  id: string; slug: string; name: string; legacy: LegacyProject;
  location: string | null; year: string | null; designers: LegacyCredit[]; photographers: LegacyCredit[];
  files: string[];
};

const plans: Plan[] = [];
for (const p of LIMIT ? legacy.slice(0, LIMIT) : legacy) {
  const files = p.images.map((i) => i.file);
  const splits = SPLITS[p.slug];
  if (splits) {
    const claimed = new Set<string>();
    for (const s of splits) {
      const mine = files.filter(s.take);
      mine.forEach((f) => claimed.add(f));
      const credit = ([name, instagram]: Credit): LegacyCredit => ({ name, instagram, inHouse: false });
      plans.push({
        id: newId(), slug: s.slug, name: s.name, legacy: p, location: s.location, year: s.year,
        designers: s.designers.map(credit), photographers: s.photographers.map(credit), files: mine,
      });
    }
    const lost = files.filter((f) => !claimed.has(f));
    if (lost.length) throw new Error(`${p.slug}: photographs not assigned by the split: ${lost.join(', ')}`);
    continue;
  }
  plans.push({
    id: newId(), slug: p.slug, name: p.name, legacy: p, location: p.location, year: p.year,
    designers: p.designers, photographers: p.photographers, files,
  });
}

for (const plan of plans) {
  const p = plan.legacy;
  const { category, typeLabel } = categoryOf(p.sector);
  const inHouse = plan.designers.some((d) => d.inHouse);
  db.insert(t.projects).values({
    id: plan.id, slug: plan.slug, name: plainDashes(plan.name), category, typeLabel,
    location: plan.location ? plainDashes(plan.location) : null,
    year: plan.year ? plainDashes(plan.year) : null,
    service: serviceOf(p.scope), inHouse, status: 'published',
    featured: homePage.featured.includes(p.slug) && !SPLITS[p.slug],
    featuredOrder: homePage.featured.indexOf(p.slug),
    sortDate: '1970-01-01', source: 'legacy',
  }).run();
  plan.designers.filter((d) => !d.inHouse).forEach((d, i) => {
    db.insert(t.projectPartners).values({ projectId: plan.id, partnerId: partnerFor('design', d), role: 'design', position: i }).onConflictDoNothing().run();
  });
  plan.photographers.forEach((d, i) => {
    db.insert(t.projectPartners).values({ projectId: plan.id, partnerId: partnerFor('photo', d), role: 'photo', position: i }).onConflictDoNothing().run();
  });
}

const jobs: Job[] = plans.flatMap((plan) => plan.files.map((file, position) => ({ projectId: plan.id, file, position })));
const kept = new Map<string, { hash: string }[]>(); // per project, for near-duplicate checks
const byFile = new Map<string, string>(); // legacy file name -> media id
let done = 0, skipped = 0, fromWp = 0;
const started = Date.now();

async function run(job: Job) {
  const origin = imageOrigin(job.file);
  let input: Buffer | string;
  if (origin.kind === 'wp') {
    const original = wpOriginal(origin.month, origin.base);
    if (original) fromWp++;
    input = original ?? path.join(SITE, 'assets/i/l', job.file);
  } else {
    input = path.join(SITE, 'assets/i/l', job.file);
  }
  const id = newId();
  const info = await writeMaster(id, input);
  const seen = kept.get(job.projectId) ?? [];
  if (seen.some((s) => hashDistance(s.hash, info.hash) <= 3)) {
    fs.rmSync(path.join(MEDIA_DIR, id), { recursive: true, force: true });
    skipped++;
    console.log(`  duplicate dropped: ${job.file}`);
    return;
  }
  seen.push({ hash: info.hash });
  kept.set(job.projectId, seen);
  const takenAt = origin.kind === 'ig'
    ? shortcodeDate(origin.shortcode).toISOString()
    : `${origin.month.slice(0, 4)}-${origin.month.slice(4)}-01T00:00:00.000Z`;
  db.insert(t.media).values({
    id, projectId: job.projectId, ...info, position: job.position,
    source: origin.kind === 'ig' ? 'legacy-ig' : 'legacy-wp', originalName: job.file,
    igShortcode: origin.kind === 'ig' ? origin.shortcode : null,
    igIndex: origin.kind === 'ig' ? origin.index : null,
    takenAt,
  }).run();
  byFile.set(job.file, id);
}

// Photographs of one project are processed in order (the duplicate check depends on it); projects run
// four at a time.
const queue = plans.map((plan) => jobs.filter((j) => j.projectId === plan.id));
async function worker() {
  for (let list = queue.shift(); list; list = queue.shift()) {
    for (const job of list) {
      await run(job);
      if (++done % 50 === 0) console.log(`${done}/${jobs.length} photographs, ${Math.round((Date.now() - started) / 1000)} s`);
    }
  }
}
async function main() {
await Promise.all([worker(), worker(), worker(), worker()]);

// ------------------------------------------------------------------------------------------------
// Covers, ordering, hero, Instagram history

for (const plan of plans) {
  const rows = db.select().from(t.media).where(eq(t.media.projectId, plan.id)).orderBy(t.media.position).all();
  rows.forEach((r, i) => db.update(t.media).set({ position: i }).where(eq(t.media.id, r.id)).run());
  const hero = plan.legacy.hero && byFile.get(plan.legacy.hero);
  const cover = hero && rows.some((r) => r.id === hero) ? hero : rows[0]?.id ?? null;
  const igDates = rows.filter((r) => r.source === 'legacy-ig' && r.takenAt).map((r) => r.takenAt!).sort();
  const lastYear = plan.year?.match(/\d{4}/g)?.pop();
  const sortDate = (igDates.at(-1) ?? (lastYear ? `${lastYear}-06-30` : rows.map((r) => r.takenAt ?? '').sort().at(-1)) ?? '2017-01-01').slice(0, 10);
  db.update(t.projects).set({ coverId: cover, sortDate }).where(eq(t.projects.id, plan.id)).run();
}

homePage.hero.forEach((file, i) => {
  const mediaId = byFile.get(file);
  if (mediaId) db.insert(t.heroSlides).values({ id: newId(), mediaId, position: i }).run();
});

const shortcodes = new Map<string, string>();
for (const r of db.select().from(t.media).where(eq(t.media.source, 'legacy-ig')).all()) {
  if (r.igShortcode && r.projectId) shortcodes.set(r.igShortcode, r.projectId);
}
let newest = '';
for (const [shortcode, projectId] of shortcodes) {
  const postedAt = shortcodeDate(shortcode).toISOString();
  if (postedAt > newest) newest = postedAt;
  db.insert(t.igPosts).values({
    shortcode, projectId, status: 'imported', postedAt, importedAt: new Date().toISOString(),
    permalink: `https://www.instagram.com/p/${shortcode}/`, note: 'Imported from the previous website',
  }).run();
}
db.insert(t.settings).values({ key: 'instagram', value: { importSince: newest || null, autoPublish: true } }).run();

const count = (tbl: typeof t.projects | typeof t.media | typeof t.partners | typeof t.heroSlides | typeof t.igPosts) =>
  db.select({ n: sql<number>`count(*)` }).from(tbl).get()?.n;
console.log(`\nprojects ${count(t.projects)}, photographs ${count(t.media)} (${fromWp} from WordPress originals, ${skipped} duplicates dropped), partners ${count(t.partners)}, hero ${count(t.heroSlides)}, instagram posts ${count(t.igPosts)}`);
console.log(`done in ${Math.round((Date.now() - started) / 1000)} s -> ${DB_FILE}`);
sqlite.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
