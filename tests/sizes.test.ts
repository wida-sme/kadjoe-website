// `sizes` for photographs cropped into a frame (object-fit: cover). A landscape photograph in a
// portrait frame is drawn wider than the frame, so the browser must be told the drawn width or it
// picks a file that is upscaled on screen.
import { describe, expect, it } from 'vitest';
import { cellSizes, coverWidth, wallSizes } from '@/lib/sizes';

const landscape = { width: 1500, height: 1000 }; // 3:2
const portrait = { width: 1000, height: 1250 }; // 4:5

describe('coverWidth', () => {
  it('widens a landscape photograph cropped into a portrait frame', () => {
    expect(coverWidth(landscape, 4 / 5, '31vw')).toBe('calc(31vw * 1.88)');
  });

  it('keeps the frame width when the photograph is no wider than the frame', () => {
    expect(coverWidth(landscape, 3 / 2, '56vw')).toBe('56vw');
    expect(coverWidth(portrait, 3 / 2, '56vw')).toBe('56vw');
    expect(coverWidth(portrait, 4 / 5, '31vw')).toBe('31vw');
  });

  it('accepts a pixel width', () => {
    expect(coverWidth(landscape, 4 / 5, '220px')).toBe('calc(220px * 1.88)');
  });
});

describe('wallSizes', () => {
  it('follows the six-photograph cycle of the wall: phone, then the slot on the 12-column grid', () => {
    expect(wallSizes(landscape, 0)).toBe('(max-width: 767px) 100vw, 56vw');
    expect(wallSizes(landscape, 1)).toBe('(max-width: 767px) calc(70vw * 1.88), calc(31vw * 1.88)');
    expect(wallSizes(portrait, 7)).toBe('(max-width: 767px) 70vw, 31vw');
  });

  it('uses the two-column phone grid of the projects index when asked', () => {
    expect(wallSizes(landscape, 0, { phone: 'pair' })).toBe('(max-width: 767px) calc(46vw * 1.88), 56vw');
  });
});

describe('cellSizes (case page gallery)', () => {
  it('sizes a full-width landscape to the sheet, less the margins', () => {
    expect(cellSizes('full')).toBe('(max-width: 767px) calc(100vw - 32px), calc(100vw - 64px)');
  });

  it('sizes inset rows to three quarters of the sheet on desktop and the full width on phones', () => {
    expect(cellSizes('right')).toBe('(max-width: 767px) calc(100vw - 32px), calc((100vw - 64px) * 0.75)');
    expect(cellSizes('left')).toBe(cellSizes('right'));
  });

  it('sizes a lone portrait to half the sheet (82% on phones)', () => {
    expect(cellSizes('solo-left')).toBe('(max-width: 767px) calc((100vw - 32px) * 0.82), calc((100vw - 64px) * 0.5)');
  });

  it('sizes each photograph of a pair by its share of the row', () => {
    expect(cellSizes('pair', 0.545)).toBe('(max-width: 767px) calc((100vw - 32px) * 0.55), calc((100vw - 64px) * 0.55)');
  });
});
