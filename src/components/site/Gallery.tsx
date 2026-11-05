'use client';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ease, prefersReducedMotion, startScroll, stopScroll } from '@/engine';
import { cellSizes, type CellKind } from '@/lib/sizes';
import type { Photo } from '@/server/site/queries';

export type GalleryRow = { kind: CellKind; photos: number[] };

const pad = (n: number, w: number) => String(n).padStart(w, '0');

export function Gallery({ photos, rows, alt, name }: { photos: Photo[]; rows: GalleryRow[]; alt: string; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const w = String(photos.length).length < 2 ? 2 : String(photos.length).length;

  const close = useCallback(() => {
    const el = box.current;
    const done = () => { setOpen(null); startScroll(); opener.current?.focus(); };
    if (!el || prefersReducedMotion()) return done();
    gsap.to(el, { clipPath: 'inset(100% 0% 0% 0%)', duration: 0.6, ease: ease.inOut, onComplete: done });
  }, []);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length]);

  useEffect(() => {
    const el = box.current;
    if (open === null || !el) return;
    stopScroll();
    el.querySelector<HTMLElement>('[data-close]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'Tab') {
        const items = [...el.querySelectorAll<HTMLElement>('button')];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open === null, close, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = (i: number, el: HTMLElement) => {
    opener.current = el;
    setOpen(i);
    requestAnimationFrame(() => {
      if (box.current && !prefersReducedMotion()) {
        gsap.fromTo(box.current, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: ease.inOut });
      }
    });
  };

  const touch = useRef<number | null>(null);
  const current = open === null ? null : photos[open];

  return (
    <>
      <div className="gallery wrap">
        {rows.map((row, r) => (
          <div key={r} className={`g-row g-row--${row.kind}`}>
            {row.photos.map((i) => {
              const p = photos[i];
              const share = row.kind === 'pair' ? (p.width / p.height) / row.photos.reduce((t, j) => t + photos[j].width / photos[j].height, 0) : 1;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="g-item"
                  style={{ '--r': p.width / p.height, aspectRatio: `${p.width} / ${p.height}` } as React.CSSProperties}
                  onClick={(e) => show(i, e.currentTarget)}
                  aria-label={`Open photograph ${i + 1} of ${photos.length}`}
                >
                  <div className="photo" data-reveal={r === 0 ? undefined : 'clip'}>
                    <Image
                      src={`/media/${p.id}`}
                      alt={p.alt ?? `${alt}, photograph ${i + 1}`}
                      fill
                      sizes={cellSizes(row.kind, share)}
                      placeholder="blur"
                      blurDataURL={p.blur}
                      // The first two photographs come with the page (the first is the likely LCP);
                      // the rest wait until they are near the screen.
                      {...(i === 0 ? { loading: 'eager' as const, fetchPriority: 'high' as const } : i === 1 ? { loading: 'eager' as const } : { loading: 'lazy' as const })}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div
        ref={box}
        className="lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={`${name}, photographs`}
        hidden={open === null}
        data-lenis-prevent
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
        }}
      >
        <div className="lightbox__top">
          <span>{name}</span>
          <button type="button" data-close onClick={close}>Close</button>
        </div>
        <div className="lightbox__stage">
          {current ? (
            <Image
              key={current.id}
              src={`/media/${current.id}`}
              alt={current.alt ?? `${alt}, photograph ${open! + 1}`}
              width={current.width}
              height={current.height}
              sizes="100vw"
              placeholder="blur"
              blurDataURL={current.blur}
              style={{ maxHeight: 'calc(100svh - 112px)', width: 'auto' }}
            />
          ) : null}
        </div>
        <div className="lightbox__foot">
          <span className="num" aria-live="polite">{open === null ? '' : `${pad(open + 1, w)} / ${pad(photos.length, w)}`}</span>
          <div className="lightbox__nav">
            <button type="button" onClick={() => step(-1)}>Previous</button>
            <button type="button" onClick={() => step(1)}>Next</button>
          </div>
        </div>
      </div>
    </>
  );
}
