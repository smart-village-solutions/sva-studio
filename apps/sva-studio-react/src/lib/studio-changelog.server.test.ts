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
          })),
        }),
    });

    expect(result).toHaveLength(20);
    expect(result[0]).toEqual({
      prNumber: 25,
      body: 'Eintrag 25',
    });
    expect(result.at(-1)).toEqual({
      prNumber: 6,
      body: 'Eintrag 6',
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
            },
          ],
        });
      },
    });

    expect(result).toEqual([
      {
        prNumber: 12,
        body: 'Eintrag 12',
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
            },
          ],
        });
      },
    });

    expect(result).toEqual([
      {
        prNumber: 18,
        body: 'Eintrag 18',
      },
    ]);
  });

  it('fails closed when an earlier catalog path exists but is invalid', async () => {
    await expect(
      loadStudioChangelogEntries({
        resolveCatalogPaths: () => ['/tmp/invalid.json', '/tmp/studio-changelog.json'],
        readCatalogFile: async (filePath) => {
          if (filePath.endsWith('invalid.json')) {
            return '{"entries":[{"prNumber":1,"body":""}]}';
          }

          return JSON.stringify({
            entries: [
              {
                prNumber: 2,
                body: 'Eintrag 2',
              },
            ],
          });
        },
      })
    ).rejects.toThrow(/ungültige Einträge/u);
  });
});
