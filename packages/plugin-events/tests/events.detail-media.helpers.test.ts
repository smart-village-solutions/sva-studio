import { describe, expect, it } from 'vitest';

import {
  getAssetPersistentUrl,
  matchesAssetSearch,
  mediaContentFromAsset,
  mediaContentTypeFromAsset,
  normalizeSearchValue,
  readAssetCopyright,
  readAssetFileName,
  readAssetTitle,
  uploadPhaseMessageKey,
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
  });

  it('maps upload phases to translation keys', () => {
    expect(uploadPhaseMessageKey('idle')).toBeNull();
    expect(uploadPhaseMessageKey('initializing')).toBe('messages.mediaUploadInitializing');
    expect(uploadPhaseMessageKey('uploading')).toBe('messages.mediaUploadUploading');
    expect(uploadPhaseMessageKey('finalizing')).toBe('messages.mediaUploadFinalizing');
    expect(uploadPhaseMessageKey('success')).toBe('messages.mediaUploadSuccess');
    expect(uploadPhaseMessageKey('error')).toBe('messages.mediaUploadError');
  });

  it('reads asset metadata with stable fallbacks', () => {
    expect(readAssetTitle(publicAsset)).toBe('Sommerfest');
    expect(readAssetFileName(publicAsset)).toBe('flyeR.PNG');
    expect(readAssetCopyright(publicAsset)).toBe('Stadt');

    expect(readAssetTitle({ id: 'asset-2', fileName: ' title-from-file.jpg ' })).toBe('title-from-file.jpg');
    expect(readAssetTitle({ id: 'asset-3', fileName: '   ' })).toBe('asset-3');
    expect(readAssetFileName({ id: 'asset-4', fileName: '   ' })).toBe('asset-4');
    expect(readAssetCopyright({ id: 'asset-5', metadata: { copyright: 42 } })).toBe('');
  });

  it('filters persistent urls, search matches, and media content types defensively', () => {
    expect(getAssetPersistentUrl(publicAsset)).toBe('https://cdn.example.com/flyer.png');
    expect(getAssetPersistentUrl({ ...publicAsset, visibility: 'private' })).toBeNull();
    expect(getAssetPersistentUrl({ ...publicAsset, previewUrl: '   ' })).toBeNull();

    const query = normalizeSearchValue('sommer');
    expect(matchesAssetSearch(publicAsset, query)).toBe(true);
    expect(matchesAssetSearch(publicAsset, normalizeSearchValue('png'))).toBe(true);
    expect(matchesAssetSearch(publicAsset, normalizeSearchValue('winter'))).toBe(false);
    expect(matchesAssetSearch(publicAsset, '')).toBe(true);

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
  });
});
