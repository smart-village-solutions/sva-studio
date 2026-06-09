import { describe, expect, it } from 'vitest';

import {
  createDefaultNewsDetailFormValues,
  mapNewsDetailFormValuesToMutation,
  mapNewsItemToDetailFormValues,
  newsDetailFormSchema,
} from '../src/news.detail-form.js';
import type { NewsContentBlockFormValue, NewsContentItem } from '../src/news.types.js';

const sampleItem: NewsContentItem = {
  id: 'news-1',
  title: 'Rathaus informiert',
  contentType: 'news',
  payload: {
    teaser: 'Kurzer Einstieg',
    body: '<p>Ausfuehrlicher Inhalt</p>',
    category: 'Stadt',
  },
  status: 'published',
  author: 'Redaktion',
  keywords: 'Rathaus, Termin',
  externalId: 'ext-42',
  fullVersion: true,
  charactersToBeShown: 180,
  newsType: 'meldung',
  publicationDate: '2026-05-24T08:00:00.000Z',
  publishedAt: '2026-05-24T09:00:00.000Z',
  showPublishDate: false,
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
      body: '<p>Ausfuehrlicher Inhalt</p>',
      mediaContents: [{ sourceUrl: { url: 'https://example.org/image.jpg', description: '' } }],
    },
  ],
  pointOfInterestId: 'poi-1',
  visible: true,
  createdAt: '2026-05-20T09:00:00.000Z',
  updatedAt: '2026-05-22T09:00:00.000Z',
};

