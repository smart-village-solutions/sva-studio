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

  it.each([
    'Vergleich: 2 < 3 und 5 > 4',
    'Ein unvollständiger Verweis <section',
    'Kontakt <redaktion@example.org>',
    'Text mit <é> bleibt normaler Inhalt',
    'Text mit <p/foo> bleibt normaler Inhalt',
    'Text mit <p/ > bleibt normaler Inhalt',
  ])('preserves non-html text containing angle brackets: %s', (body) => {
    expect(assertStudioChangelogBody('entry.json', body)).toBe(body);
  });

  it.each([
    '<p>Absatz</p>',
    'Text mit </p>',
    'Zeilenumbruch<br/>',
    '<section data-kind="notice">Hinweis</section>',
    '<x-y aria-label="Hinweis">Inhalt</x-y>',
    '<p\nclass="notice">Inhalt</p>',
    '<p / >',
    'Text <<p>>',
    '<ſ>Unicode-Faltung</ſ>',
    '<K>Unicode-Faltung</K>',
  ])('rejects raw-html tag syntax: %s', (body) => {
    expect(() => assertStudioChangelogBody('entry.json', body)).toThrow(/rohes HTML/);
  });

  it('handles very long and adversarially shaped non-html text', () => {
    const longPlainText = `Hinweis ${'inhalt '.repeat(30_000)}<section ${'attribut '.repeat(30_000)}Ende`;
    const manyIncompleteCandidates = `${'<a attribut '.repeat(20_000)}Ende`;

    expect(assertStudioChangelogBody('entry.json', longPlainText)).toBe(longPlainText);
    expect(assertStudioChangelogBody('entry.json', manyIncompleteCandidates)).toBe(manyIncompleteCandidates);
  });

  it('rejects empty bodies', () => {
    expect(() => assertStudioChangelogBody('entry.json', '   ')).toThrow(/nicht leer/);
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
