import { describe, expect, it } from 'vitest';

import {
  assertStudioChangelogBody,
  compareStudioChangelogEntriesDescending,
  isStudioChangelogEntry,
  parseStudioChangelogEntryDocument,
  parseStudioChangelogEntryPathPrNumber,
} from './studio-changelog.shared';

describe('studio-changelog.shared', () => {
  it('parses the pr number from a valid changelog path', () => {
    expect(parseStudioChangelogEntryPathPrNumber('docs/changelog/entries/pr-412.json')).toBe(412);
  });

  it('rejects invalid changelog paths', () => {
    expect(() => parseStudioChangelogEntryPathPrNumber('docs/changelog/pr-412.json')).toThrow(/erwarteten Format/);
  });

  it('trims and validates changelog bodies', () => {
    expect(assertStudioChangelogBody('entry.json', '  Nutzertext  ')).toBe('Nutzertext');
  });

  it('rejects empty or raw-html bodies', () => {
    expect(() => assertStudioChangelogBody('entry.json', '   ')).toThrow(/nicht leer/);
    expect(() => assertStudioChangelogBody('entry.json', 'Text mit </p>')).toThrow(/rohes HTML/);
  });

  it('parses valid entry documents', () => {
    expect(
      parseStudioChangelogEntryDocument(
        'docs/changelog/entries/pr-412.json',
        JSON.stringify({ prNumber: 412, body: 'Eintrag' })
      )
    ).toEqual({
      prNumber: 412,
      body: 'Eintrag',
    });
  });

  it('rejects invalid entry documents', () => {
    expect(() => parseStudioChangelogEntryDocument('entry.json', '{"prNumber":0,"body":"Eintrag"}')).toThrow(
      /positives Integer-Feld/
    );
    expect(() => parseStudioChangelogEntryDocument('entry.json', '[]')).toThrow(/JSON-Objekt/);
  });

  it('sorts changelog entries by parsed merged timestamp and pr tie-breaker', () => {
    const entries = [
      { prNumber: 2, body: 'B', mergedAt: '2026-07-06T16:57:00+02:00' },
      { prNumber: 1, body: 'A', mergedAt: '2026-07-06T15:30:00Z' },
      { prNumber: 3, body: 'C', mergedAt: '2026-07-06T15:30:00Z' },
    ];

    expect(entries.sort(compareStudioChangelogEntriesDescending).map((entry) => entry.prNumber)).toEqual([3, 1, 2]);
  });

  it('recognizes valid catalog entries strictly', () => {
    expect(isStudioChangelogEntry({ prNumber: 12, body: 'Eintrag', mergedAt: '2026-07-12T10:00:00.000Z' })).toBe(
      true
    );
    expect(isStudioChangelogEntry({ prNumber: 0, body: 'Eintrag', mergedAt: '2026-07-12T10:00:00.000Z' })).toBe(
      false
    );
    expect(isStudioChangelogEntry({ prNumber: 12, body: '', mergedAt: '2026-07-12T10:00:00.000Z' })).toBe(false);
    expect(isStudioChangelogEntry({ prNumber: 12, body: 'Eintrag', mergedAt: 'kaputt' })).toBe(false);
  });
});
