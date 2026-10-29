'use client';
// Builds the company profile: choose categories (or hand-pick projects), order them, preview, download.
import { useId, useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Category = 'residential' | 'fnb' | 'commercial';
type Candidate = { id: string; name: string; location: string | null; year: string | null; coverId: string | null; featured: boolean };
type Config = {
  title: string;
  groups: { category: Category; projectIds: string[] }[];
  sections: { about: boolean; services: boolean; clients: boolean; contact: boolean };
  coverMediaId: string | null;
};
const LABEL: Record<Category, string> = { residential: 'Residential', fnb: 'F&B', commercial: 'Commercial' };
const ORDER: Category[] = ['residential', 'fnb', 'commercial'];

const encode = (c: Config) => {
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export function ProfileBuilder({ candidates, initial }: { candidates: Record<Category, Candidate[]>; initial: Config }) {
  const [title, setTitle] = useState(initial.title);
  const [sections, setSections] = useState(initial.sections);
  // Per category: whether it is in the profile, and its projects in order.
  const [on, setOn] = useState<Record<Category, boolean>>({ residential: true, fnb: true, commercial: true });
  const [picked, setPicked] = useState<Record<Category, string[]>>(() => Object.fromEntries(ORDER.map((c) => [c, initial.groups.find((g) => g.category === c)?.projectIds ?? []])) as Record<Category, string[]>);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const config: Config = useMemo(() => ({
    title: title.trim() || 'Portfolio',
    groups: ORDER.filter((c) => on[c] && picked[c].length).map((c) => ({ category: c, projectIds: picked[c] })),
    sections,
    coverMediaId: null,
  }), [title, on, picked, sections]);
  const projects = config.groups.reduce((n, g) => n + g.projectIds.length, 0);
  const pages = 2 + (sections.about ? 1 : 0) + (sections.services ? 1 : 0) + config.groups.length + projects + (sections.clients ? 1 : 0) + (sections.contact ? 1 : 0);
  const url = config.groups.length ? `/api/admin/profile?c=${encode(config)}` : null;

  return (
    <div className="a-profile">
      <div style={{ display: 'grid', gap: 20 }}>
        <section className="a-panel" style={{ margin: 0 }}>
          <h2>Profile</h2>
          <div className="a-form">
            <label className="a-field"><span>Title on the cover</span><input className="a-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} /></label>
            <fieldset className="a-fieldset">
              <legend>Categories</legend>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {ORDER.map((c) => (
                  <label key={c} className="a-check"><input type="checkbox" checked={on[c]} onChange={(e) => setOn({ ...on, [c]: e.target.checked })} /> {LABEL[c]}</label>
                ))}
              </div>
            </fieldset>
            <fieldset className="a-fieldset">
              <legend>Pages</legend>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {(['about', 'services', 'clients', 'contact'] as const).map((k) => (
                  <label key={k} className="a-check"><input type="checkbox" checked={sections[k]} onChange={(e) => setSections({ ...sections, [k]: e.target.checked })} /> {k === 'about' ? 'About Us' : k[0].toUpperCase() + k.slice(1)}</label>
                ))}
              </div>
            </fieldset>
            <p className="a-muted a-num" style={{ fontSize: 13 }}>{projects} project{projects === 1 ? '' : 's'}, {pages} pages, A4 landscape</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="a-btn" disabled={!url || loading} onClick={() => { setLoading(true); setPreview(url); }}>Preview</button>
              {url ? <a className="a-btn a-btn--primary" href={`${url}&download=1`}>Download PDF</a> : <button className="a-btn a-btn--primary" disabled>Download PDF</button>}
            </div>
          </div>
        </section>

        {ORDER.filter((c) => on[c]).map((c) => (
          <CategoryPicker key={c} label={LABEL[c]} all={candidates[c]} value={picked[c]} onChange={(ids) => setPicked({ ...picked, [c]: ids })} />
        ))}
      </div>

      <section className="a-panel" style={{ margin: 0, position: 'sticky', top: 80 }}>
        <h2>Preview</h2>
        {preview ? (
          <iframe key={preview} title="Company profile preview" src={preview} className="a-preview-frame" onLoad={() => setLoading(false)} />
        ) : (
          <div className="a-preview-frame" style={{ display: 'grid', placeItems: 'center', color: 'var(--c-muted)', fontSize: 14 }}>Press Preview</div>
        )}
        {loading ? <p className="a-muted" style={{ marginTop: 8, fontSize: 13 }}>Building the PDF. The first time can take half a minute.</p> : null}
      </section>
    </div>
  );
}

function CategoryPicker({ label, all, value, onChange }: { label: string; all: Candidate[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const dndId1 = useId(); // stable id: the same on the server and in the browser
  const byId = new Map(all.map((p) => [p.id, p]));
  const chosen = value.map((id) => byId.get(id)).filter((p): p is Candidate => !!p);
  const rest = all.filter((p) => !value.includes(p.id) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onChange(arrayMove(value, value.indexOf(String(e.active.id)), value.indexOf(String(e.over.id))));
  };
  return (
    <section className="a-panel" style={{ margin: 0 }} aria-label={label}>
      <h2>{label} <span className="a-muted a-num" style={{ fontWeight: 400 }}>{chosen.length} of {all.length}</span></h2>
      <DndContext id={dndId1} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={value} strategy={verticalListSortingStrategy}>
          <ol className="a-plist" style={{ maxHeight: 'none', marginBottom: 12 }}>
            {chosen.map((p, i) => <ChosenRow key={p.id} p={p} first={i === 0} last={i === chosen.length - 1}
              onMove={(d) => onChange(arrayMove(value, value.indexOf(p.id), value.indexOf(p.id) + d))}
              onRemove={() => onChange(value.filter((x) => x !== p.id))} />)}
          </ol>
        </SortableContext>
      </DndContext>
      {!chosen.length ? <p className="a-muted" style={{ marginBottom: 12, fontSize: 13 }}>No projects: this category is left out.</p> : null}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 14 }}>Add projects</summary>
        <input className="a-input" type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: '10px 0' }} aria-label={`Search ${label} projects`} />
        <ul className="a-plist">
          {rest.map((p) => (
            <li key={p.id} className="a-pitem" style={{ gridTemplateColumns: '64px minmax(0,1fr) auto' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.coverId ? <img src={`/media/${p.coverId}/160.webp`} alt="" loading="lazy" /> : <span />}
              <span>{p.name}<span className="a-muted" style={{ fontSize: 12, display: 'block' }}>{[p.location, p.year].filter(Boolean).join(', ')}</span></span>
              <button type="button" className="a-btn a-btn--sm" onClick={() => onChange([...value, p.id])}>Add</button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function ChosenRow({ p, first, last, onMove, onRemove }: { p: Candidate; first: boolean; last: boolean; onMove: (d: number) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: p.id });
  return (
    <li ref={setNodeRef} className="a-pitem" style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button type="button" className="a-grip" {...attributes} {...listeners} aria-label={`Move ${p.name}`}>⋮⋮</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p.coverId ? <img src={`/media/${p.coverId}/160.webp`} alt="" /> : <span />}
      <span>{p.name}<span className="a-muted" style={{ fontSize: 12, display: 'block' }}>{[p.location, p.year].filter(Boolean).join(', ')}</span></span>
      <span style={{ display: 'inline-flex', gap: 4 }}>
        <button type="button" className="a-btn a-btn--sm" disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${p.name} earlier`}>↑</button>
        <button type="button" className="a-btn a-btn--sm" disabled={last} onClick={() => onMove(1)} aria-label={`Move ${p.name} later`}>↓</button>
        <button type="button" className="a-btn a-btn--sm a-btn--ghost" onClick={onRemove}>Remove</button>
      </span>
    </li>
  );
}
