import { describe, expect, it } from 'vitest';

import { collectEntriesForArtifact } from './generate-studio-changelog-artifact.ts';

describe('generate-studio-changelog-artifact', () => {
  it('sorts artifact entries by descending pr number and limits them to 20', () => {
    const result = collectEntriesForArtifact([
      { prNumber: 2, body: 'Zwei' },
      { prNumber: 25, body: 'Fuenfundzwanzig' },
      { prNumber: 1, body: 'Eins' },
      ...Array.from({ length: 22 }, (_, index) => ({
        prNumber: index + 3,
        body: `Eintrag ${index + 3}`,
      })),
    ]);

    expect(result).toHaveLength(20);
    expect(result[0]).toEqual({ prNumber: 25, body: 'Fuenfundzwanzig' });
    expect(result.at(-1)?.prNumber).toBe(6);
  });
});
