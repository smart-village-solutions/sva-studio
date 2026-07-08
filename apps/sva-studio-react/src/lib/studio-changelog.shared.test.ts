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
    expect(() => parseStudioChangelogEntryDocument('entry.json', '{')).toThrow(/enthält kein gültiges JSON/u);
  });

  it('sorts changelog entries by descending pr number', () => {
    const entries = [
      { prNumber: 2, body: 'B' },
      { prNumber: 1, body: 'A' },
      { prNumber: 3, body: 'C' },
    ];

    expect(entries.sort(compareStudioChangelogEntriesDescending).map((entry) => entry.prNumber)).toEqual([3, 2, 1]);
  });

  it('recognizes valid catalog entries strictly', () => {
    expect(isStudioChangelogEntry({ prNumber: 12, body: 'Eintrag' })).toBe(true);
    expect(isStudioChangelogEntry({ prNumber: 0, body: 'Eintrag' })).toBe(false);
    expect(isStudioChangelogEntry({ prNumber: 12, body: '' })).toBe(false);
    expect(isStudioChangelogEntry({ prNumber: '12', body: 'Eintrag' })).toBe(false);
  });
});
