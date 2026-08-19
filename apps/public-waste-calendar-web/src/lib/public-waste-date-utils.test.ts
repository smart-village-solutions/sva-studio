import { describe, expect, it } from 'vitest';

import { formatDateOnlyGerman } from './public-waste-date-utils.js';

describe('formatDateOnlyGerman', () => {
  it('formats a normalized date without converting its calendar day', () => {
    expect(formatDateOnlyGerman('2026-05-18')).toBe('18.05.2026');
  });

  it('renders an unavailable marker instead of a raw malformed date', () => {
    expect(formatDateOnlyGerman('not-a-date')).toBe('—');
  });
});
