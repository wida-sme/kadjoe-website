'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteProjectAction, mergeProjectAction } from '@/app/admin/actions';

export function MergeProject({ id, projects }: { id: string; projects: { id: string; name: string; location: string | null }[] }) {
  const router = useRouter();
  const [target, setTarget] = useState('');
  const [pending, start] = useTransition();
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select className="a-select" style={{ width: 'auto', maxWidth: 360 }} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Merge into project">
        <option value="">Merge all photographs into…</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.location ? `, ${p.location}` : ''}</option>)}
      </select>
      <button className="a-btn" disabled={!target || pending} onClick={() => {
        if (!window.confirm('Move every photograph and credit into that project and delete this one?')) return;
        start(async () => { const r = await mergeProjectAction(id, target); if (r.ok) router.push(`/admin/projects/${target}`); });
      }}>Merge</button>
    </div>
  );
}

export function DeleteProject({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div>
      <button className="a-btn a-btn--danger" disabled={pending} onClick={() => {
        if (!window.confirm(`Delete ${name} and all its photographs? This cannot be undone.`)) return;
        start(async () => { const r = await deleteProjectAction(id); if (r.ok) router.push('/admin/projects'); });
      }}>Delete project</button>
    </div>
  );
}
