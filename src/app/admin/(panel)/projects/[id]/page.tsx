import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { DeleteProject, MergeProject } from '@/components/admin/ProjectDanger';
import { PhotoManager } from '@/components/admin/PhotoManager';
import { ProjectForm } from '@/components/admin/ProjectForm';
import { db } from '@/server/db/client';
import { partners, projects } from '@/server/db/schema';
import { getProjectForEdit } from '@/server/admin/projects';
import { formatDay } from '@/lib/format';
import { getUser, requireUser } from '@/server/auth';

export async function generateMetadata({ params }: PageProps<'/admin/projects/[id]'>) {
  if (!(await getUser())) return { title: 'Project' };
  const { id } = await params;
  return { title: getProjectForEdit(id)?.project.name ?? 'Project' };
}

export default async function EditProject({ params }: PageProps<'/admin/projects/[id]'>) {
  // Layouts are not re-rendered on client navigation: every page checks the session itself.
  await requireUser();
  const { id } = await params;
  const data = getProjectForEdit(id);
  if (!data) notFound();
  const { project: p } = data;
  const options = db.select({ id: partners.id, name: partners.name, kind: partners.kind, instagram: partners.instagram }).from(partners).orderBy(asc(partners.name)).all();
  const others = db.select({ id: projects.id, name: projects.name, location: projects.location }).from(projects).orderBy(asc(projects.name)).all();
  return (
    <>
      <header className="a-head">
        <div>
          <Link className="a-crumb" href="/admin/projects">Projects</Link>
          <h1>{p.name} <span className={`a-badge a-badge--${p.status}`} style={{ verticalAlign: 'middle' }}>{p.status}</span></h1>
        </div>
        <div className="a-head__actions">
          {p.status === 'published' ? <a className="a-btn" href={`/projects/${p.slug}`} target="_blank" rel="noopener">View on the site ↗</a> : null}
        </div>
      </header>
      <ProjectForm
        id={p.id}
        partners={options}
        initial={{
          name: p.name, slug: p.slug, category: p.category, typeLabel: p.typeLabel ?? '', location: p.location ?? '', year: p.year ?? '',
          service: p.service ?? '', inHouse: p.inHouse, description: p.description ?? '', status: p.status, featured: p.featured,
          sortDate: p.sortDate, designers: data.designers, photographers: data.photographers,
        }}
      />
      <div style={{ height: 28 }} />
      <PhotoManager
        projectId={p.id}
        projectName={p.name}
        coverId={p.coverId}
        projects={others}
        photos={data.photos.map((m) => ({ id: m.id, width: m.width, height: m.height, hidden: m.hidden, inHero: m.inHero, alt: m.alt, focalX: m.focalX, focalY: m.focalY, source: m.source, igShortcode: m.igShortcode }))}
      />
      {data.posts.length ? (
        <section className="a-panel">
          <h2>Instagram posts</h2>
          <ul style={{ display: 'grid', gap: 6, fontSize: 14 }}>
            {data.posts.map((post) => (
              <li key={post.shortcode}>
                <a href={post.permalink ?? `https://www.instagram.com/p/${post.shortcode}/`} target="_blank" rel="noopener">{post.shortcode}</a>
                <span className="a-muted"> · {formatDay(post.postedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="a-panel">
        <h2>Merge or delete</h2>
        <div style={{ display: 'grid', gap: 18 }}>
          <MergeProject id={p.id} projects={others.filter((o) => o.id !== p.id)} />
          <DeleteProject id={p.id} name={p.name} />
        </div>
      </section>
    </>
  );
}
