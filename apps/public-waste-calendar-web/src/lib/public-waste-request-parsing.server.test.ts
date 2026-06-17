import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readPublicWasteReferenceDate, readPublicWasteReminderItems } from './public-waste-request-parsing.server.js';

describe('public waste request parsing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T12:00:00.000Z'));
  });

  it('falls back to the current date when referenceDate is missing or blank and normalizes valid values', () => {
    expect(readPublicWasteReferenceDate(new URL('https://example.test/public-waste'))).toBe('2026-06-07');
    expect(readPublicWasteReferenceDate(new URL('https://example.test/public-waste?referenceDate='))).toBe('2026-06-07');
    expect(readPublicWasteReferenceDate(new URL('https://example.test/public-waste?referenceDate=%20%202026-01-01%20'))).toBe(
      '2026-01-01'
    );
    expect(readPublicWasteReferenceDate(new URL('https://example.test/public-waste?referenceDate=2026-01-01T15:30:00Z'))).toBe(
      '2026-01-01'
    );
  });

  it('falls back to the current date when referenceDate cannot be normalized to a date-only value', () => {
    expect(readPublicWasteReferenceDate(new URL('https://example.test/public-waste?referenceDate=not-a-date'))).toBe(
      '2026-06-07'
    );
  });

  it('parses reminder items for calendar exports', () => {
    expect(
      readPublicWasteReminderItems(
        new URL('https://example.test/public-waste?reminderItem=bio|bio:calendar:first&reminderItem=paper|paper:calendar:first')
      )
    ).toEqual([
      { fractionId: 'bio', slotId: 'bio:calendar:first' },
      { fractionId: 'paper', slotId: 'paper:calendar:first' },
    ]);
  });
});
