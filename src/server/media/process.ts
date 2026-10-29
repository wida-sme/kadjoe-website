import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { MEDIA_DIR } from '../paths';

// Every photograph is stored once as a master (long edge at most MASTER_EDGE, WebP, sRGB, no
// metadata). The sizes the site asks for are cut from it on first request and kept on disk.
export const MASTER_EDGE = 2560;
export const WIDTHS = [160, 320, 480, 640, 960, 1280, 1600, 1920, 2560] as const;

sharp.cache(false);
sharp.concurrency(2);

export const mediaDir = (id: string) => path.join(/*turbopackIgnore: true*/ MEDIA_DIR, id);
export const masterPath = (id: string) => path.join(/*turbopackIgnore: true*/ mediaDir(id), 'master.webp');

export type Processed = {
  width: number;
  height: number;
  blur: string;
  color: string;
  hash: string;
  bytes: number;
};

/** Writes the master for `id` and returns what the database keeps about it. */
export async function writeMaster(id: string, input: Buffer | string): Promise<Processed> {
  const dir = mediaDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const base = sharp(input, { failOn: 'none', limitInputPixels: 268_402_689 }).rotate().toColourspace('srgb');
  const master = await base
    .clone()
    .resize({ width: MASTER_EDGE, height: MASTER_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88, effort: 5, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
  fs.writeFileSync(masterPath(id), master.data);
  const [blur, color, hash] = await Promise.all([blurOf(master.data), colorOf(master.data), dhash(master.data)]);
  return { width: master.info.width, height: master.info.height, blur, color, hash, bytes: master.data.length };
}

async function blurOf(buf: Buffer) {
  const tiny = await sharp(buf).resize({ width: 20 }).webp({ quality: 40 }).toBuffer();
  return `data:image/webp;base64,${tiny.toString('base64')}`;
}

async function colorOf(buf: Buffer) {
  const { dominant } = await sharp(buf).stats();
  return `#${[dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** 64-bit difference hash: near-identical photographs (re-exports, re-uploads) differ by a few bits. */
export async function dhash(buf: Buffer) {
  const px = await sharp(buf).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? '1' : '0';
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
}

export function hashDistance(a: string, b: string) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

/** Path of the WebP at `width`, cut from the master on first use. Width must be one of WIDTHS. */
export async function variant(id: string, width: number) {
  const file = path.join(/*turbopackIgnore: true*/ mediaDir(id), `w${width}.webp`);
  if (fs.existsSync(file)) return file;
  const src = masterPath(id);
  if (!fs.existsSync(src)) return null;
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await sharp(src)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: width <= 480 || width >= 1600 ? 72 : 76, effort: 4, smartSubsample: true })
    .toFile(tmp);
  fs.renameSync(tmp, file); // atomic: a concurrent request never reads half a file
  return file;
}

/** JPEG for the company profile PDF (react-pdf cannot read WebP). Cached like the WebP sizes. */
export async function jpeg(id: string, width: number) {
  const file = path.join(/*turbopackIgnore: true*/ mediaDir(id), `p${width}.jpg`);
  if (fs.existsSync(file)) return file;
  const src = masterPath(id);
  if (!fs.existsSync(src)) return null;
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await sharp(src).resize({ width, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(tmp);
  fs.renameSync(tmp, file);
  return file;
}

export function removeMediaFiles(id: string) {
  fs.rmSync(mediaDir(id), { recursive: true, force: true });
}
