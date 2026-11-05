'use client';
// The hero sheet: a drawing sheet with the photographs chosen in the finance app in its drawing area
// and a title block down its right edge (under the photograph on narrow screens). A change slides
// the parallel rule down the whole sheet: the next photograph appears in its wake and every
// title-block cell is redrawn exactly where the rule passes it. React owns every node and every
// text; GSAP only moves the rule and draws the wipe.
import { getImageProps } from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ease, prefersReducedMotion } from '@/engine';
import { usePage } from '@/engine/next';
import { coverWidth } from '@/lib/sizes';

export type HeroItem = {
  photo: { id: string; blur: string; focalX: number; focalY: number; width: number; height: number };
  alt: string;
  project: { slug: string; no: number; name: string; location: string | null; year: string | null; design: string | null } | null;
};

const HOLD = 6.5; // seconds a photograph stays
const pad = (n: number) => String(n).padStart(2, '0');
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function fields(item: HeroItem) {
  const p = item.project;
  return { sheet: p ? String(p.no).padStart(3, '0') : '', project: p?.name ?? 'Kadjoe', location: p?.location ?? '', design: p?.design ?? '', year: p?.year ?? '' };
}
type Field = keyof ReturnType<typeof fields>;

/** A cell value that can be redrawn. It has two buffers in the same place: the front one shows the
 *  current project; a change writes the next project into the back one, the rule wipes it in and the
 *  two swap roles. No text changes and no box moves when the change ends (CLS stays 0); the back
 *  buffer is hidden between changes (site.css). */
function Value({ field, bufs, front, className = '', link = false }: {
  field: Field; bufs: [HeroItem | null, HeroItem | null]; front: 0 | 1; className?: string; link?: boolean;
}) {
  return (
    <span className={`hero__value ${className}`} data-roll={field}>
      {bufs.map((item, k) => {
        const v = item ? fields(item) : null;
        const own = { 'data-buf': k, 'data-front': k === front ? '' : undefined, 'aria-hidden': k === front ? undefined : true };
        return link && item?.project ? (
          <Link key={k} prefetch={false} href={`/projects/${item.project.slug}`} data-label={item.project.name} data-sheet={v!.sheet} className="hero__open" tabIndex={k === front ? undefined : -1} {...own}>{v!.project}</Link>
        ) : <span key={k} {...own}>{v ? v[field] : ''}</span>;
      })}
    </span>
  );
}

/** One photograph of the sheet. Phones get one file whatever their density (the first one is the
 *  largest paint there); larger screens pick from the srcset by the width the photograph is drawn
 *  at, crop included. */
