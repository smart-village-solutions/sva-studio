import { describe, expect, it } from 'vitest';

import { validateContentTypePayload } from './content-type-registry.js';

describe('content type registry', () => {
  it('accepts and sanitizes valid news payloads', () => {
    const result = validateContentTypePayload('news', {
      teaser: '  <strong>Kurzmeldung</strong>  ',
      body: '<p>Hallo</p><script>alert(1)</script>',
      imageUrl: 'https://example.com/image.jpg',
      externalUrl: 'https://example.com/article',
      category: 'Kommunal',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.payload).toEqual({
      teaser: 'Kurzmeldung',
      body: '<p>Hallo</p>',
      imageUrl: 'https://example.com/image.jpg',
      externalUrl: 'https://example.com/article',
      category: 'Kommunal',
    });
  });

  it('rejects invalid news payloads', () => {
    const result = validateContentTypePayload('news', {
      teaser: '',
      body: '<p>Hallo</p>',
      externalUrl: 'javascript:alert(1)',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.message.length).toBeGreaterThan(0);
  });

  it('rejects news bodies without visible text and returns localized validation messages', () => {
    const result = validateContentTypePayload('news', {
      teaser: '',
      body: '<p><br></p>',
    });

    expect(result).toEqual({
      ok: false,
      message: 'Der Teaser ist erforderlich.',
    });

    const emptyBodyResult = validateContentTypePayload('news', {
      teaser: 'Kurzmeldung',
      body: '<p><br></p>',
    });

    expect(emptyBodyResult).toEqual({
      ok: false,
      message: 'Der Inhalt ist erforderlich.',
    });
  });

  it('passes through unknown content types unchanged', () => {
    const payload = { title: 'Generic' };

    expect(validateContentTypePayload('generic', payload)).toEqual({
      ok: true,
      payload,
    });
  });
});
