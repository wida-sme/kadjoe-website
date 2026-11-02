'use client';
// Next.js App Router adapter. Render <Engine setup={…} /> once, as the LAST child of the site
// layout (React runs child effects first, so page components register before the engine boots).
// Internal links (plain <a> or next/link) get leave → push → enter. Opt a link out with
// data-no-transition. Back/forward re-inits the page without the curtain.
//
// Page swaps are detected in the commit that renders the new page, not in a popstate listener.
// Next restores a history entry inside its own popstate listener, and React renders a transition
// started during popstate synchronously, effects included: by the time a listener of ours ran, the
// new page was already on screen. Only a pathname change swaps the page; a query or hash change on
// the same page (the project filters) keeps it.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { boot, cleanup, enter, leave, onPage, type PageFn } from './index';

export function Engine({ setup }: { setup?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const pushing = useRef(false); // a transition we started is on its way
  const shown = useRef<string | null>(null); // pathname of the page on screen
  const swap = useRef<'push' | 'pop' | null>(null);

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
      if (pushing.current) return;
      pushing.current = true;
      const href = url.pathname + url.search + url.hash;
      router.prefetch(href);
      await leave();
      cleanup();
      router.push(href, { scroll: false });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  // Layout phase of the commit that brings a new page: its components have not run their page code
  // yet (usePage registers in the passive phase), so the old page is torn down first. After a push
  // the curtain already did this; anything else that changes the page is a history step.
  useLayoutEffect(() => {
    const before = shown.current;
    shown.current = pathname;
    if (before === null || before === pathname) return; // first page (boot runs it), or same page
    swap.current = pushing.current ? 'push' : 'pop';
    pushing.current = false;
    cleanup();
  }, [pathname]);

  useEffect(() => {
    const kind = swap.current;
    if (!kind) return;
    swap.current = null;
    enter({ transition: kind === 'push', scrollTop: kind === 'push' });
  }, [pathname]);

  return null;
}

/** Component-level page code: runs when the page is ready (after the loader), reverted on leave. */
export function usePage(fn: PageFn) {
  useEffect(() => onPage(fn), []); // eslint-disable-line react-hooks/exhaustive-deps
}
