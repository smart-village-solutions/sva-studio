import { describe, expect, it } from 'vitest';

import { validateContentTypePayload } from './content-type-registry.js';

describe('iam content type registry', () => {
  it('accepts RFC URL schemes case-insensitively when the protocol is HTTPS', () => {
    const result = validateContentTypePayload('news.article', {
      body: '<p>Nachricht</p>',
      externalUrl: 'HTTPS://example.test/news',
      imageUrl: 'HTTPS://example.test/image.jpg',
      teaser: 'Teaser',
    });

    expect(result.ok).toBe(true);
  });

  it('rejects non-HTTPS content URLs', () => {
    const result = validateContentTypePayload('news.article', {
      body: '<p>Nachricht</p>',
      externalUrl: 'http://example.test/news',
      teaser: 'Teaser',
    });

    expect(result).toMatchObject({
      ok: false,
      message: 'Es sind nur HTTPS-URLs erlaubt.',
    });
  });
});
