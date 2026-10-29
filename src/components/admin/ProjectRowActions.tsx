'use client';
import { useTransition } from 'react';
import { projectFlagsAction } from '@/app/admin/actions';

/** The "selected on the home page" switch in the project list. */
export function ProjectRowActions({ id, featured }: { id: string; featured: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className="a-check" title="Show in Selected projects on the home page">
      <input type="checkbox" defaultChecked={featured} disabled={pending} onChange={(e) => {
        const value = e.currentTarget.checked;
        start(async () => { await projectFlagsAction(id, { featured: value }); });
      }} />
      <span className="a-sr">Selected on the home page</span>
    </label>
  );
}
