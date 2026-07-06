import { describe, expect, it } from 'vitest';

import { loadStudioChangelogEntries } from './studio-changelog.server';

describe('studio-changelog.server', () => {
  it('loads the newest 20 changelog entries in reverse chronological order', async () => {
    const entryFiles = Array.from({ length: 25 }, (_, index) => `docs/changelog/entries/pr-${index + 1}.json`);

    const result = await loadStudioChangelogEntries({
      listEntryFiles: async () => entryFiles,
      readEntryFile: async (filePath) => {
        const prNumber = Number(filePath.match(/pr-(\d+)\.json$/u)?.[1]);
        return JSON.stringify({
          prNumber,
          body: `Eintrag ${prNumber}`,
        });
      },
      readMergedAt: async (filePath) => {
        const prNumber = Number(filePath.match(/pr-(\d+)\.json$/u)?.[1]);
        return `2026-07-${String(prNumber).padStart(2, '0')}T10:00:00.000Z`;
      },
    });

    expect(result).toHaveLength(20);
    expect(result[0]).toEqual({
      prNumber: 25,
      body: 'Eintrag 25',
      mergedAt: '2026-07-25T10:00:00.000Z',
    });
    expect(result.at(-1)).toEqual({
      prNumber: 6,
      body: 'Eintrag 6',
      mergedAt: '2026-07-06T10:00:00.000Z',
    });
  });

  it('fails closed when an entry contains raw html', async () => {
    await expect(
      loadStudioChangelogEntries({
        listEntryFiles: async () => ['docs/changelog/entries/pr-12.json'],
        readEntryFile: async () =>
          JSON.stringify({
            prNumber: 12,
            body: '<script>alert(1)</script>',
          }),
        readMergedAt: async () => '2026-07-12T10:00:00.000Z',
      })
    ).rejects.toThrow(/raw html|HTML/u);
  });
});
