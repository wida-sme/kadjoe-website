'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { site } from '@/content/site';
import { ease, prefersReducedMotion, startScroll, stopScroll } from '@/engine';

const isCurrent = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus = true) => {
    const menu = menuRef.current;
    if (!menu || menu.hidden) return;
    const done = () => {
      setOpen(false);
      startScroll();
      if (restoreFocus) buttonRef.current?.focus();
    };
    if (prefersReducedMotion()) return done();
    gsap.to(menu, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.6, ease: ease.inOut, onComplete: done });
  }, []);

  // A navigation closes the menu without stealing focus back.
  useEffect(() => { close(false); }, [path, close]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) return;
    stopScroll();
    if (!prefersReducedMotion()) {
      gsap.fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: ease.inOut });
      gsap.fromTo(menu.querySelectorAll('.menu__links a'), { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: ease.out, stagger: 0.05, delay: 0.25 });
    }
    menu.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const items = [...menu.querySelectorAll<HTMLElement>('a, button')];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      <header className="header">
        <Link prefetch={false} href="/" className="header__logo" aria-label="Kadjoe, home" data-label="Kadjoe">
          <span className="logo" aria-hidden="true" />
        </Link>
        <nav className="nav" aria-label="Main">
          {site.nav.map((n) => (
            <Link prefetch={false} key={n.href} href={n.href} className="nav__link" aria-current={isCurrent(path, n.href) ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <button ref={buttonRef} className="menu-btn" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(true)}>
          Menu
        </button>
      </header>
      <div ref={menuRef} id="menu" className="menu" role="dialog" aria-modal="true" aria-label="Menu" hidden={!open} data-lenis-prevent>
        <div className="menu__top">
          <Link prefetch={false} href="/" className="header__logo" aria-label="Kadjoe, home" data-label="Kadjoe">
            <span className="logo" aria-hidden="true" />
          </Link>
          <button className="menu__close" onClick={() => close()}>Close</button>
        </div>
        <ul className="menu__links">
          {site.nav.map((n) => (
            <li key={n.href}>
              <Link prefetch={false} href={n.href} aria-current={isCurrent(path, n.href) ? 'page' : undefined}>{n.label}</Link>
            </li>
          ))}
        </ul>
        <div className="menu__foot">
          <span>{site.legalName}</span>
        </div>
      </div>
    </>
  );
}
