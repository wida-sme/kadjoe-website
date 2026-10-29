import { ProfileBuilder } from '@/components/admin/ProfileBuilder';
import { CATEGORIES } from '@/server/db/schema';
import { candidatesFor, defaultConfig } from '@/server/profile/build';
import { requireUser } from '@/server/auth';

export const metadata = { title: 'Company profile' };

export default async function ProfilePage() {
  // Layouts are not re-rendered on client navigation: every page checks the session itself.
  await requireUser();
  const candidates = Object.fromEntries(CATEGORIES.map((c) => [c, candidatesFor(c)])) as Record<(typeof CATEGORIES)[number], ReturnType<typeof candidatesFor>>;
  return (
    <>
      <header className="a-head"><h1>Company profile</h1></header>
      <ProfileBuilder candidates={candidates} initial={defaultConfig()} />
    </>
  );
}
