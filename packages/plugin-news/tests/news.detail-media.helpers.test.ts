import { renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { isNewsAssetSelectable } from '../src/news.detail-page-media-selection.js';
import type { NewsDetailFormValues } from '../src/news.types.js';

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

it('uses the delivery URL for selection without requiring a preview', () => {
  const { result } = renderHook(() => useForm<NewsDetailFormValues>());
  const asset = {
    id: 'asset-delivery',
    title: 'Image',
    fileName: 'image.jpg',
    mimeType: 'image/jpeg',
    visibility: 'public',
    previewUrl: null,
    persistentUrl: 'https://example.org/delivery.jpg',
    metadata: { title: 'Image', altText: '', description: '', copyright: '', license: '' },
  };
  expect(isNewsAssetSelectable(asset, [], result.current)).toBe(true);
  result.current.setValue('contentMedia', [
    {
      captionText: '',
      copyright: '',
      contentType: 'image',
      height: '',
      width: '',
      sourceUrl: { url: asset.persistentUrl, description: '' },
    },
  ]);
  expect(
    isNewsAssetSelectable(
      { ...asset, previewUrl: 'https://example.org/preview.jpg' },
      [],
      result.current
    )
  ).toBe(false);
});
