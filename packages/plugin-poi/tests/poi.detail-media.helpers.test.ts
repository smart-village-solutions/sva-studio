import { describe, expect, it } from 'vitest';

import type { HostMediaAssetListItem } from '@sva/plugin-sdk';

import {
  mediaContentFromAsset,
  mediaContentSourceKey,
  mediaContentTypeFromAsset,
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
  it('maps assets into media contents and normalized content types', () => {
    expect(mediaContentTypeFromAsset(createAsset({ mimeType: undefined }))).toBe('');
    expect(mediaContentTypeFromAsset(createAsset({ mimeType: 'image/png' }))).toBe('image');
    expect(mediaContentTypeFromAsset(createAsset({ mimeType: 'audio/mpeg' }))).toBe('audio');
    expect(mediaContentTypeFromAsset(createAsset({ mimeType: 'video/mp4' }))).toBe('video');
    expect(mediaContentTypeFromAsset(createAsset({ mimeType: ' attachement ' }))).toBe(
      'attachment'
    );

    expect(
      mediaContentFromAsset(
        createAsset({
          metadata: {
            title: '  Bibliotheksbild  ',
            copyright: '  CC0  ',
          },
        })
      )
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
    expect(mediaContentFromAsset(createAsset({ previewUrl: '   ' }))).toBeNull();
    expect(mediaContentSourceKey(undefined)).toBe('');
    expect(
      mediaContentSourceKey({
        sourceUrl: {
          url: ' https://example.com/media.png ',
        },
      })
    ).toBe('https://example.com/media.png');
  });
});
