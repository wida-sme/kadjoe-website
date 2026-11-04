/* eslint-disable @next/next/no-html-link-for-pages -- see src/app/portfolio/page.tsx */
'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

type NavLink = { href: string; label: string };

/** The portfolio's floating bar: section links with the current one marked, the one action, and a full
 *  height menu on phones. */
export function PortfolioNav({ links, cta }: { links: NavLink[]; cta: NavLink }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // The current section is the one crossing the middle of the screen.
  useEffect(() => {
    const on = new Set<string>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) on.add(`#${e.target.id}`);
        else on.delete(`#${e.target.id}`);
      }
      setCurrent(links.find((l) => on.has(l.href))?.href ?? null);
    }, { rootMargin: '-50% 0px -50% 0px' });
    for (const l of links) {
      const el = document.getElementById(l.href.slice(1));
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [links]);

  // While the menu is open the page behind it neither scrolls nor takes focus; Escape closes it.
  useEffect(() => {
    if (!open) return;
    const behind = [...document.querySelectorAll<HTMLElement>('#main, .pf-footer')];
    const wide = matchMedia('(min-width: 768px)');
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      toggle.current?.focus();
    };
    document.documentElement.style.overflow = 'hidden';
    for (const el of behind) el.inert = true;
    addEventListener('keydown', onKey);
    wide.addEventListener('change', close);
    return () => {
      document.documentElement.style.overflow = '';
      for (const el of behind) el.inert = false;
      removeEventListener('keydown', onKey);
      wide.removeEventListener('change', close);
    };
  }, [open]);

  return (
    <header className="pf-nav">
      <div className="pf-bar">
        <a href="/" className="pf-logo" aria-label="Kadjoe, home"><span className="pf-logo__mark" aria-hidden="true" /></a>
        <nav aria-label="Sections" className="pf-bar__links">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="pf-bar__link title-4" aria-current={current === l.href ? 'true' : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
        <a href={cta.href} className="pf-btn pf-bar__cta button-sm">{cta.label}</a>
        <button
          ref={toggle} type="button" className="pf-toggle" aria-expanded={open} aria-controls="pf-menu"
          aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}
        >
          <span className="pf-toggle__bar" />
          <span className="pf-toggle__bar" />
        </button>
      </div>
      <div id="pf-menu" className="pf-menu" data-open={open ? '' : undefined}>
        <nav aria-label="Menu" className="pf-menu__nav">
          {links.map((l, i) => (
            <a
              key={l.href} href={l.href} className="pf-menu__item pf-menu__link heading-4"
              style={{ '--i': i } as CSSProperties} onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <a
            href={cta.href} className="pf-menu__item pf-btn button-md"
            style={{ '--i': links.length } as CSSProperties} onClick={() => setOpen(false)}
          >
            {cta.label}
          </a>
        </nav>
      </div>
    </header>
  );
}
