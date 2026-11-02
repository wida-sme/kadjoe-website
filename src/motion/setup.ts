// Global motion for the site: runs once on the client, before the first page initialises.
//   - page transition: the dark divider sheet slides down carrying the destination's name
//   - loader exit: the sheet lifts off the first page
//   - the header strip steps aside while scrolling down
//   - index lists: a photograph follows the pointer
import { gsap } from 'gsap';
import { ease, isTouch, onPage, onScroll, prefersReducedMotion, setLoaderExit, setTransition } from '@/engine';

// Sheet numbers follow the menu; a project's sheet is its number in the register.
const SHEETS: Record<string, [string, string]> = {
  '/': ['000', 'Kadjoe'],
  '/projects': ['001', 'Projects'],
  '/partners': ['002', 'Design partners'],
  '/about': ['003', 'About Us'],
  '/contact': ['004', 'Contact'],
};

let next = { sheet: '', label: '' };

function sheetFor(a: HTMLAnchorElement) {
  const url = new URL(a.href, location.href);
  const known = SHEETS[url.pathname];
  return { sheet: a.dataset.sheet ?? known?.[0] ?? '', label: a.dataset.label ?? known?.[1] ?? a.textContent?.trim() ?? '' };
}

export function setupMotion() {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.('a');
    if (a) next = sheetFor(a);
  }, true);

  setTransition({
    leave: (c) => {
      const panel = c.querySelector<HTMLElement>('.curtain__panel')!;
      const tb = c.querySelector<HTMLElement>('[data-curtain-tb]')!;
      c.querySelector('[data-curtain-label]')!.textContent = next.label;
      c.querySelector('[data-curtain-sheet]')!.textContent = next.sheet;
      tb.toggleAttribute('data-no-sheet', !next.sheet);
      return gsap.timeline()
        .set(c, { autoAlpha: 1 })
        .fromTo(panel, { yPercent: -100 }, { yPercent: 0, duration: 0.75, ease: ease.inOut })
        .fromTo(tb, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: ease.inOut }, 0.35)
        .fromTo(tb.querySelectorAll('.curtain__v'), { yPercent: 110 }, { yPercent: 0, duration: 0.55, ease: ease.out, stagger: 0.05 }, 0.55);
    },
    enter: (c) => {
      const panel = c.querySelector<HTMLElement>('.curtain__panel')!;
      const tb = c.querySelector<HTMLElement>('[data-curtain-tb]')!;
      return gsap.timeline()
        .to(tb, { autoAlpha: 0, duration: 0.3, ease: ease.soft })
        .to(panel, { yPercent: 100, duration: 0.8, ease: ease.inOut }, 0.1)
        .set(c, { autoAlpha: 0 })
        .set(panel, { yPercent: 0 })
        .set(tb, { clearProps: 'opacity,visibility,clipPath' });
    },
  });

  setLoaderExit((root) => gsap.timeline()
    .to(root.querySelectorAll('[data-loader-out]'), { autoAlpha: 0, duration: 0.3, ease: ease.soft })
    .to(root, { yPercent: -100, duration: 0.85, ease: ease.inOut }, 0.15));

  // The header strip steps aside while reading down and returns on the way up.
  let last = 0;
  const html = document.documentElement;
  onScroll(({ y }) => {
    if (Math.abs(y - last) < 6) return;
    const away = y > 160 && y > last && !document.getElementById('menu')?.offsetParent;
    html.classList.toggle('frame-away', away);
    last = y;
  });

  indexPreview();
  titleBlocks();
}

// Title blocks are drawn on arrival: the top rule draws from the left, then each cell's lettering rises.
function titleBlocks() {
  onPage(({ intro, restored }) => {
    if (prefersReducedMotion() || restored) return;
    document.querySelectorAll<HTMLElement>('[data-tb]').forEach((tb) => {
      const rule = tb.querySelector('.tb__rule');
      const items = tb.querySelectorAll('.tb__cell > *');
      const tl = gsap.timeline()
        .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: ease.inOut })
        .from(items, { yPercent: 60, autoAlpha: 0, duration: 0.8, ease: ease.out, stagger: 0.03, clearProps: 'transform,opacity,visibility' }, 0.35);
      intro.add(tl, 0.15);
    });
  });
}

