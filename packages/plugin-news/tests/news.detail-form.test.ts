import { zodResolver } from '@hookform/resolvers/zod';
import { describe, expect, it } from 'vitest';

import type { NewsContentItem } from '../src/news.types.js';
import {
  createDefaultNewsDetailFormValues,
  buildNewsDetailCharacterCounts,
  deriveDirtyNewsDetailTabs,
  mapNewsDetailFormValuesToMutation,
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
      categories: ['Stadt', 'Verwaltung'],
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

  it('provides stable default values for create mode', () => {
    expect(createDefaultNewsDetailFormValues()).toEqual({
      title: '',
      author: '',
      keywords: '',
      categories: [],
      publishedAt: '',
      publicationDate: '',
      externalId: '',
      newsType: '',
      charactersToBeShown: '',
      fullVersion: false,
      showPublishDate: true,
      pushNotification: false,
      teaserImageAssetId: null,
      headerImageAssetId: null,
      contentBlocks: [{ title: '', intro: '', body: '', mediaContents: [] }],
      sourceUrl: { url: '', description: '' },
      address: { street: '', zip: '', city: '' },
      pointOfInterestId: '',
    });
  });

  it('falls back to payload-derived content when structured content blocks are missing', () => {
    expect(
      mapNewsItemToDetailFormValues({
        ...sampleItem,
        title: ' ',
        categories: [],
        contentBlocks: undefined,
        payload: {
          ...sampleItem.payload,
          teaser: 'Fallback teaser',
          body: '<p>Fallback body</p>',
          category: 'Fallback Kategorie',
          imageUrl: 'https://example.org/fallback.jpg',
        },
      })
    ).toMatchObject({
      title: ' ',
      categories: ['Fallback Kategorie'],
      sourceUrl: {
        url: 'https://example.org/news',
        description: 'Quelle',
      },
      contentBlocks: [
        {
          title: '',
          intro: 'Fallback teaser',
          body: '<p>Fallback body</p>',
          mediaContents: [
            expect.objectContaining({
              sourceUrl: { url: 'https://example.org/fallback.jpg' },
            }),
          ],
        },
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

  it('rejects invalid publication dates and negative character limits', async () => {
    const resolver = zodResolver(newsDetailFormSchema);
    const result = await resolver(
      {
        ...mapNewsItemToDetailFormValues(sampleItem),
        publicationDate: 'ungueltig',
        charactersToBeShown: '-1',
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    );

    expect(result.errors.publicationDate?.message).toBeTruthy();
    expect(result.errors.charactersToBeShown?.message).toBeTruthy();
  });

  it('rejects empty content blocks and oversized bodies', async () => {
    const resolver = zodResolver(newsDetailFormSchema);
    const emptyBlocksResult = await resolver(
      {
        ...mapNewsItemToDetailFormValues(sampleItem),
        contentBlocks: [],
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    );
    const oversizedBodyResult = await resolver(
      {
        ...mapNewsItemToDetailFormValues(sampleItem),
        contentBlocks: [
          {
            title: 'Lang',
            intro: '',
            body: 'A'.repeat(50_001),
            mediaContents: [],
          },
        ],
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    );

    expect(emptyBlocksResult.errors.contentBlocks?.message).toBeTruthy();
    expect(oversizedBodyResult.errors.contentBlocks?.message).toBeTruthy();
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

  it('rejects non-https source URLs and media URLs', async () => {
    const resolver = zodResolver(newsDetailFormSchema);
    const result = await resolver(
      {
        ...mapNewsItemToDetailFormValues(sampleItem),
        sourceUrl: {
          url: 'http://example.org/news',
          description: 'Quelle',
        },
        contentBlocks: [
          {
            title: 'Abschnitt 1',
            intro: 'Kurzer Einstieg',
            body: '<p>Ausführlicher Inhalt</p>',
            mediaContents: [
              {
                captionText: '',
                copyright: '',
                contentType: 'image',
                height: '',
                width: '',
                sourceUrl: {
                  url: 'http://example.org/image.jpg',
                  description: '',
                },
              },
            ],
          },
        ],
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    );

    expect(result.errors.sourceUrl?.url?.message).toBeTruthy();
    expect(result.errors.contentBlocks?.message).toBeTruthy();
  });

  it('rejects categories longer than the allowed limit', async () => {
    const resolver = zodResolver(newsDetailFormSchema);
    const result = await resolver(
      {
        ...mapNewsItemToDetailFormValues(sampleItem),
        categories: [`${'A'.repeat(129)}`, 'Stadt'],
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    );

    expect(result.errors.categories).toBeTruthy();
  });

  it('derives changed field groups for basis versus content tabs', () => {
    expect(
      deriveDirtyNewsDetailTabs({
        title: true,
        categories: true,
        contentBlocks: [{ intro: true }],
        sourceUrl: { url: true },
      })
    ).toEqual({
      basis: true,
      content: true,
      release: false,
      settings: false,
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

  it('preserves fullVersion=false when serializing edit payloads', () => {
    const values = {
      ...createDefaultNewsDetailFormValues(),
      title: 'Rathaus informiert',
      publishedAt: '2026-05-24T09:00:00.000Z',
      fullVersion: false,
      contentBlocks: [{ title: '', intro: '', body: '<p>Ausführlicher Inhalt</p>', mediaContents: [] }],
    };

    expect(mapNewsDetailFormValuesToMutation(values, 'edit')).toMatchObject({
      fullVersion: false,
    });
  });
});
