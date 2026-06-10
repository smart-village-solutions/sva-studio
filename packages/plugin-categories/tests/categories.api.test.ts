import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CategoriesApiError,
  flattenCategoriesForTable,
  listCategories,
  type CategoryListItem,
} from '../src/categories.api.js';

const sampleCategories: readonly CategoryListItem[] = [
  {
    id: 'cat-root',
    name: 'Service',
    position: 1,
    tagList: 'amt, buerger',
  },
  {
    id: 'cat-child',
    name: 'Buergerbuero',
    position: 2,
    tagList: 'vor-ort',
    parent: {
      name: 'Service',
    },
  },
  {
    id: 'cat-leaf',
    name: 'Terminservice',
    position: 3,
    tagList: '',
    parent: {
      name: 'Buergerbuero',
    },
  },
];

describe('plugin-categories api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps flat categories into table rows', () => {
    expect(flattenCategoriesForTable(sampleCategories)).toEqual([
      {
        id: 'cat-root',
        categoryId: 'cat-root',
        actionTargetId: 'cat-root',
        name: 'Service',
        hierarchyLabel: '—',
        level: 0,
        position: 1,
        tags: ['amt', 'buerger'],
        tagsDisplay: 'amt, buerger',
      },
      {
        id: 'cat-child',
        categoryId: 'cat-child',
        actionTargetId: 'cat-child',
        name: 'Buergerbuero',
        hierarchyLabel: 'Service',
        level: 0,
        position: 2,
        tags: ['vor-ort'],
        tagsDisplay: 'vor-ort',
      },
      {
        id: 'cat-leaf',
        categoryId: 'cat-leaf',
        actionTargetId: 'cat-leaf',
        name: 'Terminservice',
        hierarchyLabel: 'Buergerbuero',
        level: 0,
        position: 3,
        tags: [],
        tagsDisplay: '—',
      },
    ]);
  });

  it('loads flat categories from the host endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: sampleCategories,
      }),
    } as Response);

    await expect(listCategories()).resolves.toEqual(sampleCategories);
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/mainserver/categories',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('accepts optional parent, trims optional strings, and supports a custom fetch implementation', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'cat-root',
            name: 'Service',
            tagList: '',
            parent: {
              name: '   ',
            },
          },
        ],
      }),
    } as Response);

    await expect(listCategories(customFetch)).resolves.toEqual([
      {
        id: 'cat-root',
        name: 'Service',
        tagList: '',
      },
    ]);

    expect(customFetch).toHaveBeenCalledWith(
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
          sampleCategories[0],
          { id: 'broken-node' },
        ],
      }),
    } as Response);

    await expect(listCategories()).rejects.toMatchObject({
      code: 'invalid_categories_payload',
    } satisfies Partial<CategoriesApiError>);
  });

  it('rejects malformed parent and position payload fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'cat-root',
            name: 'Service',
            parent: 'invalid-parent',
            position: Number.NaN,
          },
        ],
      }),
    } as Response);

    await expect(listCategories()).rejects.toMatchObject({
      code: 'invalid_categories_payload',
    } satisfies Partial<CategoriesApiError>);
  });

  it('rejects malformed optional string fields but tolerates blank parent names and tag lists', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'cat-root',
              name: 'Service',
              parent: { name: '   ' },
              tagList: 12,
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'cat-root',
              name: 'Service',
              parent: { name: '   ' },
              tagList: '   ',
            },
          ],
        }),
      } as Response);

    await expect(listCategories()).rejects.toMatchObject({
      code: 'invalid_categories_payload',
    } satisfies Partial<CategoriesApiError>);

    await expect(listCategories()).resolves.toEqual([
      {
        id: 'cat-root',
        name: 'Service',
        tagList: '',
      },
    ]);
  });

  it('rejects categories without upstream ids', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            name: 'Service',
          },
        ],
      }),
    } as Response);

    await expect(listCategories()).rejects.toMatchObject({
      code: 'invalid_categories_payload',
    } satisfies Partial<CategoriesApiError>);
  });

  it('accepts duplicate-name siblings when their upstream ids are distinct', async () => {
    const duplicateNameCategories: readonly CategoryListItem[] = [
      {
        id: 'cat-child-a',
        name: 'Beratung',
        parent: {
          name: 'Service',
        },
      },
      {
        id: 'cat-child-b',
        name: 'Beratung',
        parent: {
          name: 'Service',
        },
      },
    ];

    expect(flattenCategoriesForTable(duplicateNameCategories)).toEqual([
      {
        id: 'cat-child-a',
        categoryId: 'cat-child-a',
        actionTargetId: 'cat-child-a',
        name: 'Beratung',
        hierarchyLabel: 'Service',
        level: 0,
        tags: [],
        tagsDisplay: '—',
      },
      {
        id: 'cat-child-b',
        categoryId: 'cat-child-b',
        actionTargetId: 'cat-child-b',
        name: 'Beratung',
        hierarchyLabel: 'Service',
        level: 0,
        tags: [],
        tagsDisplay: '—',
      },
    ]);
  });
});
