import { describe, expect, it } from 'vitest';
import { normalizeCompetenceLanguages } from './competence-languages.js';

describe('managed competence language contract', () => {
  it('trims, canonicalizes aliases and deduplicates without mutating the supplied list', () => {
    const input = [' DE-de ', 'en-us', 'de-DE', 'iw', 'he', 'zh-hant-TW'];
    expect(normalizeCompetenceLanguages(input)).toEqual(['de-DE', 'en-US', 'he', 'zh-Hant-TW']);
    expect(input).toEqual([' DE-de ', 'en-us', 'de-DE', 'iw', 'he', 'zh-hant-TW']);
  });
  it('supports explicitly clearing the managed tags', () => {
    expect(normalizeCompetenceLanguages([])).toEqual([]);
  });
  it.each([
    '',
    '  ',
    'x',
    'de_DE',
    'de--DE',
    'en-u-ca-gregory',
    'en-abcdefghi',
    'en-1234-1234',
    `en-${'abcd-'.repeat(8)}abcd`,
  ])('rejects invalid or unsupported consumer tag %j instead of silently dropping it', (tag) => {
    expect(() => normalizeCompetenceLanguages(['en', tag])).toThrow();
  });
  it('accepts the input limit and rejects overflow before deduplication', () => {
    expect(normalizeCompetenceLanguages(Array.from({ length: 40 }, () => 'de'))).toEqual(['de']);
    expect(() => normalizeCompetenceLanguages(Array.from({ length: 41 }, () => 'de'))).toThrow(
      'competence_languages_too_many'
    );
  });
});
