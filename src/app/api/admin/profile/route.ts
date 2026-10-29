import { getUser } from '@/server/auth';
import { profileFileName, profileSchema, renderProfile } from '@/server/profile/build';

// GET /api/admin/profile?c=<base64url JSON config>[&download=1] → the company profile PDF.
export async function GET(req: Request) {
  if (!(await getUser())) return new Response('Sign in first', { status: 401 });
  const url = new URL(req.url);
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(url.searchParams.get('c') ?? '', 'base64url').toString('utf8'));
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const cfg = profileSchema.safeParse(raw);
  if (!cfg.success) return new Response('Bad request', { status: 400 });
  const pdf = await renderProfile(cfg.data);
  const name = profileFileName(cfg.data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(pdf.length),
      'content-disposition': `${url.searchParams.get('download') ? 'attachment' : 'inline'}; filename="${name}"`,
      'cache-control': 'private, no-store',
    },
  });
}
