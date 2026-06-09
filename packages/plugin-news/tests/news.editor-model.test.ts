import { describe, expect, it } from 'vitest';

import {
  buildNewsSavePayload,
  createNewsEditorFormValues,
  deriveNewsEditorialStatus,
} from '../src/news.editor-model.js';
import type { NewsContentItem, NewsDetailFormValues } from '../src/news.types.js';

const newsItemFixture: NewsContentItem = {
  id: 'news-1',
  title: 'Bestehender Titel',
  contentType: 'news',
  payload: {
    teaser: 'Legacy teaser',
    body: '<p>Legacy body</p>',
  },
  status: 'published',
  author: 'Redaktion',
  keywords: 'Rathaus, Termin',
  externalId: 'legacy-external-id',
  fullVersion: true,
  charactersToBeShown: 240,
  newsType: 'legacy-news-type',
  publicationDate: '2026-06-09T09:00:00.000Z',
  publishedAt: '2026-06-09T09:00:00.000Z',
  showPublishDate: false,
  categories: [{ name: 'Stadt' }],
  sourceUrl: { url: 'https://example.org/source', description: 'Quelle' },
  contentBlocks: [
    {
      title: 'Bestehender Titel',
      intro: 'Legacy teaser',
      body: '<p>Legacy body</p>',
      mediaContents: [],
    },
  ],
  pointOfInterestId: 'poi-7',
  visible: true,
  createdAt: '2026-06-08T10:00:00.000Z',
  updatedAt: '2026-06-09T09:30:00.000Z',
};

const editorValuesFixture: NewsDetailFormValues = {
  ...createNewsEditorFormValues(newsItemFixture),
  title: 'Neue Headline',
  author: 'Neue Redaktion',
  categories: ['Stadt', 'Service'],
  contentTeaser: 'Neuer Teaser',
  contentBody: '<p>Neuer Inhalt</p>',
  contentMedia: [],
  sourceUrl: {
    url: 'https://example.org/new-source',
    description: 'Neue Quelle',
  },
  sourceUrlDescription: 'Neue Quelle',
  pushNotificationEnabled: true,
  publicationMode: 'immediate',
  scheduledPublicationAt: '',
};

describe('news.editor-model', () => {
  it('stores legacy update fields in a hidden snapshot for compatibility-driven updates', () => {
    const values = createNewsEditorFormValues(newsItemFixture);

    expect(values.__legacySnapshot).toMatchObject({
      externalId: 'legacy-external-id',
      newsType: 'legacy-news-type',
      charactersToBeShown: 240,
      fullVersion: true,
      showPublishDate: false,
      pointOfInterestId: 'poi-7',
      keywords: 'Rathaus, Termin',
    });
  });

  it('falls back to the first content block headline when the explicit title is empty', () => {
    expect(
      createNewsEditorFormValues({
        ...newsItemFixture,
        title: '',
        contentBlocks: [{ title: 'Block Headline', intro: 'Teaser', body: '<p>Body</p>', mediaContents: [] }],
      }).title
    ).toBe('Block Headline');
  });

  it('derives draft, scheduled, and published from visible and publishedAt', () => {
    expect(
      deriveNewsEditorialStatus({ visible: false, publishedAt: '2026-06-09T09:00:00.000Z' }, '2026-06-09T10:00:00.000Z')
    ).toBe('draft');
    expect(
      deriveNewsEditorialStatus({ visible: true, publishedAt: '2026-06-09T11:00:00.000Z' }, '2026-06-09T10:00:00.000Z')
    ).toBe('scheduled');
    expect(
      deriveNewsEditorialStatus({ visible: true, publishedAt: '2026-06-09T09:00:00.000Z' }, '2026-06-09T10:00:00.000Z')
    ).toBe('published');
  });

  it('preserves hidden legacy fields on update payloads', () => {
    const payload = buildNewsSavePayload(
      editorValuesFixture,
      editorValuesFixture.__legacySnapshot ?? null,
      '2026-06-09T10:00:00.000Z'
    ).mutation;

    expect(payload).toMatchObject({
      externalId: 'legacy-external-id',
      newsType: 'legacy-news-type',
      charactersToBeShown: 240,
      fullVersion: true,
      showPublishDate: false,
      pointOfInterestId: 'poi-7',
      keywords: 'Rathaus, Termin',
    });
  });
});
