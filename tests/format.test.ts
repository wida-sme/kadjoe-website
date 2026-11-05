// Address lines are shown as written in the finance app; a block and house number never break apart.
import { describe, expect, it } from 'vitest';
import { addressLine } from '@/lib/format';

const NBSP = ' ';

describe('addressLine', () => {
  it('keeps "Blok C8 No.2" on one line', () => {
    expect(addressLine('Jl. Perumahan Kalideres Permai Blok C8 No.2')).toBe(`Jl. Perumahan Kalideres Permai Blok${NBSP}C8${NBSP}No.2`);
  });

  it('keeps a spaced house number with its label', () => {
    expect(addressLine('Jl. Kemang Raya No. 12')).toBe(`Jl. Kemang Raya${NBSP}No.${NBSP}12`);
  });

  it('leaves lines without block or house numbers alone', () => {
    expect(addressLine('Kalideres, Jakarta Barat')).toBe('Kalideres, Jakarta Barat');
    expect(addressLine('DKI Jakarta 11840')).toBe('DKI Jakarta 11840');
  });
});
