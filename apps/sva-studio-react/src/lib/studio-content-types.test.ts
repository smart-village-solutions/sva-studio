import type { IamContentListItem } from '@sva/core';
import type { RegisteredStudioContentType } from '@sva/plugin-sdk';
import { describe, expect, it } from 'vitest';

import {
  filterCreatableStudioContentTypes,
  filterRegisteredStudioContentItems,
  resolveStudioContentEditPath,
} from './studio-content-types';

const studioContentTypes: readonly RegisteredStudioContentType[] = [
  {
    contentType: 'news.article',
    displayName: 'News',
    description: 'Artikel',
    requiredReadAction: 'news.read',
    requiredCreateAction: 'news.create',
    createPath: '/admin/content/new?type=news.article',
    detailPath: '/admin/news/$id',
  },
  {
    contentType: 'events.event-record',
    displayName: 'Events',
    requiredReadAction: 'events.read',
    requiredCreateAction: 'events.create',
    createPath: '/admin/content/new?type=events.event-record',
    detailPath: '/admin/events/$id',
  },
] as const;

const item = (overrides: Partial<IamContentListItem>): IamContentListItem =>
  ({
    id: 'content-1',
    contentType: 'news.article',
    instanceId: 'instance-1',
    title: 'Startseite',
    createdAt: '2026-05-24T08:00:00.000Z',
    createdBy: 'system',
    updatedAt: '2026-05-24T09:00:00.000Z',
    updatedBy: 'system',
    authorDisplayMode: 'organization',
    author: 'System',
    payload: {},
    status: 'draft',
    validationState: 'valid',
    historyRef: 'history-1',
    ...overrides,
  }) satisfies IamContentListItem;

describe('studio content type helpers', () => {
  it('filters creatable content types by granted actions', () => {
    expect(filterCreatableStudioContentTypes(studioContentTypes, ['events.read', 'events.create'])).toEqual([
      studioContentTypes[1],
    ]);
  });

  it('filters list items to registered and readable content types only', () => {
    expect(
      filterRegisteredStudioContentItems(
        [
          item({ id: 'news-1', contentType: 'news.article' }),
          item({ id: 'events-1', contentType: 'events.event-record' }),
          item({ id: 'legal-1', contentType: 'legal.text' }),
        ],
        studioContentTypes,
        ['news.read']
      ).map((entry) => entry.item.id)
    ).toEqual(['news-1']);
  });

  it('resolves the type-specific edit path for a registered content item', () => {
    expect(resolveStudioContentEditPath(item({ id: 'news-7' }), studioContentTypes)).toBe('/admin/news/news-7');
  });
});
