import Link from 'next/link';
import { desc, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { heroSlides, igPosts, igSyncRuns, media, partners, projects } from '@/server/db/schema';
import { getInstagram } from '@/server/settings';
import { formatWib } from '@/lib/format';
import { requireUser } from '@/server/auth';

export const metadata = { title: 'Overview' };

const count = (q: { get: () => { n: number } | undefined }) => q.get()?.n ?? 0;

export default async function Overview() {
  // Layouts are not re-rendered on client navigation: every page checks the session itself.
  await requireUser();
  const n = sql<number>`count(*)`;
  const published = count(db.select({ n }).from(projects).where(sql`${projects.status} = 'published'`));
  const drafts = count(db.select({ n }).from(projects).where(sql`${projects.status} = 'draft'`));
  const photos = count(db.select({ n }).from(media));
  const hero = count(db.select({ n }).from(heroSlides));
  const studios = count(db.select({ n }).from(partners).where(sql`${partners.kind} = 'design'`));
  const review = count(db.select({ n }).from(partners).where(sql`${partners.needsReview} = 1`));
  const pending = count(db.select({ n }).from(igPosts).where(sql`${igPosts.status} = 'pending'`));
  const ig = getInstagram();
  const lastRun = db.select().from(igSyncRuns).orderBy(desc(igSyncRuns.id)).limit(1).get();

  return (
    <>
      <header className="a-head"><h1>Overview</h1></header>
      <div className="a-grid-stats">
        <Link className="a-stat" href="/admin/projects?status=published"><span className="a-label">Published projects</span><strong>{published}</strong></Link>
        <Link className="a-stat" href="/admin/projects?status=draft"><span className="a-label">Drafts</span><strong>{drafts}</strong></Link>
        <div className="a-stat"><span className="a-label">Photographs</span><strong>{photos}</strong></div>
        <Link className="a-stat" href="/admin/hero"><span className="a-label">Hero photographs</span><strong>{hero}</strong></Link>
        <Link className="a-stat" href="/admin/partners"><span className="a-label">Design studios</span><strong>{studios}</strong></Link>
      </div>

      <section className="a-panel">
        <h2>Instagram</h2>
        {ig.token ? (
          <p>
            Connected as <strong>@{ig.username ?? 'account'}</strong>.{' '}
            {lastRun ? <>Last check {formatWib(lastRun.startedAt)}: {lastRun.ok ? `${lastRun.imported} imported, ${lastRun.pending} waiting` : `failed (${lastRun.message ?? 'error'})`}.</> : 'Not checked yet.'}
          </p>
        ) : (
          <p>Not connected. New posts are not imported until the account is connected.</p>
        )}
        <p style={{ marginTop: 10 }}><Link href="/admin/instagram">{pending ? `${pending} post${pending === 1 ? '' : 's'} waiting for review` : 'Open Instagram'}</Link></p>
      </section>

      {review ? (
        <section className="a-panel">
          <h2>Partners to check</h2>
          <p>{review} partner{review === 1 ? ' has' : 's have'} only an Instagram handle as a name. <Link href="/admin/partners?review=1">Add the real names</Link>.</p>
        </section>
      ) : null}
    </>
  );
}
