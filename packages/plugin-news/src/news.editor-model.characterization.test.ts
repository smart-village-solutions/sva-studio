import { describe, expect, it } from 'vitest';

import { buildNewsSavePayload, createNewsEditorFormValues } from './news.editor-model.js';
import type { NewsContentItem } from './news.types.js';

const itemFixture: NewsContentItem = {
  id: 'news-1',
  title: 'Existing title',
  contentType: 'news',
  payload: {},
  status: 'published',
  author: 'Editorial team',
  publishedAt: '2026-06-09T09:00:00.000Z',
  visible: true,
  createdAt: '2026-06-08T10:00:00.000Z',
  updatedAt: '2026-06-09T09:30:00.000Z',
};

describe('news editor model characterization', () => {
  it('initializes the editor from first-block and payload fallbacks while retaining all legacy blocks', () => {
    const values = createNewsEditorFormValues({
      ...itemFixture,
      title: '   ',
      author: undefined,
      categories: [],
      payload: { category: 'Fallback category', externalUrl: 'https://example.org/external' },
      sourceUrl: undefined,
      visible: false,
      contentBlocks: [
        {
          title: 'First block title',
          intro: 'First introduction',
          body: '<p>First body</p>',
          mediaContents: [
            {
              contentType: 'video',
              height: 720,
              width: '1280',
              sourceUrl: { url: 'https://example.org/video', description: 'Video source' },
            },
          ],
        },
        { title: 'Second block title', mediaContents: [] },
      ],
    } as unknown as NewsContentItem);

    expect(values).toMatchObject({
      title: 'First block title',
      author: '',
      categories: ['Fallback category'],
      contentIntro: 'First introduction',
      contentBody: '<p>First body</p>',
      contentMedia: [
        {
          captionText: '',
          copyright: '',
          contentType: 'video',
          height: '720',
          width: '1280',
          sourceUrl: { url: 'https://example.org/video', description: 'Video source' },
        },
      ],
      sourceUrl: { url: 'https://example.org/external', description: '' },
      sourceUrlDescription: '',
      publicationMode: 'draft',
      scheduledPublicationAt: '',
      pushNotificationEnabled: false,
      wasteLocationKeys: [],
    });
    expect(values.__legacySnapshot?.legacyContentBlocks).toHaveLength(2);
  });

  it('serializes meaningful legacy fields without normalizing their original strings', () => {
    const values = createNewsEditorFormValues(itemFixture);
    const mutation = buildNewsSavePayload(
      { ...values, pushNotificationEnabled: false },
      {
        externalId: ' legacy-id ',
        keywords: ' legacy keyword ',
        fullVersion: false,
        charactersToBeShown: ' 25 ',
        newsType: ' legacy type ',
        showPublishDate: false,
        address: { street: ' Main street ', zip: ' ', city: ' City ' },
        pointOfInterestId: ' poi-7 ',
      },
      '2026-06-10T08:00:00.000Z'
    ).mutation;

    expect(mutation).toMatchObject({
      externalId: ' legacy-id ',
      keywords: ' legacy keyword ',
      fullVersion: false,
      charactersToBeShown: 25,
      newsType: ' legacy type ',
      showPublishDate: false,
      address: { street: ' Main street ', city: ' City ' },
      pointOfInterestId: ' poi-7 ',
      pushNotification: false,
    });
  });

  it('omits empty legacy fields and never re-sends a push after delivery', () => {
    const values = createNewsEditorFormValues(itemFixture);
    const mutation = buildNewsSavePayload(
      { ...values, pushNotificationEnabled: true },
      {
        externalId: ' ',
        keywords: '',
        charactersToBeShown: 0,
        newsType: '\t',
        address: { street: ' ', zip: '', city: '\n' },
        pointOfInterestId: ' ',
        pushNotificationsSentAt: '2026-06-09T09:05:00.000Z',
      },
      '2026-06-10T08:00:00.000Z'
    ).mutation;

    expect(mutation).not.toHaveProperty('externalId');
    expect(mutation).not.toHaveProperty('keywords');
    expect(mutation).not.toHaveProperty('charactersToBeShown');
    expect(mutation).not.toHaveProperty('newsType');
    expect(mutation).not.toHaveProperty('address');
    expect(mutation).not.toHaveProperty('pointOfInterestId');
    expect(mutation).not.toHaveProperty('pushNotification');
  });
});
