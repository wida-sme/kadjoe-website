// `sizes` for photographs cropped into frames (object-fit: cover). The browser picks a file by the
// width it is told. A landscape photograph cropped into a portrait frame is drawn wider than the
// frame, so that drawn width is what it must be told, or the file it picks is upscaled on screen.

type Shape = { width: number; height: number };

/** The width a photograph is drawn at when it covers a frame `width` wide, of aspect `frame`
 *  (width / height). */
export function coverWidth(photo: Shape, frame: number, width: string) {
  const f = photo.width / photo.height / frame;
  return f > 1.01 ? `calc(${width} * ${f.toFixed(2)})` : width;
}

// The six-photograph cycle of the photograph walls (home "Selected projects" and the projects
// index): the slot's width on the 12-column grid and its frame, as hung in site.css (.wall).
const WALL = [
  { desk: '56vw', phone: '100vw', frame: 3 / 2 },
  { desk: '31vw', phone: '70vw', frame: 4 / 5 },
  { desk: '31vw', phone: '78vw', frame: 4 / 5 },
  { desk: '47vw', phone: '100vw', frame: 3 / 2 },
  { desk: '47vw', phone: '100vw', frame: 3 / 2 },
  { desk: '39vw', phone: '70vw', frame: 4 / 5 },
] as const;

/** `sizes` for the photograph in position `i` of a wall. On phones the home wall hangs one
 *  photograph per row; the projects index (`pair`) two, in 4:5 frames. */
export function wallSizes(photo: Shape, i: number, { phone = 'wall' }: { phone?: 'wall' | 'pair' } = {}) {
  const slot = WALL[i % WALL.length];
  const small = phone === 'pair' ? coverWidth(photo, 4 / 5, '46vw') : coverWidth(photo, slot.frame, slot.phone);
  return `(max-width: 767px) ${small}, ${coverWidth(photo, slot.frame, slot.desk)}`;
}

// The case page gallery hangs photographs at their own aspect ratio (no crop) in rows set in
// site.css (.g-row--*): the sheet is the page less its margins (at most 32 px a side; 16 on phones).
export type CellKind = 'full' | 'right' | 'left' | 'pair' | 'solo-left' | 'solo-right';
const sheet = (share: number, phone: boolean) => {
  const base = phone ? '100vw - 32px' : '100vw - 64px';
  return share === 1 ? `calc(${base})` : `calc((${base}) * ${share})`;
};

/** `sizes` for a photograph in a gallery row; `share` is its part of a pair (by aspect ratio). */
export function cellSizes(kind: CellKind, share = 1) {
  const s = Math.round(share * 100) / 100;
  if (kind === 'pair') return `(max-width: 767px) ${sheet(s, true)}, ${sheet(s, false)}`;
  if (kind === 'solo-left' || kind === 'solo-right') return `(max-width: 767px) ${sheet(0.82, true)}, ${sheet(0.5, false)}`;
  if (kind === 'right' || kind === 'left') return `(max-width: 767px) ${sheet(1, true)}, ${sheet(0.75, false)}`;
  return `(max-width: 767px) ${sheet(1, true)}, ${sheet(1, false)}`;
}
