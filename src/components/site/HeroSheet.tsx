'use client';
// The hero sheet: dashboard-chosen photographs in a drawing area, a title block underneath. A
// change slides a hairline rule down the photograph like a parallel rule on a drafting table; the
// next photograph appears in its wake and every title-block cell rolls to the next project.
// React owns every node and every text; GSAP only moves them.
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ease, prefersReducedMotion } from '@/engine';
import { usePage } from '@/engine/next';

export type HeroItem = {
  photo: { id: string; blur: string; focalX: number; focalY: number };
  alt: string;
  project: { slug: string; no: number; name: string; location: string | null; year: string | null; design: string | null } | null;
};

const HOLD = 6.5; // seconds a photograph stays
const pad = (n: number) => String(n).padStart(2, '0');

function fields(item: HeroItem) {
  const p = item.project;
  return { sheet: p ? String(p.no).padStart(3, '0') : '', project: p?.name ?? 'Kadjoe', location: p?.location ?? '', design: p?.design ?? '', year: p?.year ?? '' };
}
type Field = keyof ReturnType<typeof fields>;
const CELLS: { key: Field; label: string; className: string }[] = [
  { key: 'sheet', label: 'Sheet', className: 'hero__cell--sheet' },
  { key: 'project', label: 'Project', className: 'hero__cell--project' },
  { key: 'location', label: 'Location', className: 'hero__cell--location' },
  { key: 'design', label: 'Design', className: 'hero__cell--design' },
  { key: 'year', label: 'Year', className: 'hero__cell--year' },
];

