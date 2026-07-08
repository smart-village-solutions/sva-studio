import { describe, expect, it } from 'vitest';

import {
  getAssetPersistentUrl,
  matchesAssetSearch,
  mediaContentFromAsset,
  mediaContentSourceKey,
  mediaContentTypeFromAsset,
  normalizeSearchValue,
  readAssetCopyright,
  readAssetFileName,
  readAssetTitle,
  uploadPhaseMessageKey,
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
  it('normalizes media content types and upload phase messages', () => {
    expect(normalizeMediaContentType(' VIDEO ')).toBe('video');
    expect(normalizeMediaContentType('logo')).toBe('logo');
    expect(normalizeMediaContentType('pdf')).toBeUndefined();
    expect(normalizeMediaContentType(undefined)).toBeUndefined();

    expect(uploadPhaseMessageKey('idle')).toBeNull();
    expect(uploadPhaseMessageKey('initializing')).toBe('messages.mediaUploadInitializing');
    expect(uploadPhaseMessageKey('uploading')).toBe('messages.mediaUploadUploading');
    expect(uploadPhaseMessageKey('finalizing')).toBe('messages.mediaUploadFinalizing');
    expect(uploadPhaseMessageKey('success')).toBe('messages.mediaUploadSuccess');
    expect(uploadPhaseMessageKey('error')).toBe('messages.mediaUploadError');
  });

  it('reads media asset metadata and search keys with defensive fallbacks', () => {
    expect(readAssetTitle(publicAsset)).toBe('Titelbild');
    expect(readAssetFileName(publicAsset)).toBe('teaser.jpg');
    expect(readAssetCopyright(publicAsset)).toBe('Redaktion');

    expect(readAssetTitle({ id: 'asset-2', fileName: 'fallback.png' })).toBe('fallback.png');
    expect(readAssetTitle({ id: 'asset-3', fileName: '   ' })).toBe('asset-3');
    expect(readAssetFileName({ id: 'asset-4', fileName: '   ' })).toBe('asset-4');
    expect(readAssetCopyright({ id: 'asset-5', metadata: { copyright: false } })).toBe('');

    expect(matchesAssetSearch(publicAsset, '')).toBe(true);
    expect(matchesAssetSearch(publicAsset, normalizeSearchValue('titel'))).toBe(true);
    expect(matchesAssetSearch(publicAsset, normalizeSearchValue('jpg'))).toBe(true);
    expect(matchesAssetSearch(publicAsset, normalizeSearchValue('winter'))).toBe(false);
  });

  it('maps asset urls, media types, and content payloads consistently', () => {
    expect(getAssetPersistentUrl(publicAsset)).toBe('https://cdn.example.com/teaser.jpg');
    expect(getAssetPersistentUrl({ ...publicAsset, visibility: 'private' })).toBeNull();
    expect(getAssetPersistentUrl({ ...publicAsset, previewUrl: '   ' })).toBeNull();

    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'image/webp' })).toBe('image');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'audio/mpeg' })).toBe('audio');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'video/mp4' })).toBe('video');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'attachment' })).toBe('attachment');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: 'application/pdf' })).toBe('image');
    expect(mediaContentTypeFromAsset({ ...publicAsset, mimeType: '   ' })).toBe('image');

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

    expect(mediaContentSourceKey({ sourceUrl: { url: ' https://cdn.example.com/teaser.jpg ' } } as never)).toBe(
      'https://cdn.example.com/teaser.jpg'
    );
    expect(mediaContentSourceKey(undefined)).toBe('');
  });
});
