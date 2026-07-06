import { describe, expect, it } from 'vitest';

import { loadStudioChangelogEntries } from './studio-changelog.server';

describe('studio-changelog.server', () => {
  it('loads the newest 20 changelog entries from the generated catalog', async () => {
    const result = await loadStudioChangelogEntries({
      resolveCatalogPaths: () => ['/tmp/studio-changelog.json'],
      readCatalogFile: async () =>
        JSON.stringify({
          entries: Array.from({ length: 25 }, (_, index) => ({
            prNumber: index + 1,
            body: `Eintrag ${index + 1}`,
            mergedAt: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
          })),
        }),
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

  it('fails closed when the generated catalog contains invalid entries', async () => {
    await expect(
      loadStudioChangelogEntries({
        resolveCatalogPaths: () => ['/tmp/studio-changelog.json'],
        readCatalogFile: async () =>
          JSON.stringify({
            entries: [
              {
                prNumber: 12,
                body: '',
                mergedAt: '2026-07-12T10:00:00.000Z',
              },
            ],
          }),
      })
    ).rejects.toThrow(/ungültige Einträge/u);
  });

  it('tries fallback catalog paths before failing', async () => {
    const result = await loadStudioChangelogEntries({
      resolveCatalogPaths: () => ['/tmp/missing.json', '/tmp/studio-changelog.json'],
      readCatalogFile: async (filePath) => {
        if (filePath.endsWith('missing.json')) {
          throw Object.assign(new Error('nicht gefunden'), { code: 'ENOENT' });
        }

        return JSON.stringify({
          entries: [
            {
              prNumber: 12,
              body: 'Eintrag 12',
              mergedAt: '2026-07-12T10:00:00.000Z',
            },
          ],
        });
      },
    });

    expect(result).toEqual([
      {
        prNumber: 12,
        body: 'Eintrag 12',
        mergedAt: '2026-07-12T10:00:00.000Z',
      },
    ]);
  });

  it('supports the app-root generated fallback path', async () => {
    const result = await loadStudioChangelogEntries({
      resolveCatalogPaths: () => ['/tmp/missing.json', '/tmp/.generated/studio-changelog.json'],
      readCatalogFile: async (filePath) => {
        if (filePath.endsWith('missing.json')) {
          throw Object.assign(new Error('nicht gefunden'), { code: 'ENOENT' });
        }

        return JSON.stringify({
          entries: [
            {
              prNumber: 18,
              body: 'Eintrag 18',
              mergedAt: '2026-07-18T10:00:00.000Z',
            },
          ],
        });
      },
    });

    expect(result).toEqual([
      {
        prNumber: 18,
        body: 'Eintrag 18',
        mergedAt: '2026-07-18T10:00:00.000Z',
      },
    ]);
  });

  it('fails closed when an earlier catalog path exists but is invalid', async () => {
    await expect(
      loadStudioChangelogEntries({
        resolveCatalogPaths: () => ['/tmp/invalid.json', '/tmp/studio-changelog.json'],
        readCatalogFile: async (filePath) => {
          if (filePath.endsWith('invalid.json')) {
            return '{"entries":[{"prNumber":1,"body":"","mergedAt":"2026-07-01T10:00:00.000Z"}]}';
          }

          return JSON.stringify({
            entries: [
              {
                prNumber: 2,
                body: 'Eintrag 2',
                mergedAt: '2026-07-02T10:00:00.000Z',
              },
            ],
          });
        },
      })
    ).rejects.toThrow(/ungültige Einträge/u);
  });
});
