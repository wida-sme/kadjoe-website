import { and, asc, eq } from 'drizzle-orm';
import { HeroManager } from '@/components/admin/HeroManager';
import { db } from '@/server/db/client';
import { projects } from '@/server/db/schema';
import { heroCandidates, listHero } from '@/server/admin/projects';
import { requireUser } from '@/server/auth';

export const metadata = { title: 'Home page' };

export default async function HeroPage({ searchParams }: PageProps<'/admin/hero'>) {
  // Layouts are not re-rendered on client navigation: every page checks the session itself.
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const slides = listHero();
  const featured = db.select({ id: projects.id, name: projects.name, coverId: projects.coverId, status: projects.status })
    .from(projects).where(and(eq(projects.featured, true))).orderBy(asc(projects.featuredOrder)).all();
  return (
    <>
      <header className="a-head"><h1>Home page</h1></header>
      <HeroManager slides={slides} candidates={heroCandidates(q)} q={q} featured={featured} />
    </>
  );
}
