import fs from 'node:fs';
import { Readable } from 'node:stream';
import { variant, WIDTHS } from '@/server/media/process';

// GET /media/<id>/<width>.webp: one size of one photograph. Ids never change content, so every
// response is cacheable forever.
const ID = /^[A-Za-z0-9_-]{12}$/;

export async function GET(_req: Request, ctx: RouteContext<'/media/[id]/[file]'>) {
  const { id, file } = await ctx.params;
  const m = /^(\d{2,4})\.webp$/.exec(file);
  const width = m ? Number(m[1]) : NaN;
  if (!ID.test(id) || !(WIDTHS as readonly number[]).includes(width)) return new Response('Not found', { status: 404 });
  const path = await variant(id, width);
  if (!path) return new Response('Not found', { status: 404 });
  const stat = fs.statSync(path);
  return new Response(Readable.toWeb(fs.createReadStream(path)) as ReadableStream, {
    headers: {
      'content-type': 'image/webp',
      'content-length': String(stat.size),
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
