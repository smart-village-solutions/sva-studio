import { describe, expect, it } from 'vitest';

import {
  createDefaultNewsDetailFormValues,
  mapNewsDetailFormValuesToMutation,
  mapNewsItemToDetailFormValues,
  newsDetailFormSchema,
} from '../src/news.detail-form.js';
import type { NewsContentItem } from '../src/news.types.js';

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
  it('provides default values for the simplified editorial fields', () => {
    expect(createDefaultNewsDetailFormValues('Redaktion')).toMatchObject({
      title: '',
      author: 'Redaktion',
      categories: [],
      contentTeaser: '',
      contentBody: '',
      contentMedia: [],
      sourceUrl: { url: '', description: '' },
      sourceUrlDescription: '',
      pushNotificationEnabled: false,
      publicationMode: 'draft',
      scheduledPublicationAt: '',
    });
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
      externalId: 'ext-42',
      newsType: 'meldung',
      charactersToBeShown: '180',
      fullVersion: true,
      showPublishDate: false,
      pointOfInterestId: 'poi-1',
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

  it('preserves hidden legacy fields when serializing edit payloads', () => {
    const values = {
      ...mapNewsItemToDetailFormValues(sampleItem),
      title: 'Aktualisierte News',
      contentTeaser: 'Neuer Teaser',
      contentBody: '<p>Neuer Inhalt</p>',
      publicationMode: 'immediate' as const,
      pushNotificationEnabled: true,
    };

    expect(mapNewsDetailFormValuesToMutation(values, 'edit')).toMatchObject({
      externalId: 'ext-42',
      newsType: 'meldung',
      charactersToBeShown: 180,
      fullVersion: true,
      showPublishDate: false,
      pointOfInterestId: 'poi-1',
      keywords: 'Rathaus, Termin',
      title: 'Aktualisierte News',
    });
  });
});
