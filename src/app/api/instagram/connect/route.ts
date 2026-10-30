import { NextResponse } from 'next/server';
import { getUser } from '@/server/auth';
import { WRITE } from '@/server/internal/ops';

// Legacy /admin "Connect Instagram" (the finance app calls instagram.authorizeUrl directly); goes away with /admin.
export async function GET(req: Request) {
  const base = new URL(req.url);
  if (!(await getUser())) return NextResponse.redirect(new URL('/admin/login', base));
  const r = await WRITE['instagram.authorizeUrl']({});
  return NextResponse.redirect(r.ok ? r.message! : new URL('/admin/instagram?error=app', base));
}
