'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { igApproveAction, igDisconnectAction, igIgnoreAction, igIgnoreOlderAction, igOptionsAction, igSaveTokenAction, igSyncNowAction } from '@/app/admin/instagram-actions';
import { Toast, useToast } from './Toast';

export function SyncNow() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <>
      <button className="a-btn a-btn--primary" disabled={pending} onClick={() => start(async () => {
        const r = await igSyncNowAction();
        toast.show(r.ok ? r.message ?? 'Done' : r.error, !r.ok);
        router.refresh();
      })}>{pending ? 'Checking Instagram' : 'Check now'}</button>
      <Toast {...toast} />
    </>
  );
}

export function InstagramConnection({ connected, username, expiresAt, lastSync, lastError, appReady }: {
  connected: boolean; username: string | null; expiresAt: string; lastSync: string; lastError: string | null; appReady: boolean;
}) {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [pending, start] = useTransition();
  const toast = useToast();
  if (connected) {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <p>Connected as <a href={`https://www.instagram.com/${username}/`} target="_blank" rel="noopener"><strong>@{username}</strong></a>. The connection renews itself; it would lapse on {expiresAt} only if the server stayed off until then.</p>
        <p className="a-muted">{lastSync ? `Last check ${lastSync}.` : 'Not checked yet.'}</p>
        {lastError ? <p className="a-error">{lastError}</p> : null}
        <div><button className="a-btn" disabled={pending} onClick={() => { if (window.confirm('Disconnect Instagram? New posts stop coming in.')) start(async () => { await igDisconnectAction(); router.refresh(); }); }}>Disconnect</button></div>
        <Toast {...toast} />
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p>Connect Kadjoe&apos;s Instagram (a professional account) so new project posts appear on the site by themselves. Kadjoe signs in on instagram.com; the site never sees the password.</p>
      {appReady ? <div><a className="a-btn a-btn--primary" href="/api/instagram/connect">Connect Instagram</a></div> : null}
      <form className="a-form" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await igSaveTokenAction(token); toast.show(r.ok ? r.message ?? 'Connected' : r.error, !r.ok); if (r.ok) router.refresh(); }); }}>
        <label className="a-field"><span>{appReady ? 'Or paste' : 'Paste'} an access token from the Meta app dashboard</span>
          <input className="a-input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="IGAA…" autoComplete="off" spellCheck={false} />
        </label>
        <div><button className="a-btn" disabled={pending || !token}>Save token</button></div>
      </form>
      <Toast {...toast} />
    </div>
  );
}

export function InstagramOptions({ autoPublish, importSince }: { autoPublish: boolean; importSince: string }) {
  const router = useRouter();
  const [v, setV] = useState({ autoPublish, importSince });
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <form className="a-form" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await igOptionsAction({ autoPublish: v.autoPublish, importSince: v.importSince || null }); toast.show(r.ok ? 'Saved' : r.error, !r.ok); router.refresh(); }); }}>
      <label className="a-check"><input type="checkbox" checked={v.autoPublish} onChange={(e) => setV({ ...v, autoPublish: e.target.checked })} /> Publish new projects at once (otherwise they arrive as drafts)</label>
      <p className="a-help">A post becomes a project when its caption has the usual lines (Client, Type, Location, Design, Photography). A post for a project that is already on the site adds its photographs to it. A post that could belong to two projects, or to none with certainty, waits below.</p>
      <label className="a-field" style={{ maxWidth: 260 }}><span>Import automatically from</span><input className="a-input" type="date" value={v.importSince} onChange={(e) => setV({ ...v, importSince: e.target.value })} /></label>
      <div><button className="a-btn" disabled={pending}>Save</button></div>
      <Toast {...toast} />
    </form>
  );
}

type Post = { shortcode: string; permalink: string | null; caption: string | null; postedAt: string; status: string; note: string | null; parsed: Record<string, unknown> | null };

