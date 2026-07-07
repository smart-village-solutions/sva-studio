import { describe, expect, it } from 'vitest';

import { parseStudioChangelogApiEntries } from './studio-changelog-state';

describe('studio-changelog-state', () => {
  it('returns only valid changelog entries from api payloads', () => {
    expect(
      parseStudioChangelogApiEntries({
        entries: [
          { prNumber: 12, body: 'Eintrag' },
          { prNumber: 0, body: 'ungueltig' },
          { prNumber: 13, body: '' },
        ],
      })
    ).toEqual([{ prNumber: 12, body: 'Eintrag' }]);
  });

  it('returns an empty list for invalid payload shapes', () => {
    expect(parseStudioChangelogApiEntries(null)).toEqual([]);
    expect(parseStudioChangelogApiEntries({ entries: 'kaputt' })).toEqual([]);
  });
});
