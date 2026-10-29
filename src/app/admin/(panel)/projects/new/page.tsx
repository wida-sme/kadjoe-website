import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { ProjectForm } from '@/components/admin/ProjectForm';
import { db } from '@/server/db/client';
import { partners } from '@/server/db/schema';
import { requireUser } from '@/server/auth';

export const metadata = { title: 'New project' };

export default async function NewProject() {
  // Layouts are not re-rendered on client navigation: every page checks the session itself.
  await requireUser();
  const options = db.select({ id: partners.id, name: partners.name, kind: partners.kind, instagram: partners.instagram }).from(partners).orderBy(asc(partners.name)).all();
  return (
    <>
      <header className="a-head">
        <div><Link className="a-crumb" href="/admin/projects">Projects</Link><h1>New project</h1></div>
      </header>
      <ProjectForm
        id={null}
        partners={options}
        initial={{
          name: '', slug: '', category: 'residential', typeLabel: '', location: '', year: String(new Date().getFullYear()), service: 'Build',
          inHouse: false, description: '', status: 'draft', featured: false, sortDate: new Date().toISOString().slice(0, 10), designers: [], photographers: [],
        }}
      />
      <p className="a-help" style={{ marginTop: 16 }}>Photographs are added after the project is created.</p>
    </>
  );
}
