import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGenericItem, listGenericItemCategories, listGenericItems } from '../src/generic-items.api.js';

describe('generic items api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists generic items from the host facade', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [{ id: 'generic-1', title: 'Freier Eintrag' }],
        pagination: { page: 2, pageSize: 50, hasNextPage: true },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(listGenericItems({ page: 2, pageSize: 50 })).resolves.toEqual({
      data: [{ id: 'generic-1', title: 'Freier Eintrag' }],
      pagination: { page: 2, pageSize: 50, hasNextPage: true },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/mainserver/generic-items?page=2&pageSize=50',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('creates generic items via POST', async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: { id: 'generic-1', title: 'Freier Eintrag' } }));
    vi.stubGlobal('fetch', fetchMock);

    await createGenericItem({ title: 'Freier Eintrag', genericType: 'faq' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/mainserver/generic-items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'Freier Eintrag', genericType: 'faq' }),
      })
    );
  });

  it('loads category options from the host facade', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [{ id: 'cat-1', name: 'Rathaus' }],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(listGenericItemCategories()).resolves.toEqual([{ id: 'cat-1', name: 'Rathaus' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/mainserver/categories',
      expect.objectContaining({ credentials: 'include' })
    );
  });
});