export function HeroSheet({ items, title }: { items: HeroItem[]; title: string }) {
  const count = items.length;
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const [mounted, setMounted] = useState<number[]>([0]);
  const [playing, setPlaying] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const indexRef = useRef(0);
  const busy = useRef(false);
  const hold = useRef<gsap.core.Tween | null>(null);
  const paused = useRef({ user: false, hover: false, hidden: false, offscreen: false });
  const goRef = useRef<(to: number) => void>(() => {});

  const mount = useCallback((...ids: number[]) => setMounted((m) => {
    const add = ids.filter((i) => !m.includes(i));
    return add.length ? [...m, ...add] : m;
  }), []);

  const isPaused = () => Object.values(paused.current).some(Boolean);
  const sync = () => { if (isPaused()) hold.current?.pause(); else hold.current?.resume(); };

  // One clock: the hold between changes is a GSAP tween that also draws the progress hairline.
  const restartHold = useCallback(() => {
    hold.current?.kill();
    if (count < 2 || !progress.current) return;
    hold.current = gsap.fromTo(progress.current, { scaleX: 0 }, {
      scaleX: 1, duration: HOLD, ease: 'none', paused: isPaused(),
      onComplete: () => goRef.current(indexRef.current + 1),
    });
  }, [count]);

  const go = useCallback((to: number) => {
    if (busy.current || count < 2) return;
    const next = ((to % count) + count) % count;
    if (next === indexRef.current) return;
    busy.current = true;
    hold.current?.kill();
    mount(next, (next + 1) % count);
    setPending(next);
  }, [count, mount]);
  useEffect(() => { goRef.current = go; }, [go]);

  // The change itself runs once React has rendered the incoming slide and the incoming texts.
  useLayoutEffect(() => {
    if (pending === null) return;
    const root = stage.current!;
    const slides = root.querySelectorAll<HTMLElement>('.hero__slide');
    const incoming = slides[pending];
    const rule = root.querySelector<HTMLElement>('.hero__rule')!;
    const reduced = prefersReducedMotion();
    gsap.set(incoming, { zIndex: 2 });
    const tl = gsap.timeline({
      onComplete: () => {
        indexRef.current = pending;
        setIndex(pending);
        setPending(null);
      },
    });
    if (reduced) {
      tl.fromTo(incoming, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 });
    } else {
      tl.set(rule, { opacity: 1, y: 0 })
        .fromTo(incoming, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.15, ease: ease.inOut }, 0)
        .fromTo(incoming.querySelector('img'), { scale: 1.06 }, { scale: 1, duration: 1.6, ease: ease.out }, 0)
        .to(rule, { y: root.clientHeight, duration: 1.15, ease: ease.inOut }, 0)
        .to(rule, { opacity: 0, duration: 0.2 }, 1.0);
    }
    strip.current!.querySelectorAll<HTMLElement>('[data-roll]').forEach((cell, i) => {
      const out = cell.querySelector('[data-now]'), into = cell.querySelector('[data-next]');
      if (reduced) return;
      tl.fromTo(out, { yPercent: 0 }, { yPercent: -105, duration: 0.7, ease: ease.out }, 0.3 + i * 0.05)
        .fromTo(into, { yPercent: 105 }, { yPercent: 0, duration: 0.7, ease: ease.out }, 0.3 + i * 0.05);
    });
    return () => { tl.kill(); };
  }, [pending]);

  // After the swap is committed: reset what GSAP moved, then start the next hold.
  useLayoutEffect(() => {
    const root = stage.current;
    if (!root) return;
    gsap.set(root.querySelectorAll('.hero__slide, .hero__slide img'), { clearProps: 'zIndex,clipPath,opacity,visibility,scale' });
    gsap.set(strip.current!.querySelectorAll('[data-now], [data-next]'), { clearProps: 'transform' });
    busy.current = false;
    restartHold();
  }, [index, restartHold]);

  usePage(({ intro, restored }) => {
    // First sight of the sheet: the title-block values rise into their cells while the rule passes
    // once over the photograph. The photograph itself is there from the first paint.
    if (!prefersReducedMotion() && !restored) {
      const rule = stage.current!.querySelector<HTMLElement>('.hero__rule')!;
      intro.add(gsap.timeline()
        .fromTo(rule, { opacity: 1, y: 0 }, { y: stage.current!.clientHeight, duration: 1.3, ease: ease.inOut })
        .to(rule, { opacity: 0, duration: 0.25 }, 1.1), 0);
      intro.add(gsap.from(strip.current!.querySelectorAll('[data-now], .hero__cell .label, .hero__controls, .hero__progress'), {
        yPercent: 105, autoAlpha: 0, duration: 0.9, ease: ease.out, stagger: 0.04, clearProps: 'transform,opacity,visibility',
      }), 0.2);
    }
    // Under reduced motion nothing advances by itself; Play still works if the visitor asks for it.
    if (prefersReducedMotion()) { paused.current.user = true; setPlaying(false); }
    restartHold();
    const io = new IntersectionObserver(([e]) => { paused.current.offscreen = !e.isIntersecting; sync(); });
    io.observe(stage.current!);
    const vis = () => { paused.current.hidden = document.hidden; sync(); };
    document.addEventListener('visibilitychange', vis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); hold.current?.kill(); };
  });

  const toggle = () => {
    paused.current.user = playing;
    setPlaying(!playing);
    sync();
  };

  const touch = useRef<{ x: number; y: number } | null>(null);
  const now = fields(items[index]);
  const incoming = pending === null ? null : fields(items[pending]);
  const project = items[index].project;

  return (
    <section className="hero" aria-label="Selected projects">
      <div
        ref={stage}
        className="hero__stage"
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') { paused.current.hover = true; sync(); } }}
        onPointerLeave={() => { paused.current.hover = false; sync(); }}
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const t = touch.current; touch.current = null;
          if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(indexRef.current + (dx < 0 ? 1 : -1));
        }}
      >
        {items.map((item, i) => (
          <div key={item.photo.id} className="hero__slide" data-active={i === index || i === pending ? '' : undefined}>
            {mounted.includes(i) ? (
              <Image
                src={`/media/${item.photo.id}`}
                alt={i === index ? item.alt : ''}
                fill
                sizes="(max-width: 767px) 100vw, calc(100vw - 64px)"
                placeholder="blur"
                blurDataURL={item.photo.blur}
                style={{ objectPosition: `${Math.round(item.photo.focalX * 100)}% ${Math.round(item.photo.focalY * 100)}%` }}
                {...(i === 0 ? { loading: 'eager' as const, fetchPriority: 'high' as const, 'data-critical': '' } : {})}
                onLoad={i === 0 && count > 1 ? () => mount(1) : undefined}
              />
            ) : null}
          </div>
        ))}
        {project ? (
          <div className="hero__link" aria-hidden="true" onClick={() => strip.current?.querySelector<HTMLAnchorElement>('.hero__open')?.click()} />
        ) : null}
        <div className="hero__rule" aria-hidden="true" />
      </div>
      <div ref={strip} className="hero__strip">
        <div className="hero__cell hero__cell--title">
          <h1 className="hero__title" data-split="lines" data-intro>{title}</h1>
        </div>
        {CELLS.map((c) => (
          <div key={c.key} className={`hero__cell ${c.className}`}>
            <span className="label">{c.label}</span>
            <span className="hero__value" data-roll={c.key}>
              {c.key === 'project' && project ? (
                <Link prefetch={false} href={`/projects/${project.slug}`} data-label={project.name} data-sheet={String(project.no).padStart(3, '0')} className="hero__open" data-now>{now[c.key]}</Link>
              ) : (
                <span data-now>{now[c.key]}</span>
              )}
              <span data-next aria-hidden="true">{incoming ? incoming[c.key] : ''}</span>
            </span>
          </div>
        ))}
        <div className="hero__cell hero__cell--controls">
          <div className="hero__controls">
            <span className="hero__count" role="status" aria-label={`Photograph ${index + 1} of ${count}`}>{pad(index + 1)} / {pad(count)}</span>
            <div className="hero__buttons">
              <button className="icon-btn" data-dir="prev" onClick={() => go(indexRef.current - 1)} aria-label="Previous photograph">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d="M13 7H1M6 2 1 7l5 5" /></svg>
              </button>
              <button className="icon-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? (
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d="M4.5 2v10M9.5 2v10" /></svg>
                ) : (
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d="M3.5 2v10l8-5z" /></svg>
                )}
              </button>
              <button className="icon-btn" data-dir="next" onClick={() => go(indexRef.current + 1)} aria-label="Next photograph">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d="M1 7h12M8 2l5 5-5 5" /></svg>
              </button>
            </div>
          </div>
          <div className="hero__progress" aria-hidden="true"><span ref={progress} /></div>
        </div>
      </div>
    </section>
  );
}
