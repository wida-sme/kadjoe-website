import { checkToken } from '@/server/internal/auth';
import { READ, WRITE } from '@/server/internal/ops';
import { profileFileName, profileSchema, renderProfile } from '@/server/profile/build';

// The finance app's door into the dashboard: GET <readOp>?params, POST <writeOp> with JSON (multipart
// for photos.upload). Bearer token only; there is no session here.
export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const bad = (code: string, status = 400) => json({ ok: false, code }, status);
type Ctx = { params: Promise<{ op: string }> };
const has = (o: object, k: string) => Object.hasOwn(o, k);

export async function GET(req: Request, { params }: Ctx) {
  if (!checkToken(req)) return new Response('Unauthorized', { status: 401 });
  const { op } = await params;
  const url = new URL(req.url);

  try {
  if (op === 'profile.pdf') {
    let raw: unknown;
    try { raw = JSON.parse(Buffer.from(url.searchParams.get('c') ?? '', 'base64url').toString('utf8')); } catch { return bad('invalid'); }
    const cfg = profileSchema.safeParse(raw);
    if (!cfg.success) return bad('invalid');
    const pdf = await renderProfile(cfg.data, { preview: url.searchParams.get('preview') === '1' });
    return new Response(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-length': String(pdf.length),
        'content-disposition': `${url.searchParams.get('download') ? 'attachment' : 'inline'}; filename="${profileFileName(cfg.data)}"`,
        'cache-control': 'private, no-store',
      },
    });
  }

  if (!has(READ, op)) return bad('not_found', 404);
  const data = READ[op](url.searchParams);
  return data === null ? bad('not_found', 404) : json(data);
  } catch (e) {
    console.error(`internal ${op}`, e);
    return bad('failed', 500);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  if (!checkToken(req)) return new Response('Unauthorized', { status: 401 });
  const { op } = await params;
  if (!has(WRITE, op)) return bad('not_found', 404);
  let body: unknown;
  try {
    body = (req.headers.get('content-type') ?? '').startsWith('multipart/form-data') ? await req.formData() : await req.json();
  } catch {
    return bad('invalid');
  }
  try {
    const r = await WRITE[op](body);
    if (r.ok) return json(r);
    return json({ ok: false, code: r.code }, 400);
  } catch (e) {
    console.error(`internal ${op}`, e);
    return bad('failed', 500);
  }
}
