import { describe, expect, it } from 'vitest';

import type { IamMediaAsset } from '../../../lib/iam-api';

import {
  countMediaPriorityBuckets,
  resolveMediaCardState,
  resolveMediaReferenceCount,
} from './-media-library-view-model';

const createAsset = (
  overrides: Partial<IamMediaAsset> = {},
  metadata: Partial<IamMediaAsset['metadata']> = {},
  technical: Record<string, unknown> = {}
): IamMediaAsset => ({
  id: 'asset-1',
  instanceId: 'instance-1',
  storageKey: 'media/asset-1',
  mediaType: 'image',
  mimeType: 'image/jpeg',
  byteSize: 1024,
  visibility: 'public',
  uploadStatus: 'processed',
  processingStatus: 'ready',
  metadata: {
    title: 'Hero',
    altText: 'Hero image',
    ...metadata,
  },
  technical,
  ...overrides,
});

describe('resolveMediaReferenceCount', () => {
  it('reads all supported technical reference count fallbacks and fails closed to zero', () => {
    expect(resolveMediaReferenceCount(createAsset({}, {}, { totalReferences: 4 }))).toBe(4);
    expect(resolveMediaReferenceCount(createAsset({}, {}, { referenceCount: '3' }))).toBe(3);
    expect(resolveMediaReferenceCount(createAsset({}, {}, { usageCount: 2 }))).toBe(2);
    expect(
      resolveMediaReferenceCount(createAsset({}, {}, { usage: { totalReferences: 5 } }))
    ).toBe(5);
    expect(
      resolveMediaReferenceCount(createAsset({}, {}, { metrics: { usageCount: '6' } }))
    ).toBe(6);
    expect(resolveMediaReferenceCount(createAsset({}, {}, { usage: 'unknown-shape' }))).toBe(0);
  });
});

describe('resolveMediaCardState', () => {
  it('prioritizes blocked state before any other classification', () => {
    expect(
      resolveMediaCardState(
        createAsset(
          {
            uploadStatus: 'blocked',
            processingStatus: 'failed',
          },
          {
            title: '',
            altText: '',
          }
        ),
        0
      )
    ).toBe('blocked');
  });

  it('distinguishes unused, new, and ready assets', () => {
    expect(resolveMediaCardState(createAsset(), 0)).toBe('unused');
    expect(resolveMediaCardState(createAsset({}, { title: 'Hero', altText: '' }), 2)).toBe('new');
    expect(resolveMediaCardState(createAsset(), 2)).toBe('ready');
  });
});

describe('countMediaPriorityBuckets', () => {
  it('counts blocked, new, and unused assets from the derived usage map', () => {
    const blocked = createAsset({
      id: 'blocked',
      uploadStatus: 'failed',
      processingStatus: 'failed',
    });
    const fresh = createAsset({ id: 'fresh' }, { title: '', altText: 'Needs title' });
    const unused = createAsset({ id: 'unused' });
    const ready = createAsset({ id: 'ready' });

    expect(
      countMediaPriorityBuckets([blocked, fresh, unused, ready], {
        blocked: 2,
        fresh: 1,
        unused: 0,
        ready: 3,
      })
    ).toEqual({
      blocked: 1,
      newItems: 1,
      unused: 1,
    });
  });
});