describe('news.detail-form', () => {
  it('backs compatibility aliases with the hidden snapshot instead of standalone public state', () => {
    const values = createDefaultNewsDetailFormValues('Redaktion') as typeof createDefaultNewsDetailFormValues extends (
      ...args: never[]
    ) => infer TValue
      ? TValue & {
          externalId?: string;
          newsType?: string;
          contentBlocks?: NewsContentBlockFormValue[];
        }
      : never;

    values.externalId = 'ext-42';
    values.newsType = 'meldung';
    values.contentBlocks = [{ title: 'Block', intro: 'Teaser', body: '<p>Body</p>', mediaContents: [] }];

    expect(values.__legacySnapshot).toMatchObject({
      externalId: 'ext-42',
      newsType: 'meldung',
    });
    expect(values.contentBlocks?.[0]).toMatchObject({
      title: 'Block',
      intro: 'Teaser',
      body: '<p>Body</p>',
    });
    expect(values.contentTeaser).toBe('Teaser');
    expect(values.contentBody).toBe('<p>Body</p>');
  });

  it('maps a NewsContentItem into the simplified editorial form values', () => {
    expect(mapNewsItemToDetailFormValues(sampleItem)).toMatchObject({
      title: 'Rathaus informiert',
      author: 'Redaktion',
      categories: ['Stadt', 'Verwaltung'],
      contentTeaser: 'Kurzer Einstieg',
      contentBody: '<p>Ausfuehrlicher Inhalt</p>',
      sourceUrl: { url: 'https://example.org/news', description: 'Quelle' },
      sourceUrlDescription: 'Quelle',
      publicationMode: 'immediate',
      scheduledPublicationAt: '',
      __legacySnapshot: expect.objectContaining({
        externalId: 'ext-42',
        newsType: 'meldung',
        charactersToBeShown: 180,
        fullVersion: true,
        showPublishDate: false,
        pointOfInterestId: 'poi-1',
      }),
    });
  });

  it('requires a schedule date only for scheduled publication mode', async () => {
    await expect(newsDetailFormSchema.parseAsync({
      ...createDefaultNewsDetailFormValues(),
      title: 'News title',
      author: 'Redaktion',
      contentTeaser: 'Teaser',
      contentBody: '<p>Body</p>',
      publicationMode: 'scheduled',
      scheduledPublicationAt: '',
    })).rejects.toThrow();
  });

  it('allows draft mode without a scheduled publication date', async () => {
    await expect(newsDetailFormSchema.parseAsync({
      ...createDefaultNewsDetailFormValues(),
      title: 'News title',
      author: 'Redaktion',
      contentTeaser: 'Teaser',
      contentBody: '<p>Body</p>',
      publicationMode: 'draft',
      scheduledPublicationAt: '',
    })).resolves.toMatchObject({
      publicationMode: 'draft',
    });
  });

  it('accepts the simplified schema without public legacy fields', async () => {
    await expect(newsDetailFormSchema.parseAsync({
      title: 'News title',
      author: 'Redaktion',
      categories: [],
      contentTeaser: 'Teaser',
      contentBody: '<p>Body</p>',
      contentMedia: [],
      sourceUrl: { url: '', description: '' },
      sourceUrlDescription: '',
      pushNotificationEnabled: false,
      publicationMode: 'immediate',
      scheduledPublicationAt: '',
    })).resolves.not.toHaveProperty('externalId');
  });

  it('omits untouched compatibility defaults from serialized mutations', () => {
    const values = createDefaultNewsDetailFormValues('Redaktion');

    values.title = 'Neue News';
    values.contentTeaser = 'Teaser';
    values.contentBody = '<p>Body</p>';

    const mutation = mapNewsDetailFormValuesToMutation(values, 'create');

    expect(mutation).not.toHaveProperty('externalId');
    expect(mutation).not.toHaveProperty('keywords');
    expect(mutation).not.toHaveProperty('newsType');
    expect(mutation).not.toHaveProperty('pointOfInterestId');
    expect(mutation).not.toHaveProperty('address');
    expect(mutation).not.toHaveProperty('charactersToBeShown');
  });

  it('preserves compatibility publicationDate edits distinct from publishedAt', () => {
    const values = createDefaultNewsDetailFormValues('Redaktion');

    values.contentBlocks = [{ title: 'Block', intro: 'Teaser', body: '<p>Body</p>', mediaContents: [] }];
    values.publishedAt = '2026-06-01T12:00:00.000Z';
    values.publicationDate = '2026-05-31T18:30:00.000Z';

    const mutation = mapNewsDetailFormValuesToMutation(values, 'create');

    expect(mutation).toMatchObject({
      title: 'Block',
      publishedAt: '2026-06-01T12:00:00.000Z',
      publicationDate: '2026-05-31T18:30:00.000Z',
      contentBlocks: [expect.objectContaining({ title: 'Block', intro: 'Teaser', body: '<p>Body</p>' })],
    });
  });

  it('serializes edit payloads from the simplified fields even when compatibility data disagrees', () => {
    const values = mapNewsItemToDetailFormValues(sampleItem);

    values.contentBlocks = [
      {
        title: 'Legacy Abschnitt',
        intro: 'Legacy Teaser',
        body: '<p>Legacy Inhalt</p>',
        mediaContents: [],
      },
    ];
    values.publishedAt = '2020-01-01T00:00:00.000Z';
    values.publicationDate = '2020-01-01T00:00:00.000Z';
    values.title = 'Aktualisierte News';
    values.contentTeaser = 'Neuer Teaser';
    values.contentBody = '<p>Neuer Inhalt</p>';
    values.publicationMode = 'scheduled';
    values.scheduledPublicationAt = '2026-06-01T12:00:00.000Z';
    values.pushNotificationEnabled = true;

    expect(mapNewsDetailFormValuesToMutation(values, 'edit')).toMatchObject({
      externalId: 'ext-42',
      newsType: 'meldung',
      charactersToBeShown: 180,
      fullVersion: true,
      showPublishDate: false,
      pointOfInterestId: 'poi-1',
      keywords: 'Rathaus, Termin',
      title: 'Aktualisierte News',
      publishedAt: '2026-06-01T12:00:00.000Z',
      publicationDate: '2020-01-01T00:00:00.000Z',
      contentBlocks: [
        expect.objectContaining({
          title: 'Aktualisierte News',
          intro: 'Neuer Teaser',
          body: '<p>Neuer Inhalt</p>',
        }),
      ],
    });
  });
});
