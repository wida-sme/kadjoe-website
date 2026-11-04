'use client';

import { useEffect } from 'react';

/** Scroll reveals and the tagline's word by word reveal on /portfolio. The CSS hides nothing unless the
 *  root layout marked <html> with `js` and `motion` before paint, so reduced motion shows everything. */
export function PortfolioMotion() {
  useEffect(() => {
    // Each block rises into place once, the first time it enters the screen.
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('[data-pf-reveal]').forEach((el) => io.observe(el));

    // Tagline: words light up in reading order as the line scrolls from 85% to 50% of the screen.
    const tagline = document.querySelector<HTMLElement>('[data-pf-tagline]');
    const words = tagline ? [...tagline.querySelectorAll<HTMLElement>('.pf-word')] : [];
    let lit = 0;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!tagline) return;
      const r = tagline.getBoundingClientRect();
      const progress = (innerHeight * 0.85 - r.top) / (innerHeight * 0.35 + r.height);
      const n = Math.min(words.length, Math.floor(progress * words.length));
      for (; lit < n; lit++) words[lit].classList.add('is-on');
      if (lit === words.length) removeEventListener('scroll', onScroll);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    if (words.length) {
      addEventListener('scroll', onScroll, { passive: true });
      update();
    }

    return () => {
      io.disconnect();
      removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