// Rows marked data-preview="<image url>" inside [data-preview-list] show that photograph next to the
// pointer. Delegated from the document, so lists that appear later (a view switch) work too. Touch
// devices see inline thumbnails instead (CSS).
// The photograph never covers the row's label (the element marked data-preview-label, else the row):
// it sits right of the pointer but not left of the label's end, takes the other side when that would
// run off the screen, and goes above or below the label only when neither side has room.
function indexPreview() {
  if (isTouch() || prefersReducedMotion()) return;
  let box: HTMLElement | null = null;
  let img: HTMLImageElement | null = null;
  let row: HTMLElement | null = null;
  let x: gsap.QuickToFunc | null = null, y: gsap.QuickToFunc | null = null;
  let px = -999, py = -999, shown = false;
  const bind = () => {
    const found = document.querySelector<HTMLElement>('.preview');
    if (found === box) return box;
    box = found;
    if (!box) return null;
    img = box.querySelector('img');
    gsap.set(box, { scale: 0.92, autoAlpha: 0 });
    x = gsap.quickTo(box, 'x', { duration: 0.7, ease: 'power3.out' });
    y = gsap.quickTo(box, 'y', { duration: 0.7, ease: 'power3.out' });
    shown = false;
    return box;
  };
  const hide = () => {
    row = null;
    if (!shown || !box) return;
    shown = false;
    gsap.to(box, { autoAlpha: 0, scale: 0.92, duration: 0.4, ease: ease.out, overwrite: 'auto' });
  };
  // The label's lettering, not its box: a label in a grid cell stretches across the row.
  const lettering = (el: Element) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    return r.width ? r : el.getBoundingClientRect();
  };
  /** Top-left corner of the photograph for the pointer and the hovered row. */
  const spot = (r: HTMLElement, b: HTMLElement): [number, number] => {
    const label = lettering(r.querySelector('[data-preview-label]') ?? r);
    const w = b.offsetWidth, h = b.offsetHeight, edge = 16, gap = 24, lead = 28;
    const top = Math.min(Math.max(py - h / 2, edge), innerHeight - h - edge);
    const right = Math.max(px + lead, label.right + gap);
    if (right + w <= innerWidth - edge) return [right, top];
    let left = px - lead - w;
    if (left < label.right + gap && left + w > label.left - gap) left = label.left - gap - w; // clear of the lettering
    if (left >= edge) return [left, top];
    const above = label.top - gap - h;
    return [Math.min(Math.max(px - w / 2, edge), innerWidth - w - edge), above >= edge ? above : label.bottom + gap];
  };
  const update = (target: Element | null) => {
    const hit = target?.closest<HTMLElement>('[data-preview-list] [data-preview]') ?? null;
    if (!hit) return hide();
    if (!bind() || !img || !box) return;
    row = hit;
    const src = hit.dataset.preview!;
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    const [left, top] = spot(row, box);
    if (!shown) {
      x!(left, left); y!(top, top); // appear in place, then follow
      gsap.to(box, { autoAlpha: 1, scale: 1, duration: 0.5, ease: ease.out, overwrite: 'auto' });
    } else {
      x!(left); y!(top);
    }
    shown = true;
  };
  addEventListener('pointermove', (e) => {
    px = e.clientX; py = e.clientY;
    update(e.target as Element);
  }, { passive: true });
  // pointerleave never fires when the page scrolls under a still pointer.
  onScroll(() => update(document.elementFromPoint(px, py)));
  onPage(() => {
    bind();
    document.querySelectorAll<HTMLElement>('[data-preview-list] [data-preview]').forEach((r, i) => { if (i < 3) new Image().src = r.dataset.preview!; });
    return () => { hide(); };
  });
}
