import { describe, expect, it } from 'vitest';

import {
  compareProjectionRows,
  type ProjectionRow,
} from './iam-content-list-projection-model.server.js';

describe('content list projection model', () => {
  it('sorts supported projection fields with nulls last and an ascending id tie-breaker', () => {
    const row = (
      id: string,
      overrides: Partial<
        Pick<ProjectionRow, 'title' | 'created_at' | 'updated_at' | 'published_at'>
      > = {}
    ) => ({
      id,
      title: 'Gleich',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      published_at: null,
      ...overrides,
    });

    expect(
      [
        row('b', { published_at: null }),
        row('c', { published_at: '2026-02-01T00:00:00.000Z' }),
        row('a', { published_at: '2026-02-01T00:00:00.000Z' }),
      ]
        .sort((left, right) => compareProjectionRows(left, right, 'publishedAt', 'desc'))
        .map(({ id }) => id)
    ).toEqual(['a', 'c', 'b']);
    expect(
      [row('b'), row('a')]
        .sort((left, right) => compareProjectionRows(left, right, 'title', 'desc'))
        .map(({ id }) => id)
    ).toEqual(['a', 'b']);
    expect(compareProjectionRows(row('a'), row('b'), 'publishedAt', 'desc')).toBeLessThan(0);
    expect(compareProjectionRows(row('b'), row('a'), 'publishedAt', 'desc')).toBeGreaterThan(0);
  });

  describe('title order', () => {
    const titled = (id: string, title: string) => ({
      id,
      title,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      published_at: null,
    });
    const sortTitles = (titles: readonly string[], direction: 'asc' | 'desc' = 'asc') =>
      titles
        .map((title, index) => titled(`id-${index}`, title))
        .sort((left, right) => compareProjectionRows(left, right, 'title', direction))
        .map(({ title }) => title);

    it('ignores leading straight and typographic quotation marks', () => {
      expect(
        sortTitles([
          '„IM OSTEN – Geschichten aus der Sonderzone“',
          '"Zirkus"',
          "'Abend' am See",
          '‚Kleine‘ Bühne',
          '«Kino»',
          'Flohmarkt von A–Z',
        ])
      ).toEqual([
        "'Abend' am See",
        'Flohmarkt von A–Z',
        '„IM OSTEN – Geschichten aus der Sonderzone“',
        '«Kino»',
        '‚Kleine‘ Bühne',
        '"Zirkus"',
      ]);
    });

    it('sorts umlauts like their base letter, plain letter first on otherwise equal titles, and numbers by value', () => {
      expect(
        sortTitles([
          'Azur',
          'Äther',
          'Arzt',
          'Äpfelfest',
          'Apfelfest',
          'Ärger',
          'Ozean',
          'Öko-Markt',
          'Ostern',
          'Tag 10',
          'Tag 2',
        ])
      ).toEqual([
        'Apfelfest',
        'Äpfelfest',
        'Ärger',
        'Arzt',
        'Äther',
        'Azur',
        'Öko-Markt',
        'Ostern',
        'Ozean',
        'Tag 2',
        'Tag 10',
      ]);
    });

    it('ignores leading symbols, emoji and invisible format characters', () => {
      expect(
        sortTitles([
          'Zoo',
          '+++ Eilmeldung +++',
          '🎄 Weihnachtsmarkt',
          '★ Sternfahrt',
          '​„Kino“',
          'Apfel',
          '⚠️ Achtung',
          '❤️ Herz',
          '☀️ Sommerfest',
        ])
      ).toEqual([
        '⚠️ Achtung',
        'Apfel',
        '+++ Eilmeldung +++',
        '❤️ Herz',
        '​„Kino“',
        '☀️ Sommerfest',
        '★ Sternfahrt',
        '🎄 Weihnachtsmarkt',
        'Zoo',
      ]);
    });

    it('ignores case and breaks the tie by id in both directions', () => {
      const ordered = (direction: 'asc' | 'desc') =>
        [titled('b', 'apfelfest'), titled('a', 'Apfelfest'), titled('c', 'Birne')]
          .sort((left, right) => compareProjectionRows(left, right, 'title', direction))
          .map(({ id }) => id);

      expect(ordered('asc')).toEqual(['a', 'b', 'c']);
      expect(ordered('desc')).toEqual(['c', 'a', 'b']);
    });

    it('reverses the order for descending sorting and places empty titles first ascending', () => {
      expect(sortTitles(['Zoo', '', '„Apfel“', '…'])).toEqual(['', '…', '„Apfel“', 'Zoo']);
      expect(sortTitles(['Zoo', '', '„Apfel“'], 'desc')).toEqual(['Zoo', '„Apfel“', '']);
    });

    it('breaks ties between titles that differ only in leading punctuation by id', () => {
      const ordered = (direction: 'asc' | 'desc') =>
        [titled('b', '„Kino'), titled('a', 'Kino')]
          .sort((left, right) => compareProjectionRows(left, right, 'title', direction))
          .map(({ id }) => id);

      expect(ordered('asc')).toEqual(['a', 'b']);
      expect(ordered('desc')).toEqual(['a', 'b']);
    });
  });
});
