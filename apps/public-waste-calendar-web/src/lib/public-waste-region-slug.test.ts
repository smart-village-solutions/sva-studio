import { describe, expect, it } from 'vitest';

import {
  normalizePublicWasteRegionSlug,
  toPublicWasteRegionSlug,
} from './public-waste-region-slug.js';

describe('public waste region slugs', () => {
  it('creates readable German URL slugs', () => {
    expect(toPublicWasteRegionSlug('Amt Bad Wilsnack/Weisen')).toBe('amt-bad-wilsnack-weisen');
    expect(toPublicWasteRegionSlug('Ämter für Groß Pankow')).toBe('aemter-fuer-gross-pankow');
    expect(toPublicWasteRegionSlug('A\u0308mter fu\u0308r Groß Pankow')).toBe(
      'aemter-fuer-gross-pankow'
    );
  });

  it('accepts only canonical path-safe slugs', () => {
    expect(normalizePublicWasteRegionSlug('Amt-Bad-Wilsnack')).toBe('amt-bad-wilsnack');
    expect(normalizePublicWasteRegionSlug('amt--bad-wilsnack')).toBeNull();
    expect(normalizePublicWasteRegionSlug('../amt-bad-wilsnack')).toBeNull();
    expect(normalizePublicWasteRegionSlug('')).toBeNull();
  });
});
