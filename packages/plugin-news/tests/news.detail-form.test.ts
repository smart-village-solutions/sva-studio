import { zodResolver } from '@hookform/resolvers/zod';
import { describe, expect, it } from 'vitest';

import type { NewsContentItem } from '../src/news.types.js';
import {
  buildNewsDetailCharacterCounts,
  deriveDirtyNewsDetailTabs,
  mapNewsItemToDetailFormValues,
  newsDetailFormSchema,
} from '../src/news.detail-form.js';

const sampleItem: NewsContentItem = {
  id: 'news-1',
  title: 'Rathaus informiert',
  contentType: 'news',
  payload: {
    teaser: 'Kurzer Einstieg',
    body: '<p>Ausführlicher Inhalt</p>',
    category: 'Stadt',
    externalUrl: 'https://example.org/news',
  },
  status: 'published',
  author: 'Redaktion',
  externalId: 'ext-42',
  fullVersion: true,
  charactersToBeShown: 180,
  newsType: 'meldung',
  publicationDate: '2026-05-24T08:00:00.000Z',
  publishedAt: '2026-05-24T09:00:00.000Z',
  showPublishDate: true,
  categoryName: 'Stadt',
  categories: [{ name: 'Stadt' }, { name: 'Verwaltung' }],
  sourceUrl: { url: 'https://example.org/news', description: 'Quelle' },
  address: {
    street: 'Marktplatz 1',
    zip: '12345',
    city: 'Musterstadt',
  },
  contentBlocks: [
    {
      title: 'Abschnitt 1',
      intro: 'Kurzer Einstieg',
      body: '<p>Ausführlicher Inhalt</p>',
      mediaContents: [{ sourceUrl: { url: 'https://example.org/image.jpg' } }],
    },
  ],
  pointOfInterestId: 'poi-1',
  createdAt: '2026-05-20T09:00:00.000Z',
  updatedAt: '2026-05-22T09:00:00.000Z',
};

describe('news.detail-form', () => {
  it('maps a NewsContentItem into default tabbed form values', () => {
    expect(mapNewsItemToDetailFormValues(sampleItem)).toMatchObject({
      title: 'Rathaus informiert',
      author: 'Redaktion',
      categoryName: 'Stadt',
      categoriesText: 'Stadt\nVerwaltung',
      publishedAt: '2026-05-24T09:00:00.000Z',
      publicationDate: '2026-05-24T08:00:00.000Z',
      externalId: 'ext-42',
      newsType: 'meldung',
      charactersToBeShown: '180',
      fullVersion: true,
      showPublishDate: true,
      sourceUrl: { url: 'https://example.org/news', description: 'Quelle' },
      address: { street: 'Marktplatz 1', zip: '12345', city: 'Musterstadt' },
      pointOfInterestId: 'poi-1',
      contentBlocks: [
        expect.objectContaining({
          title: 'Abschnitt 1',
          intro: 'Kurzer Einstieg',
          body: '<p>Ausführlicher Inhalt</p>',
        }),
      ],
    });
  });

  it('rejects invalid publishedAt values through the resolver schema', async () => {
    const resolver = zodResolver(newsDetailFormSchema);
    const result = await resolver(
      {
        ...mapNewsItemToDetailFormValues(sampleItem),
        publishedAt: 'kein-datum',
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    );

    expect(result.errors.publishedAt?.message).toBeTruthy();
  });

  it('requires a body in at least one content block', async () => {
    const resolver = zodResolver(newsDetailFormSchema);
    const result = await resolver(
      {
        ...mapNewsItemToDetailFormValues(sampleItem),
        contentBlocks: [
          {
            title: 'Leer',
            intro: 'Noch ohne Inhalt',
            body: '   ',
            mediaContents: [],
          },
        ],
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    );

    expect(result.errors.contentBlocks?.message).toBeTruthy();
  });

  it('derives changed field groups for basis versus content tabs', () => {
    expect(
      deriveDirtyNewsDetailTabs({
        title: true,
        categoriesText: true,
        contentBlocks: [{ intro: true }],
        sourceUrl: { url: true },
      })
    ).toEqual({
      basis: true,
      content: true,
      release: false,
      history: false,
    });
  });

  it('builds live character metrics for title, intro, and body fields', () => {
    expect(
      buildNewsDetailCharacterCounts({
        title: 'Titel',
        contentBlocks: [
          {
            title: '',
            intro: 'Kurztext',
            body: '<p>Hallo <strong>Welt</strong></p>',
            mediaContents: [],
          },
        ],
      })
    ).toEqual({
      title: 5,
      intros: [8],
      bodies: [10],
    });
  });
});
