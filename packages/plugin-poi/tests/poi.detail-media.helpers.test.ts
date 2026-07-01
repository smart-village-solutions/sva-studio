import { describe, expect, it } from 'vitest';

import type { HostMediaAssetListItem } from '@sva/plugin-sdk';

import {
  getAssetPersistentUrl,
  isSupportedUploadFile,
  matchesAssetSearch,
  mediaContentFromAsset,
  mediaContentSourceKey,
  mediaContentTypeFromAsset,
  readAssetCopyright,
  readAssetFileName,
  readAssetTitle,
  uploadPhaseMessageKey,
} from '../src/poi.detail-media.helpers.js';

const createAsset = (overrides: Partial<HostMediaAssetListItem> = {}): HostMediaAssetListItem => ({
  id: 'asset-1',
  fileName: ' asset-file.jpg ',
  metadata: {},
  visibility: 'public',
  mimeType: 'image/jpeg',
  previewUrl: ' https://example.com/asset-file.jpg ',
  ...overrides,
});

describe('poi.detail-media.helpers', () => {
  it('accepts only supported upload file mime types', () => {
    expect(isSupportedUploadFile(new File(['image'], 'photo.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(isSupportedUploadFile(new File(['image'], 'photo.png', { type: 'image/png' }))).toBe(true);
    expect(isSupportedUploadFile(new File(['image'], 'photo.webp', { type: 'image/webp' }))).toBe(true);
    expect(isSupportedUploadFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toBe(false);
  });

  it('maps each upload phase to the expected message key', () => {
    expect(uploadPhaseMessageKey('idle')).toBeNull();
    expect(uploadPhaseMessageKey('initializing')).toBe('messages.mediaUploadInitializing');
    expect(uploadPhaseMessageKey('uploading')).toBe('messages.mediaUploadUploading');
    expect(uploadPhaseMessageKey('finalizing')).toBe('messages.mediaUploadFinalizing');
    expect(uploadPhaseMessageKey('success')).toBe('messages.mediaUploadSuccess');
    expect(uploadPhaseMessageKey('error')).toBe('messages.mediaUploadError');
  });

  it('reads asset metadata and visibility-aware URLs with trimmed fallbacks', () => {
    expect(
      readAssetTitle(
        createAsset({
          metadata: {
            title: '  Sichtbarer Titel  ',
          },
        }),
      ),
    ).toBe('Sichtbarer Titel');

    expect(
      readAssetTitle(
        createAsset({
          metadata: {
            title: '   ',
          },
        }),
      ),
    ).toBe('asset-file.jpg');

    expect(
      readAssetTitle(
        createAsset({
          fileName: '   ',
        }),
      ),
    ).toBe('asset-1');

    expect(readAssetFileName(createAsset())).toBe('asset-file.jpg');
    expect(readAssetFileName(createAsset({ fileName: '   ' }))).toBe('asset-1');

    expect(
      readAssetCopyright(
        createAsset({
          metadata: {
            copyright: '  CC-BY  ',
          },
        }),
      ),
    ).toBe('CC-BY');
    expect(readAssetCopyright(createAsset({ metadata: { copyright: 42 } }))).toBe('');

    expect(getAssetPersistentUrl(createAsset())).toBe('https://example.com/asset-file.jpg');
    expect(getAssetPersistentUrl(createAsset({ visibility: 'protected' }))).toBeNull();
    expect(getAssetPersistentUrl(createAsset({ previewUrl: '   ' }))).toBeNull();
  });

  it('matches media assets against normalized search strings', () => {
    const asset = createAsset({
      fileName: 'Koeln-audio.mp3',
      metadata: {
        title: 'Kölner Dom',
      },
    });

    expect(matchesAssetSearch(asset, '')).toBe(true);
    expect(matchesAssetSearch(asset, 'kölner')).toBe(true);
    expect(matchesAssetSearch(asset, 'audio')).toBe(true);
    expect(matchesAssetSearch(asset, 'berlin')).toBe(false);
  });

  it('maps assets into media contents and normalized content types', () => {
    expect(mediaContentTypeFromAsset(createAsset({ mimeType: undefined }))).toBe('');
    expect(mediaContentTypeFromAsset(createAsset({ mimeType: 'image/png' }))).toBe('image');
    expect(mediaContentTypeFromAsset(createAsset({ mimeType: 'audio/mpeg' }))).toBe('audio');
    expect(mediaContentTypeFromAsset(createAsset({ mimeType: 'video/mp4' }))).toBe('video');
    expect(mediaContentTypeFromAsset(createAsset({ mimeType: ' attachement ' }))).toBe('attachment');

    expect(
      mediaContentFromAsset(
        createAsset({
          metadata: {
            title: '  Bibliotheksbild  ',
            copyright: '  CC0  ',
          },
        }),
      ),
    ).toEqual({
      captionText: 'Bibliotheksbild',
      copyright: 'CC0',
      contentType: 'image',
      sourceUrl: {
        url: 'https://example.com/asset-file.jpg',
        description: 'asset-file.jpg',
      },
    });

    expect(mediaContentFromAsset(createAsset({ visibility: 'private' }))).toBeNull();
    expect(mediaContentSourceKey(undefined)).toBe('');
    expect(
      mediaContentSourceKey({
        sourceUrl: {
          url: ' https://example.com/media.png ',
        },
      }),
    ).toBe('https://example.com/media.png');
  });
});
