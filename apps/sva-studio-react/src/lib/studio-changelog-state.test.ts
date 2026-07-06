import { describe, expect, it } from 'vitest';

import { parseStudioChangelogApiEntries } from './studio-changelog-state';

describe('studio-changelog-state', () => {
  it('returns only valid changelog entries from api payloads', () => {
    expect(
      parseStudioChangelogApiEntries({
        entries: [
          { prNumber: 12, body: 'Eintrag', mergedAt: '2026-07-12T10:00:00.000Z' },
          { prNumber: 0, body: 'ungueltig', mergedAt: '2026-07-12T10:00:00.000Z' },
          { prNumber: 13, body: '', mergedAt: '2026-07-12T10:00:00.000Z' },
        ],
      })
    ).toEqual([{ prNumber: 12, body: 'Eintrag', mergedAt: '2026-07-12T10:00:00.000Z' }]);
  });

  it('returns an empty list for invalid payload shapes', () => {
    expect(parseStudioChangelogApiEntries(null)).toEqual([]);
    expect(parseStudioChangelogApiEntries({ entries: 'kaputt' })).toEqual([]);
  });
});
