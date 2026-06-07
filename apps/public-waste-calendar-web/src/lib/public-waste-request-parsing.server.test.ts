import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readPublicWasteReferenceDate } from './public-waste-request-parsing.server.js';

describe('public waste request parsing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T12:00:00.000Z'));
  });

  it('falls back to the current date when referenceDate is missing or blank and trims valid values', () => {
    expect(readPublicWasteReferenceDate(new URL('https://example.test/public-waste'))).toBe('2026-06-07');
    expect(readPublicWasteReferenceDate(new URL('https://example.test/public-waste?referenceDate='))).toBe('2026-06-07');
    expect(readPublicWasteReferenceDate(new URL('https://example.test/public-waste?referenceDate=%20%202026-01-01%20'))).toBe(
      '2026-01-01'
    );
  });
});
