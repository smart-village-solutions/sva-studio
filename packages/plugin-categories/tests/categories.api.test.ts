import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CategoriesApiError,
  deleteCategory,
  flattenCategoryManagementForTable,
  flattenCategoriesForTable,
  listCategoryManagement,
  listCategories,
  saveCategory,
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
        data: [sampleCategories[0], { id: 'broken-node' }],
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

  it('loads and stably flattens active and inactive management categories', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'cat-b',
            name: 'Beratung',
            active: false,
            children: [],
            dataTypes: ['news_item'],
            position: 2,
            createdAt: '2026-09-01T08:00:00.000Z',
            updatedAt: '2026-09-02T09:00:00.000Z',
          },
          {
            id: 'cat-a',
            name: 'Allgemein',
            active: true,
            children: [],
            dataTypes: [],
            position: 2,
          },
        ],
      }),
    } as Response);

    const categories = await listCategoryManagement();
    expect(categories).toHaveLength(2);
    expect(categories[0]).toMatchObject({
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-02T09:00:00.000Z',
    });
    expect(flattenCategoryManagementForTable(categories).map((entry) => entry.id)).toEqual([
      'cat-a',
      'cat-b',
    ]);
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/mainserver/categories?view=management',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('normalizes category save responses and sends a create idempotency key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        category: {
          id: 'cat-1',
          name: 'Neu',
          active: true,
          children: [],
          dataTypes: ['news_item'],
        },
        affectedDescendantIds: [],
        errors: [],
      }),
    } as Response);

    await expect(
      saveCategory({
        category: {
          name: 'Neu',
          active: true,
          parentId: null,
          position: null,
          iconName: null,
          email: null,
          dataTypes: ['news_item'],
        },
        idempotencyKey: 'create-1',
        fetch: fetchImpl,
      })
    ).resolves.toMatchObject({ category: { id: 'cat-1' }, errors: [] });
    const [, request] = fetchImpl.mock.calls[0] ?? [];
    expect(request).toMatchObject({ method: 'POST' });
    expect(new Headers((request as RequestInit).headers).get('Idempotency-Key')).toBe('create-1');
  });

  it('preserves structured delete usage and rejects malformed mutation payloads', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          deletedCategoryId: null,
          usage: {
            children: 1,
            resourceAssignments: 2,
            externalServiceAssignments: 0,
            dataResourceSettings: 0,
            notificationConfigurations: 3,
          },
          errors: [{ code: 'CATEGORY_IN_USE', field: 'id', message: 'In Verwendung' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ category: { id: 'cat-1' }, affectedDescendantIds: [], errors: [] }),
      } as Response);

    await expect(deleteCategory('cat-1', fetchImpl)).resolves.toMatchObject({
      usage: { children: 1, resourceAssignments: 2, notificationConfigurations: 3 },
      errors: [{ code: 'CATEGORY_IN_USE', field: 'id' }],
    });
    await expect(
      saveCategory({
        id: 'cat-1',
        category: {
          name: 'Neu',
          active: true,
          parentId: null,
          position: null,
          iconName: null,
          email: null,
          dataTypes: [],
        },
        fetch: fetchImpl,
      })
    ).rejects.toMatchObject({ code: 'invalid_categories_payload' });
  });
});
