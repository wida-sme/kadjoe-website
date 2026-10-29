// Kadjoe writes project posts as a small form:
//
//   Client : M House
//   Type : Residential
//   Location : The Icon - Cluster Cosmo, BSD
//   Service : Build
//   Designed by: @se.designstudio
//   Photography : @harisabghi
//   Status : Complete
//
// Pure functions: caption text in, structured fields out. No network, no database.
import type { Category } from '../db/schema';

export type ParsedCaption = {
  name: string | null;
  type: string | null;
  location: string | null;
  service: string | null;
  status: string | null;
  year: string | null;
  designers: Credit[];
  photographers: Credit[];
  inHouse: boolean;
};
export type Credit = { handle: string | null; name: string | null };

type TextField = 'name' | 'type' | 'location' | 'service' | 'status' | 'year';
const KEYS: [RegExp, TextField | 'designers' | 'photographers'][] = [
  [/^(client|project|project name|nama proyek|proyek)$/, 'name'],
  [/^(type|category|sector|project type|tipe)$/, 'type'],
  [/^(location|lokasi|venue|address|area)$/, 'location'],
  [/^(service|services|scope|scope of work|layanan)$/, 'service'],
  [/^(status|progress)$/, 'status'],
  [/^(year|tahun|completed|completion)$/, 'year'],
  [/^(design|designed by|designer|interior design|interior designer|interior|architect|architecture|design by|design & build|design and build|desain|concept)$/, 'designers'],
  [/^(photography|photographer|photo|photos|photo by|photos by|photographed by|foto|captured by|shot by)$/, 'photographers'],
];

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s\-–—•·:]+|[\s\-–—•·]+$/g, '').trim();

/** "@a.studio x @b_studio", "Studio Name", "Studio A & @b" -> credits. */
export function parseCredits(value: string): Credit[] {
  const handles = [...value.matchAll(/@([A-Za-z0-9._]{1,30})/g)].map((m) => m[1].replace(/\.$/, '').toLowerCase());
  const rest = clean(value.replace(/@[A-Za-z0-9._]{1,30}/g, ' ').replace(/\b(x|and|dan|with|&|,)\b/gi, ' ').replace(/[,&/+]/g, ' '));
  const out: Credit[] = handles.map((handle) => ({ handle, name: null }));
  if (!handles.length && rest) out.push({ handle: null, name: clean(value) });
  return out;
}

const KADJOE = /^(kadjoe|kadjoe_id|kadjoe\.id|kadjoekreasiindonesia|pt kadjoe kreasi indonesia)$/i;

export function parseCaption(caption: string | null | undefined): ParsedCaption {
  const out: ParsedCaption = { name: null, type: null, location: null, service: null, status: null, year: null, designers: [], photographers: [], inHouse: false };
  if (!caption) return out;
  for (const raw of caption.split(/\r?\n/)) {
    const line = raw.replace(/[​-‍️]/g, '').trim();
    const m = /^[^\p{L}\p{N}]*([\p{L}][\p{L} &./]*?)\s*[:：]\s*(.+)$/u.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase().replace(/\s+/g, ' ').trim();
    const value = clean(m[2]);
    if (!value) continue;
    const hit = KEYS.find(([re]) => re.test(key));
    if (!hit) continue;
    const field = hit[1];
    if (field === 'designers' || field === 'photographers') {
      const credits = parseCredits(value);
      for (const c of credits) {
        if (field === 'designers' && ((c.handle && KADJOE.test(c.handle)) || (c.name && KADJOE.test(c.name)))) { out.inHouse = true; continue; }
        out[field].push(c);
      }
    } else if (out[field] === null) {
      out[field] = field === 'name' ? value.replace(/\s+#.*$/, '') : value;
    }
  }
  if (out.year) out.year = /(\d{4})(?:\s*[-–/]\s*(\d{4}))?/.exec(out.year)?.slice(1).filter(Boolean).join('-') ?? null;
  return out;
}

export function categoryFromType(type: string | null): { category: Category; typeLabel: string | null } | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (/f\s*&\s*b|\bfnb\b|food|restaurant|resto|caf[eé]|coffee|\bbar\b|bakery|kitchen|dessert|\btea\b|eatery|dining|bistro|patisserie|ice cream|gelato/.test(t)) return { category: 'fnb', typeLabel: null };
  if (/resid|house|home|apartment|apartemen|villa|rumah|condo|penthouse|townhouse|residence/.test(t)) return { category: 'residential', typeLabel: null };
  if (/retail|store|shop|boutique|office|kantor|clinic|dental|wellness|spa|salon|gym|fitness|bank|showroom|commercial|gallery|hotel|school|co-?working|medical|beauty|studio/.test(t)) {
    const label = /office|kantor|co-?working/.test(t) ? 'Office'
      : /clinic|dental|wellness|spa|salon|gym|fitness|medical|beauty/.test(t) ? 'Wellness'
      : /bank/.test(t) ? 'Bank'
      : /showroom|gallery/.test(t) ? 'Showroom'
      : /hotel/.test(t) ? 'Hospitality'
      : 'Retail';
    return { category: 'commercial', typeLabel: label };
  }
  return null;
}

export function serviceFrom(value: string | null) {
  if (!value) return null;
  if (/design\s*(&|and|dan)\s*build/i.test(value)) return 'Design & Build';
  if (/^\s*design\s*$/i.test(value)) return 'Design';
  if (/build|construct|fit|contractor|pembangunan/i.test(value)) return 'Build';
  return null;
}

export const inProgress = (status: string | null) => !!status && /on\s*-?\s*going|progress|under construction|berjalan|proses/i.test(status);

/** Lower-case words of a name or place, for comparisons. */
export function words(s: string | null | undefined) {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !['the', 'and', 'jl', 'jln', 'jalan', 'cluster', 'kota', 'kec', 'jakarta'].includes(w));
}

export function sameName(a: string, b: string) {
  return words(a).join(' ') === words(b).join(' ');
}

/** Two locations describe the same place when the shorter one is spelled inside the longer one
 *  ("Greenlake City" in "Green Lake City Cluster West Europe") or shares two thirds of its words. */
export function samePlace(a: string | null, b: string | null): boolean | null {
  const x = words(a), y = words(b);
  if (!x.length || !y.length) return null; // unknown
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (long.join('').includes(short.join(''))) return true;
  const set = new Set(long);
  return short.filter((w) => set.has(w)).length / short.length >= 0.67;
}
