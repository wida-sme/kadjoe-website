import Link from 'next/link';
import { asc, desc } from 'drizzle-orm';
import { InstagramConnection, InstagramInbox, InstagramOptions, SyncNow } from '@/components/admin/InstagramPanels';
import { db } from '@/server/db/client';
import { igSyncRuns, projects } from '@/server/db/schema';
import { inbox, recentPosts } from '@/server/instagram/sync';
import { getInstagram } from '@/server/settings';
import { formatDay, formatWib } from '@/lib/format';
import { requireUser } from '@/server/auth';

export const metadata = { title: 'Instagram' };

const ERRORS: Record<string, string> = {
  app: 'The Meta app is not configured on the server (IG_APP_ID and IG_APP_SECRET). Paste a token instead, or ask the developer to add them.',
  state: 'The sign-in could not be verified. Try Connect again.',
  exchange: 'Instagram did not accept the sign-in. Try again, or paste a token.',
};

export default async function InstagramPage({ searchParams }: PageProps<'/admin/instagram'>) {
  // Layouts are not re-rendered on client navigation: every page checks the session itself.
  await requireUser();
  const sp = await searchParams;
  const s = getInstagram();
  const runs = db.select().from(igSyncRuns).orderBy(desc(igSyncRuns.id)).limit(8).all();
  const pending = inbox();
  const recent = recentPosts(20);
  const allProjects = db.select({ id: projects.id, name: projects.name, location: projects.location }).from(projects).orderBy(asc(projects.name)).all();
  const appReady = !!process.env.IG_APP_ID && !!process.env.IG_APP_SECRET;
  return (
    <>
      <header className="a-head">
        <h1>Instagram</h1>
        <div className="a-head__actions">{s.token ? <SyncNow /> : null}</div>
      </header>
      {typeof sp.error === 'string' && ERRORS[sp.error] ? <p className="a-error" role="alert" style={{ marginBottom: 16 }}>{ERRORS[sp.error]}</p> : null}
      {sp.connected ? <p className="a-ok" role="status" style={{ marginBottom: 16 }}>Instagram connected.</p> : null}

      <section className="a-panel">
        <h2>Connection</h2>
        <InstagramConnection connected={!!s.token} username={s.username} expiresAt={formatDay(s.expiresAt)} lastSync={formatWib(s.lastSyncAt)} lastError={s.lastError} appReady={appReady} />
      </section>

      <section className="a-panel">
        <h2>How new posts are handled</h2>
        <InstagramOptions autoPublish={s.autoPublish} importSince={s.importSince?.slice(0, 10) ?? ''} />
      </section>

      <section className="a-panel">
        <h2>Waiting for review <span className="a-muted a-num" style={{ fontWeight: 400 }}>{pending.length}</span></h2>
        <InstagramInbox posts={pending.map((p) => ({ shortcode: p.shortcode, permalink: p.permalink, caption: p.caption, postedAt: formatDay(p.postedAt), status: p.status, note: p.note, parsed: p.parsed as Record<string, unknown> | null }))} projects={allProjects} />
      </section>

      <section className="a-panel">
        <h2>Latest posts</h2>
        {recent.length ? (
          <table className="a-table">
            <thead><tr><th>Posted</th><th>Post</th><th>Result</th></tr></thead>
            <tbody>
              {recent.map(({ post, projectName }) => (
                <tr key={post.shortcode}>
                  <td className="a-num">{formatDay(post.postedAt)}</td>
                  <td><a href={post.permalink ?? `https://www.instagram.com/p/${post.shortcode}/`} target="_blank" rel="noopener">{(post.caption ?? post.shortcode).split('\n')[0].slice(0, 60)}</a></td>
                  <td>
                    {post.status === 'imported' && post.projectId ? <Link href={`/admin/projects/${post.projectId}`}>{projectName}</Link> : <span className="a-muted">{post.status === 'not_project' ? 'Not a project post' : 'Ignored'}</span>}
                    {post.note ? <span className="a-muted"> · {post.note}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="a-muted">Nothing yet.</p>}
      </section>

      <section className="a-panel">
        <h2>Checks</h2>
        {runs.length ? (
          <table className="a-table">
            <thead><tr><th>Started</th><th>By</th><th>Result</th></tr></thead>
            <tbody>{runs.map((r) => <tr key={r.id}><td>{formatWib(r.startedAt)}</td><td className="a-muted">{r.trigger}</td><td>{r.ok ? `${r.seen} new, ${r.imported} imported, ${r.pending} waiting` : <span className="a-error">{r.message}</span>}</td></tr>)}</tbody>
          </table>
        ) : <p className="a-muted">No checks yet. The server checks every 30 minutes once connected.</p>}
      </section>
    </>
  );
}
