import { describe, expect, it } from 'vitest';

import { mapNewsItemDetail, parseNewsPayload } from './news-mappers.js';

describe('news-mappers', () => {
  it('isolates invalid publication and content-block values from the news identity', () => {
    const result = mapNewsItemDetail({
      id: 'news-1',
      title: 'Meldung',
      publishedAt: 42,
      publicationDate: '2026-08-05',
      payload: {},
      contentBlocks: [{ title: 'Gültig' }, { title: 42 }],
    } as never);

    expect(result.data).toMatchObject({
      id: 'news-1',
      title: 'Meldung',
      publishedAt: '2026-08-05',
      contentBlocks: [{ title: 'Gültig', mediaContents: [] }],
    });
    expect(result.deviations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldPath: 'publishedAt', fieldGroup: 'publishedAt' }),
        expect.objectContaining({ fieldPath: 'contentBlocks[]', fieldGroup: 'contentBlocks' }),
      ])
    );
  });

  it('normalizes known payload fields without losing unknown properties', () => {
    expect(
      parseNewsPayload({
        externalUrl: 42,
        custom: { retained: true },
        wasteLocationKeys: [
          { street: 'Hauptstraße 1', zip: '12345', city: 'Musterstadt' },
          { street: 7, zip: '12345', city: 'Musterstadt' },
        ],
      })
    ).toEqual({
      externalUrl: undefined,
      custom: { retained: true },
      wasteLocationKeys: undefined,
    });
  });

  it('maps optional detail values and omits empty nested values', () => {
    const mapped = mapNewsItemDetail({
      id: 'news-2',
      payload: {},
      charactersToBeShown: '0',
      sourceUrl: { url: 'https://example.invalid/news' },
      address: { city: 'Guben' },
      dataProvider: { name: 'Redaktion' },
      settings: { displayOnlySummary: 'true' },
    } as never).data;

    expect(mapped).toMatchObject({
      charactersToBeShown: 0,
      sourceUrl: { url: 'https://example.invalid/news' },
      address: { city: 'Guben' },
      dataProvider: { name: 'Redaktion' },
      settings: { displayOnlySummary: 'true' },
    });

    const empty = mapNewsItemDetail({
      id: 'news-3',
      payload: {},
      sourceUrl: { url: '' },
      address: {},
      dataProvider: {},
      settings: {},
    } as never).data;
    for (const field of ['sourceUrl', 'address', 'dataProvider', 'settings']) {
      expect(empty).not.toHaveProperty(field);
    }
  });
});
