import { describe, expect, it } from 'vitest';

import { validateNewsPayload } from '../src/index.js';

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
