// Sizes cut from a master: every width at quality 75 or more, and a size cut with an older recipe
// is cut again rather than served.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kadjoe-media-'));
process.env.KADJOE_SITE_DATA_DIR = dir;

let media: typeof import('@/server/media/process');
const id = 'TESTphoto001';

beforeAll(async () => {
  media = await import('@/server/media/process');
  const input = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 180, g: 150, b: 120 } } }).jpeg().toBuffer();
  await media.writeMaster(id, input);
});
afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('photograph sizes', () => {
  it('encodes every width a thumbnail can use (up to 1920) at quality 75 or more', () => {
    for (const w of media.WIDTHS.filter((x) => x <= 1920)) expect(media.variantQuality(w), `${w} px`).toBeGreaterThanOrEqual(75);
  });

  it('keeps the retina gallery widths (2240, 2560) at 72, where the bytes are largest', () => {
    expect([media.variantQuality(2240), media.variantQuality(2560)]).toEqual([72, 72]);
  });

  it('cuts a size again when the file on disk came from an older recipe', async () => {
    const stale = path.join(media.mediaDir(id), 'w480.webp'); // name used before the recipe was versioned
    fs.writeFileSync(stale, 'old bytes');
    const file = await media.variant(id, 480);
    expect(file).not.toBe(stale);
    expect(fs.existsSync(stale)).toBe(false);
    const meta = await sharp(file!).metadata();
    expect([meta.format, meta.width]).toEqual(['webp', 480]);
  });

  it('serves a size already cut with the current recipe without cutting it again', async () => {
    const first = await media.variant(id, 640);
    const mtime = fs.statSync(first!).mtimeMs;
    expect(await media.variant(id, 640)).toBe(first);
    expect(fs.statSync(first!).mtimeMs).toBe(mtime);
  });
});

describe('widths', () => {
  it('serves exactly the widths next/image asks for', async () => {
    const config = (await import('../next.config')).default;
    const asked = [...(config.images?.imageSizes ?? []), ...(config.images?.deviceSizes ?? [])].sort((a, b) => a - b);
    expect([...media.WIDTHS]).toEqual(asked);
  });
});
