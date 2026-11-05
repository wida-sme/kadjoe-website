// Meta descriptions for case pages, built from database fields. Search results show about 160
// characters, so the description keeps to that: the facts (name, place, category, year) and the
// design credit first, then photography only if it still fits.
export const META_MAX = 160;

export type CaseFacts = {
  name: string;
  location: string | null;
  category: string; // 'Residential' | 'F&B' | 'Commercial'
  year: string | null;
  design: string | null; // designLine(): the studios, or 'Kadjoe' for in-house work
  inHouse: boolean;
  photographers: string[];
};

export function caseDescription(p: CaseFacts): string {
  const kind = p.category === 'F&B' ? 'an F&B' : `a ${p.category.toLowerCase()}`;
  const lead = (place: string | null) => `${p.name}${place ? `, ${place}` : ''}: ${kind} project built by Kadjoe${p.year ? ` (${p.year})` : ''}.`;
  const design = p.design && p.design !== 'Kadjoe' ? `Designed by ${p.design}.` : p.inHouse ? 'Designed and built by Kadjoe.' : '';
  const photography = p.photographers.length ? `Photography by ${p.photographers.join(' and ')}.` : '';
  const join = (...parts: string[]) => parts.filter(Boolean).join(' ');

  // A project in many places (the old site's venue lists) names as many as fit with its design credit.
  let text = join(lead(p.location), design);
  const places = p.location?.split(/,\s*/) ?? [];
  for (let n = places.length - 1; text.length > META_MAX && n > 0; n--) text = join(lead(`${places.slice(0, n).join(', ')}…`), design);
  if (photography && text.length + 1 + photography.length <= META_MAX) text = join(text, photography);
  return clamp(text);
}

/** Cuts at the last whole word that fits and marks the cut. */
export function clamp(text: string, max = META_MAX) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s,.;:-]+$/, '')}…`;
}
