import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { site } from '@/content/site';
import { getUser } from '@/server/auth';
import { authorizeUrl } from '@/server/instagram/api';

// Starts "Connect Instagram": Kadjoe signs in on instagram.com itself; the site never sees the password.
export async function GET(req: Request) {
  const base = new URL(req.url);
  if (!(await getUser())) return NextResponse.redirect(new URL('/admin/login', base));
  const appId = process.env.IG_APP_ID;
  if (!appId || !process.env.IG_APP_SECRET) return NextResponse.redirect(new URL('/admin/instagram?error=app', base));
  const state = randomBytes(16).toString('base64url');
  (await cookies()).set('kadjoe_ig_state', state, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600, secure: process.env.NODE_ENV === 'production' });
  return NextResponse.redirect(authorizeUrl(appId, `${site.url}/api/instagram/callback`, state));
}
