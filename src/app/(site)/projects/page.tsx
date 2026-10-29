import type { Metadata } from 'next';
import { ProjectsIndex } from '@/components/site/ProjectsIndex';
import { site } from '@/content/site';
import { CATEGORIES, type Category } from '@/server/db/schema';
import { designLine, getCategoryCounts, getProjects } from '@/server/site/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Projects',
  description: site.meta.projects,
  alternates: { canonical: '/projects' },
};

export default async function ProjectsPage({ searchParams }: PageProps<'/projects'>) {
  const q = await searchParams;
  const category = (CATEGORIES as readonly string[]).includes(String(q.category)) ? (q.category as Category) : null;
  const view = q.view === 'register' ? 'register' : 'photographs';
  const projects = getProjects().map((p) => ({
    no: p.no, slug: p.slug, name: p.name, category: p.category, typeLabel: p.typeLabel, location: p.location, year: p.year,
    design: designLine(p), cover: p.cover,
  }));
  return (
    <>
      <header className="page-head wrap">
        <div className="page-head__row">
          <h1 className="display" data-split="lines" data-intro>Projects</h1>
          <span className="page-head__count">{projects.length}</span>
        </div>
      </header>
      <ProjectsIndex projects={projects} counts={getCategoryCounts()} initialCategory={category} initialView={view} />
    </>
  );
}
