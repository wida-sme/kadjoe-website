import { NextResponse } from 'next/server';
import { site } from '@/content/site';
import { exchangeCode, getMe } from '@/server/instagram/api';
import { getInstagram, setInstagram } from '@/server/settings';

const TEN_MIN = 10 * 60_000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const finance = process.env.FINANCE_URL;
  if (!finance) {
    console.error('instagram callback: FINANCE_URL is not set, cannot send the user back to the finance app');
    return new Response('Server misconfigured', { status: 500 });
  }
  const back = (q: string) => NextResponse.redirect(`${finance.replace(/\/$/, '')}/website/instagram?${q}`);
  const { oauthState: state, oauthStateAt } = getInstagram();
  setInstagram({ oauthState: null, oauthStateAt: null }); // single use
  const fresh = !!oauthStateAt && Date.now() - Date.parse(oauthStateAt) < TEN_MIN;
  const code = url.searchParams.get('code');
  if (!code || !state || !fresh || state !== url.searchParams.get('state')) return back('error=state');
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
