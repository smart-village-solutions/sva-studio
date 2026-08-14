import { describe, expect, it } from 'vitest';

import {
  mediaContentFromAsset,
  mediaContentTypeFromAsset,
} from '../src/events.detail-media.helpers.js';
import { normalizeMediaContentType } from '../src/events.detail-media-content-type.js';

const publicAsset = {
  id: 'asset-1',
  fileName: ' flyeR.PNG ',
  mimeType: 'image/png',
  previewUrl: ' https://cdn.example.com/flyer.png ',
  visibility: 'public',
  metadata: {
    title: ' Sommerfest ',
    copyright: ' Stadt ',
  },
};

describe('events detail media helpers', () => {
  it('normalizes allowed media content types and rejects unsupported values', () => {
    expect(normalizeMediaContentType(' IMAGE ')).toBe('image');
    expect(normalizeMediaContentType('attachment')).toBe('attachment');
    expect(normalizeMediaContentType('document')).toBeUndefined();
    expect(normalizeMediaContentType('   ')).toBeUndefined();

    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'image/webp' })).toBe('image');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'audio/mpeg' })).toBe('audio');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'video/mp4' })).toBe('video');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'logo' })).toBe('logo');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'application/pdf' })).toBe('');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: '   ' })).toBe('');
  });

  it('derives media content from public assets and rejects unavailable urls', () => {
    expect(mediaContentFromAsset(publicAsset)).toEqual({
      captionText: 'Sommerfest',
      copyright: 'Stadt',
      contentType: 'image',
      sourceUrl: {
        url: 'https://cdn.example.com/flyer.png',
        description: 'flyeR.PNG',
      },
    });

    expect(mediaContentFromAsset({ ...publicAsset, visibility: 'private' })).toBeNull();
    expect(mediaContentFromAsset({ ...publicAsset, previewUrl: '   ' })).toBeNull();
  });
});
