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
  payload: {},
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
      intro: 'Legacy intro',
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
  contentIntro: 'Neue Einleitung',
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
        contentBlocks: [{ title: 'Block Headline', intro: 'Einleitung', body: '<p>Body</p>', mediaContents: [] }],
      }).title
    ).toBe('Block Headline');
  });

  it('normalizes sparse legacy content and media fields to editor defaults', () => {
    const values = createNewsEditorFormValues({
      ...newsItemFixture,
      title: '',
      author: undefined,
      categories: [],
      sourceUrl: undefined,
      contentBlocks: [{ mediaContents: [{ sourceUrl: undefined }] }],
    });

    expect(values).toMatchObject({
      title: '',
      author: '',
      contentIntro: '',
      contentBody: '',
      sourceUrl: { url: '', description: '' },
      contentMedia: [{ captionText: '', copyright: '', contentType: 'image', height: '', width: '', sourceUrl: { url: '', description: '' } }],
    });
  });

  it('does not recover editorial text from payload fields when content blocks are absent', () => {
    const values = createNewsEditorFormValues({
      ...newsItemFixture,
      payload: {
        teaser: 'Nicht mehr unterstützte Einleitung',
        body: 'Nicht mehr unterstützter Inhalt',
        imageUrl: 'https://example.org/legacy.jpg',
      },
      contentBlocks: [],
    } as NewsContentItem);

    expect(values).toMatchObject({
      contentIntro: '',
      contentBody: '',
      contentMedia: [],
    });
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

  it('omits blank legacy character limits from update payloads', () => {
    const payload = buildNewsSavePayload(
      editorValuesFixture,
      { ...editorValuesFixture.__legacySnapshot, charactersToBeShown: ' ' },
      '2026-06-09T10:00:00.000Z'
    ).mutation;

    expect(payload).not.toHaveProperty('charactersToBeShown');
  });

  it('preserves the original publishedAt when editing an already published item in immediate mode', () => {
    const payload = buildNewsSavePayload(
      {
        ...editorValuesFixture,
        publicationMode: 'immediate',
        scheduledPublicationAt: '',
      },
      editorValuesFixture.__legacySnapshot ?? null,
      '2026-06-10T08:00:00.000Z'
    );

    expect(payload.mutation.publishedAt).toBe('2026-06-09T09:00:00.000Z');
    expect(payload.visible).toBe(true);
  });
});
