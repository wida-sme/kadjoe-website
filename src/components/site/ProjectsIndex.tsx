'use client';
import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ease, prefersReducedMotion } from '@/engine';
import type { Category } from '@/server/db/schema';
import type { Photo } from '@/server/site/queries';
import { Pic, PreviewBox, photoAlt } from './Pic';

type Item = { no: number; slug: string; name: string; category: Category; typeLabel: string | null; location: string | null; year: string | null; design: string | null; cover: Photo | null };
const LABEL: Record<Category, string> = { residential: 'Residential', fnb: 'F&B', commercial: 'Commercial' };
const FILTERS: (Category | null)[] = [null, 'residential', 'fnb', 'commercial'];
const PAGE = 24; // photographs shown per step: the grid stays light on a phone

export function ProjectsIndex({ projects, counts, initialCategory, initialView }: {
  projects: Item[]; counts: Record<Category, number>; initialCategory: Category | null; initialView: 'photographs' | 'register';
}) {
  const [category, setCategory] = useState<Category | null>(initialCategory);
  const [view, setView] = useState(initialView);
  const [limit, setLimit] = useState(PAGE);
  const list = useRef<HTMLDivElement>(null);
  const changed = useRef(false);

  // Filters and views live in the URL without a page load, so links and the back button keep them.
  const update = (c: Category | null, v: typeof view) => {
    changed.current = true;
    setCategory(c);
    setView(v);
    setLimit(PAGE);
    const url = new URL(location.href);
    if (c) url.searchParams.set('category', c); else url.searchParams.delete('category');
    if (v === 'register') url.searchParams.set('view', v); else url.searchParams.delete('view');
    history.replaceState(history.state, '', url);
  };

  // What appears after a filter change slides up a little and locks.
  const shown = useRef(PAGE);
  useLayoutEffect(() => {
    const from = limit > shown.current ? shown.current : 0; // "More" animates only what it added
    shown.current = limit;
    if (!changed.current || !list.current || prefersReducedMotion()) return;
    const items = [...list.current.querySelectorAll(':scope > ul > li:not([hidden]), :scope > div > a:not([hidden])')].slice(from);
    const t = gsap.fromTo(items, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: ease.out, stagger: { each: 0.025, from: 'start' }, clearProps: 'transform,opacity,visibility' });
    return () => { t.kill(); };
  }, [category, view, limit]);

  const shows = (p: Item) => !category || p.category === category;
  const matching = projects.filter(shows);
  const total = counts.residential + counts.fnb + counts.commercial;

  return (
    <div className="wrap">
      <div className="toolbar">
        <div className="filters" role="group" aria-label="Category">
          {FILTERS.map((c) => (
            <button key={c ?? 'all'} className="chip" aria-pressed={category === c} onClick={() => update(c, view)}>
              {c ? LABEL[c] : 'All'} <span className="num">{c ? counts[c] : total}</span>
            </button>
          ))}
        </div>
        <div className="views" role="group" aria-label="View">
          <button className="chip" aria-pressed={view === 'photographs'} onClick={() => update(category, 'photographs')}>Photographs</button>
          <button className="chip" aria-pressed={view === 'register'} onClick={() => update(category, 'register')}>Register</button>
        </div>
      </div>

      <div ref={list}>
        {view === 'photographs' ? (
          <>
          <ul className="pgrid">
            {matching.slice(0, limit).map((p, i) => (
              <li key={p.slug}>
                <Link href={`/projects/${p.slug}`} className="card-link" data-label={p.name} data-sheet={String(p.no).padStart(3, '0')} prefetch={false}>
                  {p.cover ? <Pic photo={p.cover} alt={photoAlt(p.name, p.location)} className="photo--zoom" sizes="(max-width: 1023px) 50vw, 33vw" priority={i < 3} /> : <div className="photo" />}
                  <div className="cap">
                    <span className="cap__name">{p.name}</span>
                    <span className="cap__meta">{LABEL[p.category]}</span>
                    {p.year ? <span className="cap__meta">{p.year}</span> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {matching.length > limit ? (
            <div className="more">
              <button type="button" className="fill-btn" onClick={() => { changed.current = true; setLimit(limit + PAGE); }}>
                More projects <span className="num">{matching.length - limit}</span>
              </button>
            </div>
          ) : null}
          </>
        ) : (
          <div className="register" data-preview-list>
            <div className="reg-head label" aria-hidden="true">
              <span>No.</span><span>Project</span><span>Type</span><span>Location</span><span>Year</span><span>Design</span>
            </div>
            {projects.map((p) => {
              const visible = shows(p);
              return (
                <Link key={p.slug} href={`/projects/${p.slug}`} prefetch={false} className="reg-row" hidden={!visible} data-label={p.name} data-sheet={String(p.no).padStart(3, '0')} data-preview={p.cover ? `/media/${p.cover.id}/640.webp` : undefined}>
                  <span className="num">{String(p.no).padStart(3, '0')}</span>
                  {p.cover ? <Pic photo={p.cover} alt="" className="reg-thumb" sizes="64px" /> : <span className="reg-thumb photo" />}
                  <span className="reg-row__name">{p.name}</span>
                  <span className="reg-row__cat muted">{p.typeLabel ?? LABEL[p.category]}</span>
                  <span className="reg-row__loc muted">{p.location ?? ''}</span>
                  <span className="reg-row__year num">{p.year ?? ''}</span>
                  <span className="reg-row__design muted">{p.design ?? ''}</span>
                </Link>
              );
            })}
            <PreviewBox />
          </div>
        )}
      </div>
    </div>
  );
}
