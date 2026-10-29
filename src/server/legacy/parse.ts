// Reads the previous static site (../kadjoe-website, read-only) into plain records. Pure: strings in,
// data out. The import script does the file and database work.
import type { Category } from '../db/schema';

export type LegacyCredit = { name: string; instagram: string | null; inHouse: boolean };
export type LegacyImage = { file: string; width: number; height: number };
export type LegacyProject = {
  slug: string;
  name: string;
  sector: string;
  location: string | null;
  year: string | null;
  scope: string | null;
  designers: LegacyCredit[];
  photographers: LegacyCredit[];
  hero: string | null;
  images: LegacyImage[];
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
const text = (s: string) => decodeEntities(s.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')).trim();

function credits(v: string): LegacyCredit[] {
  return v.split(/<br\s*\/?>/).flatMap((part) => {
    const a = /<a href="([^"]+)"[^>]*>(.*?)<\/a>/.exec(part);
    const name = a ? text(a[2]) : text(part);
    if (!name) return [];
    const ig = /instagram\.com\/([^/"]+)\/?/.exec(part);
    return [{ name, instagram: ig ? ig[1] : null, inHouse: part.includes('in-house') }];
  });
}

export function parseProjectPage(slug: string, html: string): LegacyProject {
  const rows: Record<string, string> = {};
  for (const m of html.matchAll(/<div class="row"><div class="k">(.*?)<\/div><div class="v">(.*?)<\/div><\/div>/gs)) rows[text(m[1])] = m[2];
  const h1 = /<h1 class="rv">(.*?)<\/h1>/s.exec(html);
  const hero = /<section class="proj-hero">.*?<img src="([^"]+)"/s.exec(html);
  const images: LegacyImage[] = [];
  for (const m of html.matchAll(/data-full="([^"]+)"[^>]*>\s*<img src="[^"]+"[^>]*width="(\d+)" height="(\d+)"/gs)) {
    images.push({ file: m[1].split('/').pop()!, width: Number(m[2]), height: Number(m[3]) });
  }
  const loc = rows.Location ? text(rows.Location) : rows.Venues ? text(rows.Venues).replace(/\s*·\s*/g, ', ') : null;
  return {
    slug,
    name: h1 ? text(h1[1]) : slug,
    sector: rows.Sector ? text(rows.Sector) : '',
    location: loc || null,
    year: rows.Year ? text(rows.Year) : null,
    scope: rows.Scope ? text(rows.Scope) : null,
    designers: rows['Interior Design'] ? credits(rows['Interior Design']) : [],
    photographers: rows.Photography ? credits(rows.Photography) : [],
    hero: hero ? hero[1].split('/').pop()! : null,
    images,
  };
}

export function parseHome(html: string) {
  const hero = [...html.matchAll(/<div class="hero-slide[^"]*" data-name="[^"]+" data-loc="[^"]*">\s*<img (?:src|data-src)="assets\/i\/l\/([^"]+)"/g)].map((m) => m[1]);
  const featured = [...html.matchAll(/<a class="work rv" href="projects\/([a-z0-9-]+)\.html"/g)].map((m) => m[1]);
  return { hero, featured };
}

export function categoryOf(sector: string): { category: Category; typeLabel: string | null } {
  if (sector === 'Residential') return { category: 'residential', typeLabel: null };
  if (sector === 'F&B') return { category: 'fnb', typeLabel: null };
  return { category: 'commercial', typeLabel: sector || null }; // Retail, Office, Wellness
}

// Kadjoe's own captions say "Service : Build" or "Design & Build".
export function serviceOf(scope: string | null) {
  if (!scope) return null;
  if (/design\s*&\s*build/i.test(scope)) return 'Design & Build';
  if (/^design$/i.test(scope.trim())) return 'Design';
  return 'Build';
}

/** Visible text never carries em or en dashes: a year range reads 2018-2020. */
export const plainDashes = (s: string) => s.replace(/\s*[–—]\s*/g, '-');

// Instagram ids carry their creation time: (id >> 23) + 1314220021721 is milliseconds since 1970.
const SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function shortcodeToMediaId(code: string) {
  let n = 0n;
  for (const c of code) {
    const i = SHORTCODE_ALPHABET.indexOf(c);
    if (i < 0) throw new Error(`bad shortcode ${code}`);
    n = n * 64n + BigInt(i);
  }
  return n;
}
export const shortcodeDate = (code: string) => new Date(Number((shortcodeToMediaId(code) >> 23n) + 1314220021721n));

/** i_<shortcode>_<nn>.webp came from Instagram; w_<yyyymm>_<name>.webp from the WordPress site. */
export function imageOrigin(file: string):
  | { kind: 'ig'; shortcode: string; index: number }
  | { kind: 'wp'; month: string; base: string } {
  const ig = /^i_(.+)_(\d{2})\.webp$/.exec(file);
  if (ig) return { kind: 'ig', shortcode: ig[1], index: Number(ig[2]) };
  const wp = /^w_(\d{6})_(.+)\.webp$/.exec(file);
  if (wp) return { kind: 'wp', month: wp[1], base: wp[2] };
  throw new Error(`unknown image origin: ${file}`);
}
