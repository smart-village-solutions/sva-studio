import { describe, expect, it } from 'vitest';

import { resolvePublicWasteReadApiRoute } from './public-waste-api-routing.js';

describe('public waste API routing', () => {
  it('resolves the locations endpoint exactly', () => {
    expect(resolvePublicWasteReadApiRoute('/api/public-waste/locations')).toBe('locations');
    expect(
      resolvePublicWasteReadApiRoute(
        new URL('http://localhost/api/public-waste/locations?locale=de').pathname
      )
    ).toBe('locations');
    expect(resolvePublicWasteReadApiRoute('/api/public-waste/locations-foo')).toBeNull();
    expect(resolvePublicWasteReadApiRoute('/api/public-waste/locationsXYZ')).toBeNull();
  });

  it('keeps the existing public read routes available', () => {
    expect(resolvePublicWasteReadApiRoute('/api/public-waste/selection')).toBe('selection');
    expect(resolvePublicWasteReadApiRoute('/api/public-waste/calendar')).toBe('calendar');
    expect(resolvePublicWasteReadApiRoute('/api/public-waste/pdf')).toBe('pdf');
    expect(resolvePublicWasteReadApiRoute('/api/public-waste/ical')).toBe('ical');
  });
});
