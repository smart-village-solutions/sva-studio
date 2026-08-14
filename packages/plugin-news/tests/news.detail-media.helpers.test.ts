import { describe, expect, it } from 'vitest';

import {
  mediaContentFromAsset,
  mediaContentSourceKey,
  mediaContentTypeFromAsset,
} from '../src/news.detail-media.helpers.js';
import { normalizeMediaContentType } from '../src/news.detail-media-content-type.js';

const publicAsset = {
  id: 'asset-1',
  fileName: ' teaser.jpg ',
  mimeType: 'image/jpeg',
  previewUrl: ' https://cdn.example.com/teaser.jpg ',
  visibility: 'public',
  metadata: {
    title: ' Titelbild ',
    copyright: ' Redaktion ',
  },
};

describe('news detail media helpers', () => {
  it('keeps the News-specific image fallback for unsupported media content types', () => {
    expect(normalizeMediaContentType(' VIDEO ')).toBe('video');
    expect(normalizeMediaContentType('logo')).toBe('logo');
    expect(normalizeMediaContentType('pdf')).toBeUndefined();
    expect(normalizeMediaContentType(undefined)).toBeUndefined();

    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'image/webp' })).toBe('image');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'audio/mpeg' })).toBe('audio');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'video/mp4' })).toBe('video');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'attachment' })).toBe(
      'attachment'
    );
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'application/pdf' })).toBe(
      'image'
    );
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: '   ' })).toBe('image');
  });

  it('maps public assets without changing the News form-value contract', () => {
    expect(mediaContentFromAsset(publicAsset)).toEqual({
      captionText: 'Titelbild',
      copyright: 'Redaktion',
      contentType: 'image',
      sourceUrl: {
        url: 'https://cdn.example.com/teaser.jpg',
        description: 'teaser.jpg',
      },
      height: '',
      width: '',
    });
    expect(mediaContentFromAsset({ ...publicAsset, visibility: 'private' })).toBeNull();
    expect(mediaContentFromAsset({ ...publicAsset, previewUrl: '   ' })).toBeNull();

    expect(
      mediaContentSourceKey({ sourceUrl: { url: ' https://cdn.example.com/teaser.jpg ' } } as never)
    ).toBe('https://cdn.example.com/teaser.jpg');
    expect(mediaContentSourceKey(undefined)).toBe('');
  });
});
