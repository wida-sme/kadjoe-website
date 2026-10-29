import Link from 'next/link';
import { CATEGORIES, PROJECT_STATUSES, type Category, type ProjectStatus } from '@/server/db/schema';
import { listProjects } from '@/server/admin/projects';
import { CATEGORY_LABEL } from '@/server/site/queries';
import { ProjectRowActions } from '@/components/admin/ProjectRowActions';
import { requireUser } from '@/server/auth';

export const metadata = { title: 'Projects' };

export default async function ProjectsAdmin({ searchParams }: PageProps<'/admin/projects'>) {
  // Layouts are not re-rendered on client navigation: every page checks the session itself.
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const category = (CATEGORIES as readonly string[]).includes(String(sp.category)) ? (sp.category as Category) : null;
  const status = (PROJECT_STATUSES as readonly string[]).includes(String(sp.status)) ? (sp.status as ProjectStatus) : null;
  const rows = listProjects({ q, category, status });
  return (
    <>
      <header className="a-head">
        <h1>Projects <span className="a-muted a-num" style={{ fontSize: 14 }}>{rows.length}</span></h1>
        <div className="a-head__actions"><Link className="a-btn a-btn--primary" href="/admin/projects/new">New project</Link></div>
      </header>
      <form className="a-toolbar" role="search">
        <input className="a-input" type="search" name="q" defaultValue={q} placeholder="Search name or location" aria-label="Search" />
        <select className="a-select" name="category" defaultValue={category ?? ''} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <select className="a-select" name="status" defaultValue={status ?? ''} aria-label="Status">
          <option value="">Any status</option>
          {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <button className="a-btn">Filter</button>
        {q || category || status ? <Link className="a-btn a-btn--ghost" href="/admin/projects">Clear</Link> : null}
      </form>
      <table className="a-table">
        <thead>
          <tr><th style={{ width: 70 }} /><th>Project</th><th>Category</th><th>Design</th><th>Year</th><th className="a-num">Photos</th><th>Status</th><th>Home</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <td>{r.coverId ? <img className="a-thumb" src={`/media/${r.coverId}/160.webp`} alt="" loading="lazy" /> : <span className="a-thumb" style={{ display: 'block' }} />}</td>
              <td>
                <Link href={`/admin/projects/${r.id}`}><strong style={{ fontWeight: 500 }}>{r.name}</strong></Link>
                <div className="a-muted" style={{ fontSize: 13 }}>{r.location ?? ''}</div>
              </td>
              <td>{CATEGORY_LABEL[r.category]}</td>
              <td className="a-muted" style={{ fontSize: 13 }}>{r.designers.join(', ')}</td>
              <td className="a-num">{r.year ?? ''}</td>
              <td className="a-num">{r.photos}</td>
              <td><span className={`a-badge a-badge--${r.status}`}>{r.status}</span>{r.source === 'instagram' ? <span className="a-badge" style={{ marginLeft: 4 }}>IG</span> : null}</td>
              <td><ProjectRowActions id={r.id} featured={r.featured} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
