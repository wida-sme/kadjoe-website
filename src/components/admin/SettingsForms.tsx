'use client';
import { useActionState, useState, useTransition } from 'react';
import { addUserAction, changePasswordAction, saveClientsAction, saveContactAction } from '@/app/admin/actions';
import type { Contact } from '@/server/settings';
import { Toast, useToast } from './Toast';

export function ContactForm({ initial }: { initial: Contact }) {
  const [v, setV] = useState({ ...initial, address: initial.addressLines.join('\n') });
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <form className="a-form" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await saveContactAction({ email: v.email, phone: v.phone, instagram: v.instagram, mapsUrl: v.mapsUrl, addressLines: v.address.split('\n').map((l) => l.trim()).filter(Boolean) });
        toast.show(r.ok ? 'Saved' : r.error, !r.ok);
      });
    }}>
      <div className="a-row a-row--3">
        <label className="a-field"><span>Email</span><input className="a-input" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required /></label>
        <label className="a-field"><span>Phone (optional)</span><input className="a-input" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="+62 ..." /></label>
        <label className="a-field"><span>Instagram</span><input className="a-input" value={v.instagram} onChange={(e) => setV({ ...v, instagram: e.target.value })} required /></label>
      </div>
      <label className="a-field"><span>Address (one line per row)</span><textarea className="a-textarea" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} rows={3} /></label>
      <label className="a-field"><span>Google Maps link</span><input className="a-input" type="url" value={v.mapsUrl} onChange={(e) => setV({ ...v, mapsUrl: e.target.value })} required /></label>
      <div><button className="a-btn a-btn--primary" disabled={pending}>Save contact</button></div>
      <Toast {...toast} />
    </form>
  );
}

export function ClientsForm({ initial }: { initial: string[] }) {
  const [text, setText] = useState(initial.join('\n'));
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <form className="a-form" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveClientsAction(text.split('\n')); toast.show(r.ok ? 'Saved' : r.error, !r.ok); }); }}>
      <label className="a-field"><span>One client per line. Shown on About Us and in the company profile.</span>
        <textarea className="a-textarea" value={text} onChange={(e) => setText(e.target.value)} rows={10} />
      </label>
      <div><button className="a-btn a-btn--primary" disabled={pending}>Save clients</button></div>
      <Toast {...toast} />
    </form>
  );
}

export function AccountForms() {
  const [pw, pwAction, pwPending] = useActionState(changePasswordAction, null);
  const [add, addAction, addPending] = useActionState(addUserAction, null);
  return (
    <div className="a-row">
      <form action={pwAction} className="a-form">
        <strong style={{ fontWeight: 500 }}>Change your password</strong>
        <label className="a-field"><span>Current password</span><input className="a-input" type="password" name="current" autoComplete="current-password" required /></label>
        <label className="a-field"><span>New password (10+ characters)</span><input className="a-input" type="password" name="next" autoComplete="new-password" minLength={10} required /></label>
        {pw && !pw.ok ? <p className="a-error" role="alert">{pw.error}</p> : null}
        <div><button className="a-btn" disabled={pwPending}>Change password</button></div>
      </form>
      <form action={addAction} className="a-form">
        <strong style={{ fontWeight: 500 }}>Add an account</strong>
        <label className="a-field"><span>Name</span><input className="a-input" name="name" required /></label>
        <label className="a-field"><span>Email</span><input className="a-input" type="email" name="email" required /></label>
        <label className="a-field"><span>Password (10+ characters)</span><input className="a-input" type="password" name="password" autoComplete="new-password" minLength={10} required /></label>
        {add ? <p className={add.ok ? 'a-ok' : 'a-error'} role="status">{add.ok ? add.message : add.error}</p> : null}
        <div><button className="a-btn" disabled={addPending}>Add account</button></div>
      </form>
    </div>
  );
}
