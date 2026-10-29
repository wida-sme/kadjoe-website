'use client';
import { useActionState } from 'react';
import { loginAction } from '@/app/admin/actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="a-form">
      <label className="a-field">
        <span>Email</span>
        <input className="a-input" type="email" name="email" autoComplete="username" required autoFocus />
      </label>
      <label className="a-field">
        <span>Password</span>
        <input className="a-input" type="password" name="password" autoComplete="current-password" required />
      </label>
      {state && !state.ok ? <p className="a-error" role="alert">{state.error}</p> : null}
      <button className="a-btn a-btn--primary" disabled={pending}>{pending ? 'Signing in' : 'Sign in'}</button>
    </form>
  );
}