function HeroPhoto({ item, alt, first, onLoad }: { item: HeroItem; alt: string; first: boolean; onLoad?: () => void }) {
  const { photo } = item;
  const ref = useRef<HTMLImageElement>(null);
  // A photograph that arrived before hydration fired its load event before React listened.
  useEffect(() => { if (ref.current?.complete && ref.current.naturalWidth) onLoad?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { props } = getImageProps({
    src: `/media/${photo.id}`,
    alt,
    fill: true,
    // Desktop: the drawing area is the page less its margins and the title block, about 1.28:1.
    sizes: `(max-width: 1023px) calc(100vw - 40px), ${coverWidth(photo, 1.28, 'calc(75vw - 64px)')}`,
    placeholder: 'blur',
    blurDataURL: photo.blur,
    style: { objectPosition: `${Math.round(photo.focalX * 100)}% ${Math.round(photo.focalY * 100)}%` },
    ...(first ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {}),
  });
  const { srcSet, sizes, ...img } = props;
  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={`/media/${photo.id}/800.webp 1x, /media/${photo.id}/1440.webp 2x`} />
      <source media="(min-width: 768px)" srcSet={srcSet} sizes={sizes} />
      <img {...img} ref={ref} alt={alt} onLoad={onLoad} />
    </picture>
  );
}

export function HeroSheet({ items, title }: { items: HeroItem[]; title: string }) {
  const count = items.length;
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  // Which slide each title-block buffer holds, and which buffer is in front (see Value).
  const [bufs, setBufs] = useState<[number | null, number | null]>([0, null]);
  const [front, setFront] = useState<0 | 1>(0);
  const frontRef = useRef<0 | 1>(0);
  const [mounted, setMounted] = useState<number[]>([0]);
  const [playing, setPlaying] = useState(true);
  const sheet = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const block = useRef<HTMLDivElement>(null);
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
    setBufs((b) => (frontRef.current === 0 ? [b[0], next] : [next, b[1]]));
    setPending(next);
  }, [count, mount]);
  useEffect(() => { goRef.current = go; }, [go]);

  /** Moves the rule to `y` (px from the top of the sheet) and draws everything it has passed: the
   *  incoming photograph above it, and in every title-block cell the next value above it and the
   *  current one below. Returns the function for one change (geometry measured once). */
  const rulePass = useCallback((incoming: HTMLElement | null, first: boolean) => {
    const root = sheet.current!, st = stage.current!, tb = block.current!;
    const top = root.getBoundingClientRect().top;
    const box = (el: Element) => { const r = el.getBoundingClientRect(); return { top: r.top - top, h: Math.max(1, r.height) }; };
    const stageBox = box(st), tbBox = box(tb);
    const rules = [st.querySelector<HTMLElement>('.hero__rule')!, tb.querySelector<HTMLElement>('.hero__rule')!];
    // Each value is measured on its own: in a tall cell it sits at the bottom, and the wipe must
    // follow the rule across the lettering itself.
    const cells = [...tb.querySelectorAll<HTMLElement>('[data-roll]')].map((cell) => {
      const now = cell.querySelector<HTMLElement>('[data-front]')!, next = cell.querySelector<HTMLElement>('[data-buf]:not([data-front])')!;
      return { now, next, nowBox: box(now), nextBox: box(next) };
    });
    const height = root.getBoundingClientRect().height;
    const above = (f: number) => `inset(0% 0% ${((1 - f) * 100).toFixed(3)}% 0%)`; // shown above the rule
    const below = (f: number) => `inset(${(f * 100).toFixed(3)}% 0% 0% 0%)`; // shown below the rule
    const passed = (y: number, b: { top: number; h: number }) => clamp01((y - b.top) / b.h);
    const draw = (y: number) => {
      gsap.set(rules[0], { y: y - stageBox.top });
      gsap.set(rules[1], { y: y - tbBox.top });
      if (incoming) incoming.style.clipPath = above(passed(y, stageBox));
      for (const c of cells) {
        if (first) { c.now.style.clipPath = above(passed(y, c.nowBox)); continue; } // drawn in from nothing
        c.next.style.clipPath = above(passed(y, c.nextBox));
        c.now.style.clipPath = below(passed(y, c.nowBox));
      }
    };
    return { draw, height, rules };
  }, []);

  // The change itself runs once React has rendered the incoming photograph and the incoming texts.
  useLayoutEffect(() => {
    if (pending === null) return;
    const slides = stage.current!.querySelectorAll<HTMLElement>('.hero__slide');
    const incoming = slides[pending];
    const tb = block.current!;
    const done = () => {
      indexRef.current = pending;
      frontRef.current = frontRef.current === 0 ? 1 : 0;
      setIndex(pending);
      setFront(frontRef.current);
      setPending(null);
    };
    gsap.set(incoming, { zIndex: 2 });
    tb.setAttribute('data-changing', ''); // the back buffers show while the rule passes
    if (prefersReducedMotion()) {
      const tl = gsap.timeline({ onComplete: done })
        .fromTo(incoming, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 }, 0)
        .fromTo(tb.querySelectorAll('[data-buf]:not([data-front])'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 }, 0)
        .to(tb.querySelectorAll('[data-buf][data-front]'), { autoAlpha: 0, duration: 0.35 }, 0);
      return () => { tl.kill(); };
    }
    const pass = rulePass(incoming, false);
    const p = { y: 0 };
    pass.draw(0);
    const img = incoming.querySelector('img');
    const tl = gsap.timeline({ onComplete: done, paused: true })
      .set(pass.rules, { opacity: 1 })
      .to(p, { y: pass.height, duration: pass.height > 960 ? 1.45 : 1.2, ease: ease.inOut, onUpdate: () => pass.draw(p.y) }, 0)
      .fromTo(img, { scale: 1.05 }, { scale: 1, duration: 1.7, ease: ease.out }, 0)
      .to(pass.rules, { opacity: 0, duration: 0.2 }, '>-0.2');
    // The rule waits (a moment at most) for the photograph it reveals, so it never uncovers a blur.
    let live = true;
    const ready = !img || (img.complete && img.naturalWidth > 0) ? Promise.resolve() : Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 700))]);
    ready.then(() => { if (live) tl.play(); });
    return () => { live = false; tl.kill(); };
  }, [pending, rulePass]);

  // After the swap is committed: reset what GSAP and the wipe touched, then start the next hold.
  useLayoutEffect(() => {
    const st = stage.current, tb = block.current;
    if (!st || !tb) return;
    gsap.set(st.querySelectorAll('.hero__slide, .hero__slide img'), { clearProps: 'zIndex,clipPath,opacity,visibility,scale' });
    gsap.set(tb.querySelectorAll('[data-buf]'), { clearProps: 'clipPath,opacity,visibility' });
    tb.removeAttribute('data-changing');
    busy.current = false;
    restartHold();
  }, [index, restartHold]);

  usePage(({ intro, restored }) => {
    const tb = block.current!;
    const reduced = prefersReducedMotion();
    // First sight: the photograph is there from the first paint; the rule passes once over the
    // sheet and draws the title-block values in as it goes (they wait, hidden, in site.css).
    if (!reduced && !restored) {
      const pass = rulePass(null, true);
      const p = { y: 0 };
      intro.add(gsap.timeline({
        onStart: () => { busy.current = true; },
        onComplete: () => {
          busy.current = false;
          tb.setAttribute('data-drawn', '');
          gsap.set(tb.querySelectorAll('[data-buf]'), { clearProps: 'clipPath' });
        },
      })
        .add(() => { pass.draw(0); })
        .set(pass.rules, { opacity: 1 })
        .to(p, { y: pass.height, duration: 1.4, ease: ease.inOut, onUpdate: () => pass.draw(p.y) })
        .to(pass.rules, { opacity: 0, duration: 0.25 }, '>-0.25'), 0.1);
    } else {
      tb.setAttribute('data-drawn', '');
    }
    // Under reduced motion nothing advances by itself; Play still works if the visitor asks for it.
    if (reduced) { paused.current.user = true; setPlaying(false); }
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
  const project = items[index].project;
  const held: [HeroItem | null, HeroItem | null] = [bufs[0] === null ? null : items[bufs[0]], bufs[1] === null ? null : items[bufs[1]]];

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div ref={sheet} className="hero__sheet">
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
                <HeroPhoto item={item} alt={i === index ? item.alt : ''} first={i === 0} onLoad={i === 0 && count > 1 ? () => mount(1) : undefined} />
              ) : null}
            </div>
          ))}
          {project ? (
            <div className="hero__link" aria-hidden="true" onClick={() => block.current?.querySelector<HTMLAnchorElement>('.hero__open')?.click()} />
          ) : null}
          <div className="hero__rule hero__rule--photo" aria-hidden="true" />
        </div>

        <div ref={block} className="hero__tb">
          <div className="hero__cell hero__cell--title">
            <h1 id="hero-title" className="hero__title" data-split="lines" data-intro>{title}</h1>
          </div>
          <div className="hero__cell hero__cell--project">
            <span className="label">Project</span>
            <Value field="project" bufs={held} front={front} className="hero__name" link />
          </div>
          <div className="hero__cell hero__cell--location">
            <span className="label">Location</span>
            <Value field="location" bufs={held} front={front} />
          </div>
          <div className="hero__cell hero__cell--year">
            <span className="label">Year</span>
            <Value field="year" bufs={held} front={front} />
          </div>
          <div className="hero__cell hero__cell--design">
            <span className="label">Design</span>
            <Value field="design" bufs={held} front={front} />
          </div>
          <div className="hero__cell hero__cell--sheet">
            <span className="label">Sheet</span>
            <Value field="sheet" bufs={held} front={front} className="hero__no" />
          </div>
          <div className="hero__cell hero__cell--controls">
            <div className="hero__controls">
              {/* Quiet while the photographs change by themselves; spoken once the visitor takes over. */}
              <span className="hero__count" role="status" aria-live={playing ? 'off' : 'polite'} aria-label={`Photograph ${index + 1} of ${count}`}>{pad(index + 1)} / {pad(count)}</span>
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
          <div className="hero__track" aria-hidden="true"><div className="hero__rule hero__rule--tb" /></div>
        </div>
      </div>
    </section>
  );
}
