'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deletePartnerAction, mergePartnerAction, savePartnerAction } from '@/app/admin/actions';
import { Toast, useToast } from './Toast';

type Row = { id: string; slug: string; name: string; kind: 'design' | 'photo'; instagram: string | null; website: string | null; needsReview: boolean; projects: number };
const EMPTY = { name: '', kind: 'design' as const, instagram: '', website: '' };

export function PartnersTable({ rows, all }: { rows: Row[]; all: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<{ name: string; kind: 'design' | 'photo'; instagram: string; website: string }>(EMPTY);
  const [pending, start] = useTransition();
  const toast = useToast();

  const open = (r: Row | null) => {
    setEditing(r ? r.id : 'new');
    setForm(r ? { name: r.name.replace(/^@/, r.needsReview ? '' : '@'), kind: r.kind, instagram: r.instagram ?? '', website: r.website ?? '' } : EMPTY);
  };
  const save = () => start(async () => {
    const r = await savePartnerAction(editing === 'new' ? null : editing, form);
    if (!r.ok) return toast.show(r.error, true);
    toast.show('Saved');
    setEditing(null);
    router.refresh();
  });

  const editor = (
    <tr>
      <td colSpan={5}>
        <div className="a-row a-row--3" style={{ padding: '8px 0' }}>
          <label className="a-field"><span>Name</span><input className="a-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></label>
          <label className="a-field"><span>Instagram</span><input className="a-input" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="handle" /></label>
          <label className="a-field"><span>Kind</span>
            <select className="a-select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'design' | 'photo' })}>
              <option value="design">Design studio</option><option value="photo">Photographer</option>
            </select>
          </label>
        </div>
        <label className="a-field" style={{ maxWidth: 520 }}><span>Website (optional)</span><input className="a-input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" /></label>
        <div style={{ display: 'flex', gap: 8, margin: '12px 0 6px' }}>
          <button className="a-btn a-btn--primary" disabled={pending} onClick={save}>Save</button>
          <button className="a-btn" onClick={() => setEditing(null)}>Cancel</button>
        </div>
      </td>
    </tr>
  );

  return (
    <>
      <div className="a-toolbar"><button className="a-btn a-btn--primary" onClick={() => open(null)}>New partner</button></div>
      <table className="a-table">
        <thead><tr><th>Name</th><th>Kind</th><th>Instagram</th><th className="a-num">Projects</th><th /></tr></thead>
        <tbody>
          {editing === 'new' ? editor : null}
          {rows.map((r) => editing === r.id ? <Editor key={r.id}>{editor}</Editor> : (
            <tr key={r.id}>
              <td>{r.name} {r.needsReview ? <span className="a-badge a-badge--warn">check name</span> : null}</td>
              <td className="a-muted">{r.kind === 'design' ? 'Design studio' : 'Photographer'}</td>
              <td>{r.instagram ? <a href={`https://www.instagram.com/${r.instagram}/`} target="_blank" rel="noopener">@{r.instagram}</a> : <span className="a-muted">none</span>}</td>
              <td className="a-num">{r.projects}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="a-btn a-btn--sm" onClick={() => open(r)}>Edit</button>{' '}
                <MergeMenu row={r} all={all} onDone={() => { toast.show('Merged'); router.refresh(); }} />{' '}
                {r.projects === 0 ? <button className="a-btn a-btn--sm a-btn--danger" onClick={() => start(async () => { await deletePartnerAction(r.id); router.refresh(); })}>Delete</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Toast {...toast} />
    </>
  );
}

const Editor = ({ children }: { children: React.ReactNode }) => <>{children}</>;

function MergeMenu({ row, all, onDone }: { row: Row; all: Row[]; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <select className="a-select" style={{ width: 'auto', height: 30, fontSize: 13 }} value="" disabled={pending} aria-label={`Merge ${row.name} into`}
      onChange={(e) => {
        const into = e.target.value;
        const target = all.find((a) => a.id === into);
        if (!into || !target || !window.confirm(`Move ${row.name}'s credits to ${target.name} and delete ${row.name}?`)) return;
        start(async () => { const r = await mergePartnerAction(row.id, into); if (r.ok) onDone(); });
      }}>
      <option value="">Merge into…</option>
      {all.filter((a) => a.id !== row.id && a.kind === row.kind).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  );
}
