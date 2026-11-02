// Cuts the image sizes visitors ask for most, ahead of time, so first visits after an import or a
// deploy do not wait for them. Safe to run any time; existing files are kept.
//   npm run media:warm            covers and hero photographs
//   npm run media:warm -- --all   every photograph (galleries too)
import { eq, isNotNull } from 'drizzle-orm';
import { openDatabase } from '../src/server/db/client';
import { heroSlides, media, projects } from '../src/server/db/schema';
import { variant } from '../src/server/media/process';

async function main() {
  const all = process.argv.includes('--all');
  const { db, sqlite } = openDatabase();
  const jobs: [string, number][] = [];
  for (const h of db.select({ id: heroSlides.mediaId }).from(heroSlides).all()) for (const w of [640, 960, 1280, 1920, 2560]) jobs.push([h.id, w]);
  // Covers: index thumbnails are cropped into 4:5 frames, so a retina screen asks for 1600 and 1920.
  for (const p of db.select({ id: projects.coverId }).from(projects).where(isNotNull(projects.coverId)).all()) for (const w of [160, 320, 480, 640, 960, 1280, 1600, 1920]) jobs.push([p.id!, w]);
  if (all) for (const m of db.select({ id: media.id }).from(media).where(eq(media.hidden, false)).all()) for (const w of [640, 960, 1280]) jobs.push([m.id, w]);
  let done = 0;
  const started = Date.now();
  const queue = [...jobs];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      await variant(j[0], j[1]);
      if (++done % 200 === 0) console.log(`${done}/${jobs.length}`);
    }
  }));
  console.log(`${jobs.length} sizes ready in ${Math.round((Date.now() - started) / 1000)} s`);
  sqlite.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
