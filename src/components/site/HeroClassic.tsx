'use client';
// The hero as on the previous site (../kadjoe-website): the dashboard's photographs cross-fade under a
// centred tagline; the project's name and place sit bottom right, above one dash per photograph.
// Contrast comes from the current scrims (site.css), not the old full-frame veil.
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ease, onScroll, prefersReducedMotion, scrollState } from '@/engine';
import { usePage } from '@/engine/next';
import type { HeroItem, HeroTitleParts } from './HeroSheet';

const HOLD = 7500; // ms a photograph stays, as on the old site

// "Kebayoran Baru, Jakarta Selatan" → "Kebayoran Baru": the old caption names the place, not the city.
const place = (location: string | null | undefined) => location?.split(',')[0].trim() ?? '';

export function HeroClassic({ items, title, kicker }: { items: HeroItem[]; title: HeroTitleParts; kicker: string }) {
  const count = items.length;
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState<number[]>([0]);
  const [held, setHeld] = useState(false);
  const root = useRef<HTMLElement>(null);

  const go = useCallback((i: number) => {
    const next = ((i % count) + count) % count;
    const after = (next + 1) % count;
    setMounted((m) => (m.includes(next) && m.includes(after) ? m : [...new Set([...m, next, after])]));
    setIndex(next);
  }, [count]);

  // Next photograph after HOLD, unless keyboard focus is in the hero or the visitor asked for reduced
  // motion (then the dashes still change it). No pause on hover: the hero fills the screen, so the
  // pointer is nearly always over it.
  useEffect(() => {
    if (count < 2 || held || prefersReducedMotion()) return;
    const t = setTimeout(() => go(index + 1), HOLD);
    return () => clearTimeout(t);
  }, [index, held, count, go]);

  // Each photograph starts its slow zoom again when it comes back.
  useEffect(() => {
    root.current?.querySelector(`[data-i="${index}"] img`)?.getAnimations().forEach((a) => { a.cancel(); a.play(); });
  }, [index]);

  // The header strip is clear over the photograph (CSS); once the photograph has gone under it, paper again.
  useEffect(() => {
    const html = document.documentElement;
    const header = document.querySelector<HTMLElement>('.header');
    const past = ({ y }: { y: number }) => html.classList.toggle('past-hero', y > (root.current?.offsetHeight ?? 0) - (header?.offsetHeight ?? 64));
    past(scrollState());
    const off = onScroll(past);
    return () => { off(); html.classList.remove('past-hero'); };
  }, []);

  // Entrance, after the loader or the page transition: the kicker settles, the two title lines rise out of
  // their masks one after the other, then the link and the caption. Back/forward or reduced motion: at once.
  usePage(({ intro, restored }) => {
    const r = root.current;
    if (!r) return;
    const lines = r.querySelectorAll('.hc__line > span');
    if (restored || prefersReducedMotion()) {
      gsap.set([...lines, ...r.querySelectorAll('.hc__kicker, .hc__cta, .hc__meta, .hc__cue')], { autoAlpha: 1 });
      return;
    }
    intro.add(gsap.timeline()
      .fromTo(r.querySelector('.hc__kicker'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: ease.out })
      .fromTo(lines, { yPercent: 110, autoAlpha: 1 }, { yPercent: 0, duration: 1.1, ease: ease.out, stagger: 0.12 }, 0.1)
      .fromTo(r.querySelector('.hc__cta'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: ease.out }, 0.5)
      .fromTo(r.querySelectorAll('.hc__meta, .hc__cue'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, ease: ease.soft }, 0.75), 0.1);
  });

  const project = items[index].project;

  return (
    <section
      ref={root}
      className="hero hc"
      aria-label="Selected projects"
      onFocus={() => setHeld(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false); }}
    >
      {items.map((item, i) => (
        <div key={item.photo.id} className="hc__slide" data-i={i} data-on={i === index ? '' : undefined} aria-hidden={i !== index}>
          {mounted.includes(i) ? (
            <Image
              src={`/media/${item.photo.id}`}
              alt={i === index ? item.alt : ''}
              fill
              sizes="100vw"
              placeholder="blur"
              blurDataURL={item.photo.blur}
              style={{ objectPosition: `${Math.round(item.photo.focalX * 100)}% ${Math.round(item.photo.focalY * 100)}%` }}
              {...(i === 0 ? { loading: 'eager' as const, fetchPriority: 'high' as const, 'data-critical': '' } : {})}
              onLoad={i === 0 && count > 1 ? () => setMounted((m) => (m.includes(1) ? m : [...m, 1])) : undefined}
            />
          ) : null}
        </div>
      ))}

      <div className="hc__content">
        <p className="hc__kicker">{kicker}</p>
        <h1 className="hc__title">
          <span className="hc__line"><span>{title.lead} <em>{title.first}</em></span></span>{' '}
          <span className="hc__line"><span>&amp; {title.second}</span></span>
        </h1>
        <Link prefetch={false} href="/projects" className="hc__cta" data-label="Projects">
          Discover the work<span className="hc__arrow" aria-hidden="true" />
        </Link>
      </div>

      <div className="hc__meta">
        {project ? (
          <>
            <p className="hc__name">{project.name}</p>
            <p className="hc__place">{place(project.location)}</p>
          </>
        ) : null}
        {count > 1 ? (
          <div className="hc__dots">
            {items.map((item, i) => (
              <button
                key={item.photo.id}
                type="button"
                aria-label={`Show ${item.project?.name ?? `photograph ${i + 1}`}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="hc__cue" aria-hidden="true" />
    </section>
  );
}
