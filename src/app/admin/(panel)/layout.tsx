import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { logoutAction } from '@/app/admin/actions';
import { AdminNav } from '@/components/admin/AdminNav';
import { requireUser } from '@/server/auth';
import { db } from '@/server/db/client';
import { igPosts, partners } from '@/server/db/schema';

export default async function PanelLayout({ children }: LayoutProps<'/admin'>) {
  const user = await requireUser();
  const pending = db.select({ n: sql<number>`count(*)` }).from(igPosts).where(sql`${igPosts.status} = 'pending'`).get()?.n ?? 0;
  const review = db.select({ n: sql<number>`count(*)` }).from(partners).where(sql`${partners.needsReview} = 1`).get()?.n ?? 0;
  return (
    <div className="a-shell">
      <aside className="a-side">
        <Link href="/admin" className="a-brand" aria-label="Dashboard home"><span className="logo-mask" /></Link>
        <AdminNav pending={pending} review={review} />
        <div className="a-side__foot">
          <span className="a-muted">{user.name}</span>
          <a href="/" target="_blank" rel="noopener">Open the website ↗</a>
          <form action={logoutAction}><button className="a-link" type="submit">Sign out</button></form>
        </div>
      </aside>
      <div className="a-main">{children}</div>
    </div>
  );
}