export function InstagramInbox({ posts, projects }: { posts: Post[]; projects: { id: string; name: string; location: string | null }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();
  const older = posts.filter((p) => p.note?.startsWith('Posted before')).length;
  if (!posts.length) return <p className="a-muted">Nothing waiting.</p>;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {older ? (
        <div><button className="a-btn" disabled={pending} onClick={() => { if (window.confirm(`Ignore ${older} older post${older === 1 ? '' : 's'}?`)) start(async () => { await igIgnoreOlderAction(); router.refresh(); }); }}>Ignore {older} older post{older === 1 ? '' : 's'}</button></div>
      ) : null}
      {posts.map((p) => <InboxItem key={p.shortcode} post={p} projects={projects} onDone={(m, err) => { toast.show(m, err); router.refresh(); }} />)}
      <Toast {...toast} />
    </div>
  );
}

function InboxItem({ post, projects, onDone }: { post: Post; projects: { id: string; name: string; location: string | null }[]; onDone: (m: string, error?: boolean) => void }) {
  const parsed = post.parsed ?? {};
  const [form, setForm] = useState({
    name: String(parsed.name ?? ''), location: String(parsed.location ?? ''), year: String(parsed.year ?? post.postedAt.slice(-4)),
    category: guessCategory(String(parsed.type ?? '')), into: '',
  });
  const [pending, start] = useTransition();
  const approve = () => start(async () => {
    const r = await igApproveAction({ shortcode: post.shortcode, intoId: form.into || null, name: form.name || undefined, category: form.category, location: form.location || null, year: form.year || null });
    onDone(r.ok ? r.message ?? 'Imported' : r.error, !r.ok);
  });
  return (
    <article style={{ border: '1px solid var(--c-line)', padding: 14, display: 'grid', gap: 10, background: 'var(--c-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <a href={post.permalink ?? `https://www.instagram.com/p/${post.shortcode}/`} target="_blank" rel="noopener"><strong style={{ fontWeight: 500 }}>Post of {post.postedAt}</strong> ↗</a>
        <span className={`a-badge ${post.status === 'error' ? 'a-badge--warn' : ''}`}>{post.note ?? post.status}</span>
      </div>
      {post.caption ? <details><summary className="a-muted" style={{ cursor: 'pointer', fontSize: 13 }}>Caption</summary><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--f-sans)', fontSize: 13, marginTop: 6 }}>{post.caption}</pre></details> : null}
      <div className="a-row a-row--3">
        <label className="a-field"><span>Add to an existing project</span>
          <select className="a-select" value={form.into} onChange={(e) => setForm({ ...form, into: e.target.value })}>
            <option value="">No, create a new project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.location ? `, ${p.location}` : ''}</option>)}
          </select>
        </label>
        {!form.into ? (
          <>
            <label className="a-field"><span>Name</span><input className="a-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="a-field"><span>Category</span>
              <select className="a-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}>
                <option value="residential">Residential</option><option value="fnb">F&amp;B</option><option value="commercial">Commercial</option>
              </select>
            </label>
          </>
        ) : null}
      </div>
      {!form.into ? (
        <div className="a-row">
          <label className="a-field"><span>Location</span><input className="a-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
          <label className="a-field"><span>Year</span><input className="a-input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="a-btn a-btn--primary" disabled={pending || (!form.into && !form.name)} onClick={approve}>{pending ? 'Importing' : form.into ? 'Add photographs' : 'Create project'}</button>
        <button className="a-btn" disabled={pending} onClick={() => start(async () => { await igIgnoreAction([post.shortcode]); onDone('Ignored'); })}>Ignore</button>
        {form.into ? <Link className="a-btn a-btn--ghost" href={`/admin/projects/${form.into}`}>Open project</Link> : null}
      </div>
    </article>
  );
}

function guessCategory(type: string): 'residential' | 'fnb' | 'commercial' {
  const t = type.toLowerCase();
  if (/f\s*&\s*b|fnb|food|restaurant|caf|coffee|bar|bakery/.test(t)) return 'fnb';
  if (/retail|store|shop|office|clinic|wellness|spa|salon|bank|showroom|commercial/.test(t)) return 'commercial';
  return 'residential';
}
