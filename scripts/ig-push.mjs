#!/usr/bin/env node
// Reads @kadjoe_id's public profile in headless Chrome and sends new posts to the site's /api/instagram/push.
// Runs on a Mac on a home or office connection: Instagram sends server addresses to its login page.
// No Instagram login, no packages. Config: ~/.config/kadjoe/ig-push.env (IG_PUSH_URL, IG_PUSH_TOKEN).
// Usage: node scripts/ig-push.mjs [--dry]   (launchd runs it once a day; --dry prints what it would send)
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USERNAME = 'kadjoe_id';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** Every post object in the page's embedded JSON, by shortcode. The profile page holds the latest 12. */
export function postsIn(html) {
  const found = new Map();
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    if (typeof o.code === 'string' && 'caption' in o) {
      // The post page has a richer copy (taken_at, carousel_media) than the profile grid: keep the richest.
      const prev = found.get(o.code);
      if (!prev || (!prev.taken_at && o.taken_at)) found.set(o.code, o);
    }
    Object.values(o).forEach(walk);
  };
  for (const [, body] of html.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { walk(JSON.parse(body)); } catch { /* not every script is JSON */ }
  }
  return found;
}

/** The link without a size cut (stp=…) is the original; otherwise the largest square cut. */
export function bestUrl(item) {
  const c = (item.image_versions2?.candidates ?? []).map((x) => x.url).filter(Boolean);
  const size = (u) => Number(/_s(\d+)x\d+/.exec(u)?.[1] ?? 0);
  return c.find((u) => !/[?&]stp=/.test(u)) ?? c.sort((a, b) => size(b) - size(a))[0];
}

const TYPE = { 1: 'IMAGE', 2: 'VIDEO', 8: 'CAROUSEL_ALBUM' };

/** A post page's object → the Instagram Graph API's shape, which the site's import already reads. */
export function toIgMedia(p) {
  if (!p.taken_at) throw new Error(`post ${p.code}: no taken_at`);
  const type = TYPE[p.media_type] ?? 'IMAGE';
  /** @type {Record<string, any>} */
  const m = {
    id: String(p.pk ?? p.id), shortcode: p.code, caption: p.caption?.text ?? undefined, media_type: type,
    permalink: `https://www.instagram.com/p/${p.code}/`, timestamp: new Date(p.taken_at * 1000).toISOString(),
  };
  if (type === 'IMAGE') m.media_url = bestUrl(p);
  if (type === 'CAROUSEL_ALBUM') {
    m.children = { data: (p.carousel_media ?? []).map((k) => k.media_type === 1
      ? { id: String(k.pk), media_type: 'IMAGE', media_url: bestUrl(k) }
      : { id: String(k.pk), media_type: 'VIDEO' }) };
  }
  return m;
}

/** Loads a page in a fresh, empty Chrome profile (never logged in) and returns the rendered HTML. */
function dump(url) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-push-'));
  return new Promise((resolve, reject) => {
    execFile(CHROME, ['--headless=new', `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1440,900',
      '--virtual-time-budget=20000', '--dump-dom', url], { maxBuffer: 64 * 1024 * 1024, timeout: 90_000 }, (err, out) => {
      fs.rmSync(profile, { recursive: true, force: true });
      if (err) reject(new Error(`Chrome failed on ${url}: ${err.message}`)); else resolve(out);
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A steady cadence is a bot signal; 5-12 s between pages.
const pause = () => sleep(5000 + Math.random() * 7000);

async function main() {
  const dry = process.argv.includes('--dry');
  const env = path.join(os.homedir(), '.config/kadjoe/ig-push.env');
  if (fs.existsSync(env)) process.loadEnvFile(env);
  const { IG_PUSH_URL: url, IG_PUSH_TOKEN: token } = process.env;
  if (!dry && (!url || !token)) throw new Error(`Set IG_PUSH_URL and IG_PUSH_TOKEN in ${env}`);
  const auth = { authorization: `Bearer ${token}` };

  const grid = postsIn(await dump(`https://www.instagram.com/${USERNAME}/`));
  // No posts means a login wall or a changed page; fail loudly so the missing push run shows on the dashboard.
  if (!grid.size) throw new Error('No posts on the profile page (login wall or a changed page)');
  const codes = [...grid.keys()];

  let need = codes;
  if (!dry) {
    const r = await fetch(`${url}?codes=${codes.join(',')}`, { headers: auth, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`Site answered ${r.status} to the code check`);
    need = (await r.json()).need;
  }
  console.log(`${new Date().toISOString()} profile: ${codes.length} posts, ${need.length} to send`);

  const posts = [];
  for (const code of need) {
    await pause();
    const p = postsIn(await dump(`https://www.instagram.com/p/${code}/`)).get(code);
    if (!p?.taken_at) { console.warn(`  ${code}: no post data, skipped (sent next run)`); continue; }
    posts.push(toIgMedia(p));
  }
  posts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (dry) {
    for (const m of posts) console.log(' ', m.timestamp.slice(0, 10), m.shortcode, m.children?.data.length ?? 1, 'photos |', (m.caption ?? '').split('\n')[0].slice(0, 50));
    return;
  }
  // Sent even when empty, so each daily run shows on the dashboard.
  const r = await fetch(url, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ posts }), signal: AbortSignal.timeout(10 * 60_000) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Site answered ${r.status}: ${JSON.stringify(body).slice(0, 200)}`);
  console.log(`  sent ${posts.length}: ${body.imported} imported, ${body.pending} waiting`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`${new Date().toISOString()} ${e.message}`); process.exit(1); });
}
