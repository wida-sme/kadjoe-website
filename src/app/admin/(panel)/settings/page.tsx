import { asc } from 'drizzle-orm';
import { AccountForms, ClientsForm, ContactForm } from '@/components/admin/SettingsForms';
import { db } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { getClients, getContact } from '@/server/settings';
import { formatWib } from '@/lib/format';
import { requireUser } from '@/server/auth';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  // Layouts are not re-rendered on client navigation: every page checks the session itself.
  await requireUser();
  const accounts = db.select({ email: users.email, name: users.name, lastLoginAt: users.lastLoginAt }).from(users).orderBy(asc(users.name)).all();
  return (
    <>
      <header className="a-head"><h1>Settings</h1></header>
      <section className="a-panel"><h2>Contact</h2><ContactForm initial={getContact()} /></section>
      <section className="a-panel"><h2>Clients</h2><ClientsForm initial={getClients()} /></section>
      <section className="a-panel">
        <h2>Accounts</h2>
        <table className="a-table" style={{ marginBottom: 20 }}>
          <thead><tr><th>Name</th><th>Email</th><th>Last sign-in</th></tr></thead>
          <tbody>{accounts.map((a) => <tr key={a.email}><td>{a.name}</td><td>{a.email}</td><td className="a-muted">{formatWib(a.lastLoginAt) || 'never'}</td></tr>)}</tbody>
        </table>
        <AccountForms />
      </section>
    </>
  );
}
