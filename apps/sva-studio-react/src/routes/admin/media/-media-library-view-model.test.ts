import { describe, expect, it } from 'vitest';

import type { IamMediaAsset } from '../../../lib/iam-api';

import {
  countMediaPriorityBuckets,
  resolveMediaCardState,
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
    expect(resolveMediaCardState(createAsset(), 0, 'ready')).toBe('unused');
    expect(resolveMediaCardState(createAsset({}, { title: 'Hero', altText: '' }), 2, 'ready')).toBe('new');
    expect(resolveMediaCardState(createAsset(), 2, 'ready')).toBe('ready');
    expect(resolveMediaCardState(createAsset(), null, 'loading')).toBe('ready');
    expect(resolveMediaCardState(createAsset(), null, 'unavailable')).toBe('ready');
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
      }, {
        blocked: 'ready',
        fresh: 'ready',
        unused: 'ready',
        ready: 'ready',
      })
    ).toEqual({
      blocked: 1,
      newItems: 1,
      unused: 1,
    });
  });

  it('does not classify assets with unknown usage counts as unused', () => {
    const uncertain = createAsset({ id: 'uncertain' });

    expect(
      countMediaPriorityBuckets([uncertain], {
        uncertain: null,
      }, {
        uncertain: 'unavailable',
      })
    ).toEqual({
      blocked: 0,
      newItems: 0,
      unused: 0,
    });
  });
});
