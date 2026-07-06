import { describe, expect, it } from 'vitest';

import {
  collectStudioChangelogEntries,
  validateStudioChangelogPullRequest,
  validateStudioChangelogRepository,
} from './check-studio-changelog.ts';

describe('check-studio-changelog', () => {
  it('accepts a pull request with exactly one valid changelog entry', () => {
    const changedFiles = [
      'docs/changelog/entries/pr-412.json',
      'apps/sva-studio-react/src/routes/-home-page.tsx',
    ];

    const result = validateStudioChangelogPullRequest({
      changedFiles,
      expectedPrNumber: 412,
      readFile: (filePath) => {
        if (filePath === 'docs/changelog/entries/pr-412.json') {
          return JSON.stringify({
            prNumber: 412,
            body: 'Allgemeine Verbesserungen\n\n- Stabilere Speicherung',
          });
        }

        throw new Error(`unexpected file read: ${filePath}`);
      },
    });

    expect(result).toEqual({
      entryPath: 'docs/changelog/entries/pr-412.json',
      entry: {
        prNumber: 412,
        body: 'Allgemeine Verbesserungen\n\n- Stabilere Speicherung',
      },
    });
  });

  it('rejects pull requests without a changelog entry', () => {
    expect(() =>
      validateStudioChangelogPullRequest({
        changedFiles: ['apps/sva-studio-react/src/routes/-home-page.tsx'],
        expectedPrNumber: 412,
        readFile: () => {
          throw new Error('should not read files');
        },
      })
    ).toThrow(/genau eine Changelog-Datei/);
  });

  it('rejects pull requests with more than one changelog entry', () => {
    expect(() =>
      validateStudioChangelogPullRequest({
        changedFiles: [
          'docs/changelog/entries/pr-412.json',
          'docs/changelog/entries/pr-413.json',
        ],
        expectedPrNumber: 412,
        readFile: () =>
          JSON.stringify({
            prNumber: 412,
            body: 'Allgemeine Verbesserungen',
          }),
      })
    ).toThrow(/genau eine Changelog-Datei/);
  });

  it('rejects entries with an empty body', () => {
    expect(() =>
      validateStudioChangelogPullRequest({
        changedFiles: ['docs/changelog/entries/pr-412.json'],
        expectedPrNumber: 412,
        readFile: () =>
          JSON.stringify({
            prNumber: 412,
            body: '   ',
          }),
      })
    ).toThrow(/body.*nicht leer/);
  });

  it('rejects entries whose file name does not match the pr number', () => {
    expect(() =>
      validateStudioChangelogPullRequest({
        changedFiles: ['docs/changelog/entries/pr-999.json'],
        expectedPrNumber: 412,
        readFile: () =>
          JSON.stringify({
            prNumber: 412,
            body: 'Allgemeine Verbesserungen',
          }),
      })
    ).toThrow(/Dateiname/);
  });

  it('collects repository entries with deterministic merged timestamps', () => {
    const result = collectStudioChangelogEntries({
      entryFiles: [
        'docs/changelog/entries/pr-2.json',
        'docs/changelog/entries/pr-1.json',
      ],
      readFile: (filePath) =>
        JSON.stringify({
          prNumber: filePath.endsWith('pr-2.json') ? 2 : 1,
          body: `Eintrag fuer ${filePath}`,
        }),
      readMergedAt: (filePath) =>
        filePath.endsWith('pr-2.json') ? '2026-07-07T10:00:00.000Z' : '2026-07-06T10:00:00.000Z',
    });

    expect(result).toEqual([
      {
        prNumber: 2,
        body: 'Eintrag fuer docs/changelog/entries/pr-2.json',
        mergedAt: '2026-07-07T10:00:00.000Z',
      },
      {
        prNumber: 1,
        body: 'Eintrag fuer docs/changelog/entries/pr-1.json',
        mergedAt: '2026-07-06T10:00:00.000Z',
      },
    ]);
  });

  it('limits collected repository entries to the newest 20 items', () => {
    const entryFiles = Array.from({ length: 25 }, (_, index) => `docs/changelog/entries/pr-${index + 1}.json`);

    const result = collectStudioChangelogEntries({
      entryFiles,
      readFile: (filePath) => {
        const prNumber = Number(filePath.match(/pr-(\d+)\.json$/u)?.[1]);
        return JSON.stringify({ prNumber, body: `Eintrag ${prNumber}` });
      },
      readMergedAt: (filePath) => {
        const prNumber = Number(filePath.match(/pr-(\d+)\.json$/u)?.[1]);
        return `2026-07-${String(prNumber).padStart(2, '0')}T10:00:00.000Z`;
      },
    });

    expect(result).toHaveLength(20);
    expect(result[0]?.prNumber).toBe(25);
    expect(result.at(-1)?.prNumber).toBe(6);
  });

  it('rejects repository entries with duplicate pr numbers', () => {
    expect(() =>
      validateStudioChangelogRepository({
        entryFiles: [
          'docs/changelog/entries/pr-1.json',
          'docs/changelog/entries/pr-1.json',
        ],
        readFile: () =>
          JSON.stringify({
            prNumber: 1,
            body: 'Allgemeine Verbesserungen',
          }),
        readMergedAt: () => '2026-07-06T10:00:00.000Z',
      })
    ).toThrow(/Duplicate/);
  });
});
