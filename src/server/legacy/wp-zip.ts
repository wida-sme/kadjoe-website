// The WordPress backup: a zip on the owner's machine with the full-size originals of the photographs
// the previous static site took from kadjoe.com. Optional for the legacy import: without it the
// import uses the static site's own (smaller) copies.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

type Entry = { size: number; name: string };

/** Indexes `unzip -l` output. The lookup returns the archive name of the largest original of an
 *  upload: w_<yyyymm>_<base>.webp on the old site was cut from wp-content/uploads/<yyyy>/<mm>/<base>. */
export function indexListing(listing: string) {
  const byMonth = new Map<string, Entry[]>(); // `${yyyymm}/${base}` -> every size of that upload
  for (const line of listing.split('\n')) {
    const m = /^\s*(\d+)\s+\S+\s+\S+\s+(wp-content\/uploads\/(\d{4})\/(\d{2})\/(.+)\.(jpe?g|png|webp))$/i.exec(line);
    if (!m) continue;
    const key = `${m[3]}${m[4]}/${m[5].replace(/-scaled$/, '')}`;
    byMonth.set(key, [...(byMonth.get(key) ?? []), { size: Number(m[1]), name: m[2] }]);
  }
  const byBase = new Map<string, Entry[]>();
  for (const [key, list] of byMonth) {
    const base = key.slice(7);
    byBase.set(base, [...(byBase.get(base) ?? []), ...list]);
  }
  return (month: string, base: string): string | null => {
    // The old site named files by the month it found them in; WordPress sometimes filed them elsewhere.
    const list = byMonth.get(`${month}/${base}`) ?? byBase.get(base);
    if (!list?.length) return null;
    return [...list].sort((a, b) => b.size - a.size)[0].name;
  };
}

export type WpZip = { original: (month: string, base: string) => Buffer | null };

/** Opens the backup at `zipPath`, or returns null when there is no file there. */
export function openWpZip(zipPath: string): WpZip | null {
  if (!fs.existsSync(zipPath)) return null;
  const find = indexListing(execFileSync('unzip', ['-l', zipPath], { maxBuffer: 64 << 20 }).toString('utf8'));
  return {
    original(month, base) {
      const name = find(month, base);
      if (!name) return null;
      const pattern = name.replace(/[[\]*?]/g, (c) => `[${c}]`); // unzip treats names as patterns
      return execFileSync('unzip', ['-p', zipPath, pattern], { maxBuffer: 256 << 20 });
    },
  };
}
