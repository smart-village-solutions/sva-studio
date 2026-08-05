import { describe, expect, it } from 'vitest';

import { mapNewsItemDetail } from './news-mappers.js';

describe('news-mappers', () => {
  it('isolates invalid publication and content-block values from the news identity', () => {
    const result = mapNewsItemDetail({
      id: 'news-1',
      title: 'Meldung',
      publishedAt: 42,
      publicationDate: '2026-08-05',
      payload: { teaser: 'Kurz', body: 'Lang' },
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
});
