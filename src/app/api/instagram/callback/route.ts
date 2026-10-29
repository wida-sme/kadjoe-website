import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { site } from '@/content/site';
import { getUser } from '@/server/auth';
import { exchangeCode, getMe } from '@/server/instagram/api';
import { setInstagram } from '@/server/settings';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/admin/instagram?${q}`, url));
  if (!(await getUser())) return NextResponse.redirect(new URL('/admin/login', url));
  const jar = await cookies();
  const state = jar.get('kadjoe_ig_state')?.value;
  jar.delete('kadjoe_ig_state');
  const code = url.searchParams.get('code');
  if (!code || !state || state !== url.searchParams.get('state')) return back('error=state');
  try {
    const t = await exchangeCode(process.env.IG_APP_ID!, process.env.IG_APP_SECRET!, `${site.url}/api/instagram/callback`, code);
    const me = await getMe(t.token);
    setInstagram({
      token: t.token, userId: me.user_id ?? t.userId, username: me.username, connectedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + t.expiresIn * 1000).toISOString(), lastError: null,
    });
    return back('connected=1');
  } catch {
    return back('error=exchange');
  }
}
