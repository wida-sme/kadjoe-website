'use client';
// Next.js App Router adapter. Render <Engine setup={…} /> once, as the LAST child of the site
// layout (React runs child effects first, so page components register before the engine boots).
// Internal links (plain <a> or next/link) get leave → push → enter. Opt a link out with
// data-no-transition. Back/forward re-inits the page without the curtain.
import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { boot, cleanup, enter, leave, onPage, type PageFn } from './index';

export function Engine({ setup }: { setup?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const mode = useRef<'idle' | 'push' | 'pop'>('idle');
  const first = useRef(true);
  const lastUrl = useRef('');

  useEffect(() => { boot(setup); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest('a');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith('/media')) return;
      if (url.pathname === location.pathname) return; // hash or query change on the same page
      e.preventDefault(); // next/link sees defaultPrevented and stands down
      if (mode.current !== 'idle') return;
      mode.current = 'push';
      const href = url.pathname + url.search + url.hash;
      router.prefetch(href);
      await leave();
      cleanup();
      router.push(href, { scroll: false });
    };
    // Hash-only history steps keep the page; anything else swaps it without the curtain.
    const onPop = () => {
      if (location.pathname + location.search === lastUrl.current) return;
      mode.current = 'pop';
      cleanup();
    };
    document.addEventListener('click', onClick, true);
    addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('click', onClick, true);
      removeEventListener('popstate', onPop);
    };
  }, [router]);

  useEffect(() => {
    lastUrl.current = location.pathname + location.search;
    if (first.current) { first.current = false; return; }
    if (mode.current === 'idle') return; // same-page query change (filters): no page swap
    const pop = mode.current === 'pop';
    mode.current = 'idle';
    enter({ transition: !pop, scrollTop: !pop });
  }, [pathname, search]);

  return null;
}

/** Component-level page code: runs when the page is ready (after the loader), reverted on leave. */
export function usePage(fn: PageFn) {
  useEffect(() => onPage(fn), []); // eslint-disable-line react-hooks/exhaustive-deps
}
