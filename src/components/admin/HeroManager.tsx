'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { featuredOrderAction, heroAction } from '@/app/admin/actions';
import { Toast, useToast } from './Toast';

type Slide = { id: string; mediaId: string; projectId: string | null; projectName: string | null; projectStatus: string | null };
type Candidate = { mediaId: string; projectId: string; projectName: string; location: string | null };
type Featured = { id: string; name: string; coverId: string | null; status: string };

export function HeroManager({ slides: initial, candidates, q, featured: initialFeatured }: { slides: Slide[]; candidates: Candidate[]; q: string; featured: Featured[] }) {
  const router = useRouter();
  const [slides, setSlides] = useState(initial);
  const [featured, setFeatured] = useState(initialFeatured);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const toast = useToast();
  // New data from the server (after an action) replaces the local order.
  const [seen, setSeen] = useState({ initial, initialFeatured });
  if (seen.initial !== initial || seen.initialFeatured !== initialFeatured) {
    setSeen({ initial, initialFeatured });
    setSlides(initial);
    setFeatured(initialFeatured);
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const dndId1 = useId(), dndId2 = useId(); // stable ids: the same on the server and in the browser
  const inHero = new Set(slides.map((s) => s.mediaId));

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) => start(async () => {
    const r = await fn();
    if (!r.ok) return toast.show(r.error ?? 'Failed', true);
    if (done) toast.show(done);
    router.refresh();
  });

  const onSlides = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(slides, slides.findIndex((s) => s.id === e.active.id), slides.findIndex((s) => s.id === e.over!.id));
    setSlides(next);
    act(() => heroAction('order', next.map((s) => s.id)));
  };
  // Buttons do what dragging does, for anyone who cannot drag (WCAG 2.5.7).
  const moveSlide = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= slides.length) return;
    const next = arrayMove(slides, i, j);
    setSlides(next);
    act(() => heroAction('order', next.map((s) => s.id)));
  };
  const moveFeatured = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= featured.length) return;
    const next = arrayMove(featured, i, j);
    setFeatured(next);
    act(() => featuredOrderAction(next.map((s) => s.id)));
  };
  const onFeatured = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(featured, featured.findIndex((s) => s.id === e.active.id), featured.findIndex((s) => s.id === e.over!.id));
    setFeatured(next);
    act(() => featuredOrderAction(next.map((s) => s.id)));
  };

  return (
    <>
      <section className="a-panel" aria-labelledby="hero-title">
        <h2 id="hero-title">Hero photographs <span className="a-muted a-num" style={{ fontWeight: 400 }}>{slides.length}</span></h2>
        <p className="a-help" style={{ marginBottom: 12 }}>The first photograph loads first. Drag to change the order. Landscape photographs work best; set each one&apos;s focal point in its project.</p>
        <DndContext id={dndId1} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSlides}>
          <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="a-hero-list">
              {slides.map((s, i) => <SlideRow key={s.id} slide={s} index={i} count={slides.length} onMove={(d) => moveSlide(i, d)} onRemove={() => act(() => heroAction('remove', [s.id]), 'Removed')} />)}
            </ol>
          </SortableContext>
        </DndContext>
        {!slides.length ? <p className="a-muted">No hero photographs. The home page shows the selected projects instead.</p> : null}
      </section>

      <section className="a-panel" aria-labelledby="pick-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 id="pick-title" style={{ margin: 0 }}>Add photographs</h2>
          <form style={{ display: 'flex', gap: 8 }}>
            <input className="a-input" type="search" name="q" defaultValue={q} placeholder="Project name" aria-label="Search projects" style={{ width: 220 }} />
            <button className="a-btn">Search</button>
          </form>
        </div>
        <div className="a-pick">
          {candidates.map((c) => {
            const on = picked.has(c.mediaId);
            const already = inHero.has(c.mediaId);
            return (
              <button key={c.mediaId} type="button" aria-pressed={on} disabled={already} onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(c.mediaId)) n.delete(c.mediaId); else n.add(c.mediaId); return n; })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/media/${c.mediaId}/480.webp`} alt="" loading="lazy" />
                <span>{c.projectName}{already ? ' · in hero' : ''}</span>
              </button>
            );
          })}
        </div>
        {picked.size ? (
          <div className="a-selbar" style={{ position: 'sticky', bottom: 12, top: 'auto', marginTop: 12 }}>
            <strong style={{ fontWeight: 500 }}>{picked.size} selected</strong>
            <button className="a-btn a-btn--sm" disabled={pending} onClick={() => act(async () => { const r = await heroAction('add', [...picked]); setPicked(new Set()); return r; }, 'Added to the hero')}>Add to hero</button>
            <button className="a-btn a-btn--sm a-btn--ghost" onClick={() => setPicked(new Set())}>Clear</button>
          </div>
        ) : null}
      </section>

      <section className="a-panel" aria-labelledby="featured-title">
        <h2 id="featured-title">Selected projects <span className="a-muted a-num" style={{ fontWeight: 400 }}>{featured.length}</span></h2>
        <p className="a-help" style={{ marginBottom: 12 }}>The home page shows the first six published ones, in this order. Choose them with the Home switch in <Link href="/admin/projects">Projects</Link>.</p>
        <DndContext id={dndId2} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onFeatured}>
          <SortableContext items={featured.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="a-hero-list">
              {featured.map((f, i) => <FeaturedRow key={f.id} item={f} index={i} count={featured.length} onMove={(d) => moveFeatured(i, d)} />)}
            </ol>
          </SortableContext>
        </DndContext>
      </section>
      <Toast {...toast} />
    </>
  );
}

function MoveButtons({ index, count, onMove, name }: { index: number; count: number; onMove: (d: number) => void; name: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <button type="button" className="a-btn a-btn--sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move ${name} earlier`}>↑</button>
      <button type="button" className="a-btn a-btn--sm" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move ${name} later`}>↓</button>
    </span>
  );
}

function SlideRow({ slide, index, count, onMove, onRemove }: { slide: Slide; index: number; count: number; onMove: (d: number) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: slide.id });
  return (
    <li ref={setNodeRef} className="a-hero-item" style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button type="button" className="a-grip" {...attributes} {...listeners} aria-label={`Move photograph ${index + 1}`}>⋮⋮</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/media/${slide.mediaId}/480.webp`} alt="" />
      <div>
        <div className="a-num a-muted" style={{ fontSize: 12 }}>{String(index + 1).padStart(2, '0')}</div>
        {slide.projectId ? <Link href={`/admin/projects/${slide.projectId}`}>{slide.projectName}</Link> : <span className="a-muted">No project</span>}
        {slide.projectStatus && slide.projectStatus !== 'published' ? <span className="a-badge a-badge--warn" style={{ marginLeft: 8 }}>project not published</span> : null}
      </div>
      <span style={{ display: 'inline-flex', gap: 8 }}>
        <MoveButtons index={index} count={count} onMove={onMove} name={`photograph ${index + 1}`} />
        <button type="button" className="a-btn a-btn--sm" onClick={onRemove}>Remove</button>
      </span>
    </li>
  );
}

function FeaturedRow({ item, index, count, onMove }: { item: Featured; index: number; count: number; onMove: (d: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  return (
    <li ref={setNodeRef} className="a-hero-item" style={{ transform: CSS.Transform.toString(transform), transition, gridTemplateColumns: '28px 96px minmax(0,1fr) auto' }}>
      <button type="button" className="a-grip" {...attributes} {...listeners} aria-label={`Move ${item.name}`}>⋮⋮</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item.coverId ? <img src={`/media/${item.coverId}/320.webp`} alt="" style={{ width: 96 }} /> : <span />}
      <div>
        <div className="a-num a-muted" style={{ fontSize: 12 }}>{String(index + 1).padStart(2, '0')}{index >= 6 ? ' · not shown' : ''}</div>
        <Link href={`/admin/projects/${item.id}`}>{item.name}</Link>
      </div>
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <span className={`a-badge a-badge--${item.status}`}>{item.status}</span>
        <MoveButtons index={index} count={count} onMove={onMove} name={item.name} />
      </span>
    </li>
  );
}
