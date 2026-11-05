// Case page meta descriptions are built from database fields and must stay within 160 characters:
// the facts first (name, place, category, year), then the design credit, then photography.
import { describe, expect, it } from 'vitest';
import { caseDescription } from '@/lib/meta';

const peggys = {
  name: "Peggy's Brass Knuckles", location: 'Mahakam, Jakarta', category: 'F&B', year: '2024',
  design: 'A-A Practice and Romy & Rama Dwiwahyu', inHouse: false, photographers: ['Leowardi Studio'],
};

describe('caseDescription', () => {
  it('keeps every fact of a short project', () => {
    expect(caseDescription({ ...peggys, name: 'Sonn', location: 'Maggiore Junction', design: 'Andre Luki' }))
      .toBe('Sonn, Maggiore Junction: an F&B project built by Kadjoe (2024). Designed by Andre Luki. Photography by Leowardi Studio.');
  });

  it("drops the photography credit before going over 160 characters (Peggy's Brass Knuckles)", () => {
    const d = caseDescription(peggys);
    expect(d).toBe("Peggy's Brass Knuckles, Mahakam, Jakarta: an F&B project built by Kadjoe (2024). Designed by A-A Practice and Romy & Rama Dwiwahyu.");
    expect(d.length).toBeLessThanOrEqual(160);
  });

  it('lists as many venues as fit and keeps the facts (Saladbar)', () => {
    const d = caseDescription({
      name: 'Saladbar by Hadi Kitchen', category: 'F&B', year: '2019-2021', design: 'Pensil Kayu', inHouse: false, photographers: [],
      location: 'Neo Soho, PVJ Bandung, Lippo Mall Kemang, Citra Garden 6, Sun Plaza Medan, Mall Kelapa Gading, Supermall Karawaci, Lippo Mall Puri, PIM 3',
    });
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d).toMatch(/^Saladbar by Hadi Kitchen, Neo Soho, PVJ Bandung, .*…: an F&B project built by Kadjoe \(2019-2021\)\. Designed by Pensil Kayu\.$/);
  });

  it('says in-house work is designed and built by Kadjoe', () => {
    expect(caseDescription({ ...peggys, design: 'Kadjoe', inHouse: true, photographers: [] }))
      .toBe("Peggy's Brass Knuckles, Mahakam, Jakarta: an F&B project built by Kadjoe (2024). Designed and built by Kadjoe.");
  });

  it('never goes over 160 characters, cutting at a word', () => {
    const d = caseDescription({ ...peggys, name: 'A very long project name '.repeat(10).trim(), location: null });
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.endsWith('…')).toBe(true);
    expect(d).not.toMatch(/\s…$/);
  });
});
