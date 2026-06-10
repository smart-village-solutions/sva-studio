import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CategoriesApiError,
  flattenCategoriesForTable,
  listCategories,
  type CategoryTreeItem,
} from '../src/categories.api.js';

const sampleTree: readonly CategoryTreeItem[] = [
  {
    id: 'cat-root',
    name: 'Service',
    iconName: 'folder',
    position: 1,
    tagList: 'amt, buerger',
    createdAt: '2026-06-09T10:00:00.000Z',
    updatedAt: '2026-06-09T10:15:00.000Z',
    children: [
      {
        id: 'cat-child',
        name: 'Buergerbuero',
        iconName: 'office',
        position: 2,
        tagList: 'vor-ort',
        createdAt: '2026-06-09T10:05:00.000Z',
        updatedAt: '2026-06-09T10:20:00.000Z',
        children: [
          {
            id: 'cat-leaf',
            name: 'Terminservice',
            position: 3,
            tagList: '',
            children: [],
          },
        ],
      },
    ],
  },
];

describe('plugin-categories api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('flattens hierarchical categories into table rows', () => {
    expect(flattenCategoriesForTable(sampleTree)).toEqual([
      {
        id: 'cat-root',
        categoryId: 'cat-root',
        actionTargetId: 'cat-root',
        name: 'Service',
        hierarchyLabel: '—',
        level: 0,
        iconName: 'folder',
        position: 1,
        tags: ['amt', 'buerger'],
        tagsDisplay: 'amt, buerger',
        createdAt: '2026-06-09T10:00:00.000Z',
        updatedAt: '2026-06-09T10:15:00.000Z',
      },
      {
        id: 'cat-child',
        categoryId: 'cat-child',
        actionTargetId: 'cat-child',
        name: 'Buergerbuero',
        hierarchyLabel: 'Service / Buergerbuero',
        level: 1,
        iconName: 'office',
        position: 2,
        tags: ['vor-ort'],
        tagsDisplay: 'vor-ort',
        createdAt: '2026-06-09T10:05:00.000Z',
        updatedAt: '2026-06-09T10:20:00.000Z',
      },
      {
        id: 'cat-leaf',
        categoryId: 'cat-leaf',
        actionTargetId: 'cat-leaf',
        name: 'Terminservice',
        hierarchyLabel: 'Service / Buergerbuero / Terminservice',
        level: 2,
        position: 3,
        tags: [],
        tagsDisplay: '—',
      },
    ]);
  });

  it('loads categories from the host endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: sampleTree,
      }),
    } as Response);

    await expect(listCategories()).resolves.toEqual(sampleTree);
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/mainserver/categories',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('surfaces stable typed errors for non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'forbidden',
        message: 'Keine Berechtigung.',
      }),
    } as Response);

    await expect(listCategories()).rejects.toMatchObject({
      name: 'CategoriesApiError',
      code: 'forbidden',
      message: 'Keine Berechtigung.',
    } satisfies Partial<CategoriesApiError>);
  });

  it('rejects malformed payloads with a typed error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { invalid: true },
      }),
    } as Response);

    await expect(listCategories()).rejects.toMatchObject({
      code: 'invalid_categories_payload',
      message: 'invalid_categories_payload',
    } satisfies Partial<CategoriesApiError>);
  });

  it('rejects malformed array members instead of dropping them', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          sampleTree[0],
          { id: 'broken-node', children: [] },
        ],
      }),
    } as Response);

    await expect(listCategories()).rejects.toMatchObject({
      code: 'invalid_categories_payload',
    } satisfies Partial<CategoriesApiError>);
  });

  it('rejects malformed nested children instead of dropping them', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            ...sampleTree[0],
            children: [
              {
                id: 'broken-child',
                position: 2,
                children: [],
              },
            ],
          },
        ],
      }),
    } as Response);

    await expect(listCategories()).rejects.toMatchObject({
      code: 'invalid_categories_payload',
    } satisfies Partial<CategoriesApiError>);
  });

  it('rejects categories without upstream ids', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            name: 'Service',
            children: [],
          },
        ],
      }),
    } as Response);

    await expect(listCategories()).rejects.toMatchObject({
      code: 'invalid_categories_payload',
    } satisfies Partial<CategoriesApiError>);
  });

  it('accepts duplicate-name siblings when their upstream ids are distinct', async () => {
    const duplicateNameTree: readonly CategoryTreeItem[] = [
      {
        id: 'cat-root',
        name: 'Service',
        children: [
          {
            id: 'cat-child-a',
            name: 'Beratung',
            children: [],
          },
          {
            id: 'cat-child-b',
            name: 'Beratung',
            children: [],
          },
        ],
      },
    ];

    expect(flattenCategoriesForTable(duplicateNameTree)).toEqual([
      {
        id: 'cat-root',
        categoryId: 'cat-root',
        actionTargetId: 'cat-root',
        name: 'Service',
        hierarchyLabel: '—',
        level: 0,
        tags: [],
        tagsDisplay: '—',
      },
      {
        id: 'cat-child-a',
        categoryId: 'cat-child-a',
        actionTargetId: 'cat-child-a',
        name: 'Beratung',
        hierarchyLabel: 'Service / Beratung',
        level: 1,
        tags: [],
        tagsDisplay: '—',
      },
      {
        id: 'cat-child-b',
        categoryId: 'cat-child-b',
        actionTargetId: 'cat-child-b',
        name: 'Beratung',
        hierarchyLabel: 'Service / Beratung',
        level: 1,
        tags: [],
        tagsDisplay: '—',
      },
    ]);
  });
});
