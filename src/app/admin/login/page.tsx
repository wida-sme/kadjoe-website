import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/LoginForm';
import { getUser } from '@/server/auth';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await getUser()) redirect('/admin');
  return (
    <main className="a-login">
      <div className="a-login__card">
        <span className="a-login__brand" role="img" aria-label="Kadjoe" />
        <h1>Dashboard</h1>
        <LoginForm />
      </div>
    </main>
  );
}
