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
