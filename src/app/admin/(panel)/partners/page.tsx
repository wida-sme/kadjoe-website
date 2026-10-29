import { PartnersTable } from '@/components/admin/PartnersTable';
import { listPartners } from '@/server/admin/partners';
import { requireUser } from '@/server/auth';

export const metadata = { title: 'Partners' };

export default async function PartnersAdmin({ searchParams }: PageProps<'/admin/partners'>) {
  // Layouts are not re-rendered on client navigation: every page checks the session itself.
  await requireUser();
  const sp = await searchParams;
  const all = listPartners();
  const rows = sp.review === '1' ? all.filter((p) => p.needsReview) : all;
  return (
    <>
      <header className="a-head"><h1>Partners <span className="a-muted a-num" style={{ fontSize: 14 }}>{rows.length}</span></h1></header>
      <PartnersTable rows={rows} all={all} />
    </>
  );
}
