'use client';
// Photographs of one project: drag to reorder, select to hide, delete, move, split into a new project
// or add to the home page; one photograph opens for its focal point and description.
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { movePhotosAction, photosAction, splitProjectAction, updatePhotoAction, uploadPhotosAction } from '@/app/admin/actions';
import { Toast, useToast } from './Toast';

export type AdminPhoto = {
  id: string; width: number; height: number; hidden: boolean; inHero: boolean; alt: string | null;
  focalX: number; focalY: number; source: string; igShortcode: string | null;
};

export function PhotoManager({ projectId, projectName, coverId, photos: initial, projects }: {
  projectId: string; projectName: string; coverId: string | null; photos: AdminPhoto[]; projects: { id: string; name: string; location: string | null }[];
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<AdminPhoto | null>(null);
  const [target, setTarget] = useState('');
  const [splitName, setSplitName] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  // New data from the server (after an action) replaces the local order.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) { setSeen(initial); setPhotos(initial); }

  const dndId1 = useId(); // stable id: the same on the server and in the browser
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string; id?: string }>, after?: (r: { id?: string }) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast.show(r.error ?? 'Failed', true);
      if (r.message) toast.show(r.message);
      setSelected(new Set());
      after?.(r);
      router.refresh();
    });

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = photos.findIndex((p) => p.id === e.active.id);
    const to = photos.findIndex((p) => p.id === e.over!.id);
    const next = arrayMove(photos, from, to);
    setPhotos(next);
    run(() => photosAction(projectId, 'order', next.map((p) => p.id)));
  };

  // Buttons do what dragging does, for anyone who cannot drag (WCAG 2.5.7).
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= photos.length) return;
    const next = arrayMove(photos, i, j);
    setPhotos(next);
    run(() => photosAction(projectId, 'order', next.map((p) => p.id)));
  };
  const sel = [...selected];
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // One photograph per request: a batch of camera files would pass the request size limit.
  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files];
    if (fileRef.current) fileRef.current.value = '';
    start(async () => {
      let added = 0, skipped = 0;
      for (const [i, f] of list.entries()) {
        toast.show(`Uploading ${i + 1} of ${list.length}`);
        const form = new FormData();
        form.append('files', f);
        const r = await uploadPhotosAction(projectId, form);
        if (r.ok && r.message?.startsWith('1 added')) added++; else skipped++;
      }
      toast.show(skipped ? `${added} added, ${skipped} skipped (not an image, too large or a duplicate)` : `${added} added`, !added);
      router.refresh();
    });
  };

  return (
    <section className="a-panel" aria-labelledby="photos-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 id="photos-title" style={{ margin: 0 }}>Photographs <span className="a-muted a-num" style={{ fontWeight: 400 }}>{photos.length}</span></h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="a-btn" onClick={() => setSelected(selected.size === photos.length ? new Set() : new Set(photos.map((p) => p.id)))}>
            {selected.size === photos.length && photos.length ? 'Select none' : 'Select all'}
          </button>
          <button type="button" className="a-btn a-btn--primary" onClick={() => fileRef.current?.click()} disabled={pending}>Upload</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
      </div>

      {sel.length ? (
        <div className="a-selbar" role="toolbar" aria-label="Selected photographs">
          <strong style={{ fontWeight: 500 }}>{sel.length} selected</strong>
          {sel.length === 1 ? <button className="a-btn a-btn--sm" onClick={() => run(() => photosAction(projectId, 'cover', sel))}>Set as cover</button> : null}
          <button className="a-btn a-btn--sm" onClick={() => run(() => photosAction(projectId, 'hide', sel))}>Hide</button>
          <button className="a-btn a-btn--sm" onClick={() => run(() => photosAction(projectId, 'show', sel))}>Show</button>
          <button className="a-btn a-btn--sm" onClick={() => run(() => photosAction(projectId, 'hero', sel))}>Add to home hero</button>
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <select className="a-select" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Move to project">
              <option value="">Move to…</option>
              {projects.filter((p) => p.id !== projectId).map((p) => <option key={p.id} value={p.id}>{p.name}{p.location ? `, ${p.location}` : ''}</option>)}
            </select>
            <button className="a-btn a-btn--sm" disabled={!target} onClick={() => run(() => movePhotosAction(projectId, sel, target))}>Move</button>
          </span>
          {splitName === null ? (
            <button className="a-btn a-btn--sm" onClick={() => setSplitName(projectName)}>Split into new project</button>
          ) : (
            <form style={{ display: 'inline-flex', gap: 6 }} onSubmit={(e) => {
              e.preventDefault();
              if (!splitName.trim()) return;
              run(() => splitProjectAction(projectId, sel, splitName.trim()), (r) => { setSplitName(null); if (r.id) router.push(`/admin/projects/${r.id}`); });
            }}>
              <label className="a-sr" htmlFor="split-name">Name of the new project</label>
              <input id="split-name" className="a-input" value={splitName} onChange={(e) => setSplitName(e.target.value)} autoFocus />
              <button className="a-btn a-btn--sm" type="submit">Create</button>
              <button className="a-btn a-btn--sm a-btn--ghost" type="button" onClick={() => setSplitName(null)}>Cancel</button>
            </form>
          )}
          <button className="a-btn a-btn--sm" onClick={() => {
            if (window.confirm(`Delete ${sel.length} photograph${sel.length === 1 ? '' : 's'}? This cannot be undone.`)) run(() => photosAction(projectId, 'delete', sel));
          }}>Delete</button>
          <button className="a-btn a-btn--sm a-btn--ghost" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      ) : null}

      <DndContext id={dndId1} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
          <ul className="a-photos">
            {photos.map((p, i) => (
              <Tile key={p.id} photo={p} index={i} count={photos.length} cover={p.id === coverId} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} onOpen={() => setEditing(p)} onMove={(d) => move(i, d)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="a-help" style={{ marginTop: 10 }}>Drag to reorder. The cover opens the project page and the gallery starts with it.</p>

      {editing ? <PhotoDialog photo={editing} onClose={() => setEditing(null)} onSaved={(m) => { toast.show(m); router.refresh(); }} /> : null}
      <Toast {...toast} />
    </section>
  );
}

function Tile({ photo, index, count, cover, selected, onToggle, onOpen, onMove }: {
  photo: AdminPhoto; index: number; count: number; cover: boolean; selected: boolean; onToggle: () => void; onOpen: () => void; onMove: (d: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  return (
    <li
      ref={setNodeRef}
      className="a-photo"
      data-selected={selected ? '' : undefined}
      data-hidden={photo.hidden ? '' : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : undefined, opacity: isDragging ? 0.85 : 1 }}
    >
      <div className="a-photo__img" {...attributes} {...listeners} aria-label={`Photograph ${index + 1}, drag to reorder`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/media/${photo.id}/320.webp`} alt="" loading="lazy" draggable={false} />
      </div>
      <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select photograph ${index + 1}`} />
      <div className="a-photo__bar">
        <span className="a-photo__flags">
          <span className="a-num a-muted">{String(index + 1).padStart(2, '0')}</span>
          {cover ? <span className="a-badge a-badge--solid">Cover</span> : null}
          {photo.hidden ? <span className="a-badge">Hidden</span> : null}
          {photo.inHero ? <span className="a-badge">Hero</span> : null}
        </span>
        <span style={{ display: 'inline-flex' }}>
          <button type="button" className="a-photo__open" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move photograph ${index + 1} earlier`}>←</button>
          <button type="button" className="a-photo__open" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move photograph ${index + 1} later`}>→</button>
          <button type="button" className="a-photo__open" onClick={onOpen}>Edit</button>
        </span>
      </div>
    </li>
  );
}

function PhotoDialog({ photo, onClose, onSaved }: { photo: AdminPhoto; onClose: () => void; onSaved: (m: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [focal, setFocal] = useState({ x: photo.focalX, y: photo.focalY });
  const [alt, setAlt] = useState(photo.alt ?? '');
  const [pending, start] = useTransition();
  useEffect(() => { ref.current?.showModal(); }, []);
  const pick = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setFocal({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
  };
  const pos = `${Math.round(focal.x * 100)}% ${Math.round(focal.y * 100)}%`;
  return (
    <dialog ref={ref} className="a-dialog" onClose={onClose} aria-labelledby="photo-dialog-title">
      <div className="a-dialog__head">
        <h2 id="photo-dialog-title">Photograph</h2>
        <button className="a-btn a-btn--ghost a-btn--sm" onClick={() => ref.current?.close()}>Close</button>
      </div>
      <div className="a-dialog__body">
        <p className="a-help" style={{ marginBottom: 8 }}>Click the part of the photograph that must stay in view when it is cropped.</p>
        <div className="a-focal" onClick={pick}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/media/${photo.id}/960.webp`} alt="" />
          <span className="a-focal__dot" style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }} />
        </div>
        <div className="a-crops" aria-label="Crop previews">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div style={{ aspectRatio: '21 / 9' }}><img src={`/media/${photo.id}/640.webp`} alt="" style={{ objectPosition: pos }} /></div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div style={{ aspectRatio: '4 / 5' }}><img src={`/media/${photo.id}/480.webp`} alt="" style={{ objectPosition: pos }} /></div>
        </div>
        <label className="a-field" style={{ marginTop: 16 }}>
          <span>Description for screen readers (optional)</span>
          <input className="a-input" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} placeholder="e.g. Bar counter in travertine with brass shelving" />
        </label>
        <p className="a-help" style={{ marginTop: 10 }}>{photo.width} × {photo.height} px{photo.igShortcode ? <> · from <a href={`https://www.instagram.com/p/${photo.igShortcode}/`} target="_blank" rel="noopener">Instagram</a></> : null}</p>
      </div>
      <div className="a-dialog__foot">
        <button className="a-btn" onClick={() => ref.current?.close()}>Cancel</button>
        <button className="a-btn a-btn--primary" disabled={pending} onClick={() => start(async () => {
          const r = await updatePhotoAction(photo.id, { alt, focalX: focal.x, focalY: focal.y });
          if (r.ok) { onSaved('Photograph saved'); ref.current?.close(); }
        })}>Save</button>
      </div>
    </dialog>
  );
}
