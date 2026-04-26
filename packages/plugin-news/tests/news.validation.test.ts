import { describe, expect, it } from 'vitest';

import { validateNewsForm, validateNewsPayload } from '../src/index.js';

describe('validateNewsPayload', () => {
  it('accepts a valid payload', () => {
    expect(
      validateNewsPayload({
        teaser: 'Kurztext',
        body: '<p>Hallo</p>',
        imageUrl: 'https://example.com/image.jpg',
        externalUrl: 'https://example.com/article',
        category: 'Allgemein',
      })
    ).toEqual([]);
  });

  it('rejects invalid fields', () => {
    expect(
      validateNewsPayload({
        teaser: '',
        body: '',
        imageUrl: 'http://example.com/image.jpg',
        externalUrl: 'javascript:alert(1)',
        category: 'x'.repeat(129),
      })
    ).toEqual(['teaser', 'body', 'imageUrl', 'externalUrl', 'category']);
  });
});

describe('validateNewsForm', () => {
  it('accepts a valid contentBlocks based news form', () => {
    expect(
      validateNewsForm({
        title: 'Neue News',
        publishedAt: '2026-04-13T09:00:00.000Z',
        publicationDate: '2026-04-13T08:00:00.000Z',
        charactersToBeShown: 240,
        categoryName: 'Allgemein',
        sourceUrl: { url: 'https://example.com/article' },
        categories: [{ name: 'Allgemein' }],
        contentBlocks: [
          {
            intro: 'Kurztext',
            body: '<p>Hallo</p>',
            mediaContents: [{ sourceUrl: { url: 'https://example.com/image.jpg' } }],
          },
        ],
      })
    ).toEqual([]);
  });

  it('rejects invalid full model fields', () => {
    expect(
      validateNewsForm({
        title: '',
        publishedAt: 'kein-datum',
        publicationDate: 'auch-kein-datum',
        charactersToBeShown: -1,
        categoryName: 'x'.repeat(129),
        sourceUrl: { url: 'http://example.com/article' },
        categories: [{ name: '' }],
        contentBlocks: [{ body: '' }, { body: '<p>Hallo</p>', mediaContents: [{ sourceUrl: { url: 'ftp://example.com' } }] }],
      })
    ).toEqual([
      'title',
      'publishedAt',
      'publicationDate',
      'charactersToBeShown',
      'categoryName',
      'sourceUrl',
      'categories',
      'mediaContents',
    ]);
  });
});
