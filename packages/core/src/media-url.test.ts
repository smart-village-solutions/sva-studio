import { describe, expect, it } from 'vitest';

import {
  inspectManualMediaUrl,
  isPersistableManualMediaUrl,
  isPersistableMediaAssetUrl,
} from './media-url.js';

describe('media URL contracts', () => {
  it('keeps asset delivery HTTPS-only and allows explicit HTTP content snapshots', () => {
    expect(isPersistableMediaAssetUrl('https://cdn.example.test/image.jpg')).toBe(true);
    expect(isPersistableMediaAssetUrl('http://cdn.example.test/image.jpg')).toBe(false);
    expect(isPersistableManualMediaUrl('http://cdn.example.test/image.jpg')).toBe(true);
  });

  it.each([
    'http://user:secret@cdn.example.test/image.jpg',
    'https://cdn.example.test/image.jpg?token=secret',
    'http://cdn.example.test/image.jpg?X-Amz-Signature=secret',
    'blob:https://studio.example.test/local-preview',
  ])('rejects non-persistable manual media URL %s', (url) => {
    expect(isPersistableManualMediaUrl(url)).toBe(false);
  });

  it('builds HTTPS candidates without allowing a silent HTTP downgrade', () => {
    expect(inspectManualMediaUrl('http://cdn.example.test/image.jpg')).toEqual({
      kind: 'upgrade',
      value: 'http://cdn.example.test/image.jpg',
      httpsCandidate: 'https://cdn.example.test/image.jpg',
      httpFallback: true,
    });
    expect(inspectManualMediaUrl('cdn.example.test/image.jpg')).toEqual({
      kind: 'upgrade',
      value: 'cdn.example.test/image.jpg',
      httpsCandidate: 'https://cdn.example.test/image.jpg',
      httpFallback: false,
    });
  });
});
