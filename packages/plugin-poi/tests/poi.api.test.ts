import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPoi, updatePoi, listPoi, listPoiCategories, PoiApiError } from '../src/poi.api.js';

const defaultListQuery = {
  page: 1,
  pageSize: 25,
} as const;

describe('poi api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists POI from the host facade', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [{ id: 'poi-1', name: 'Rathaus' }],
        pagination: { page: 2, pageSize: 50, hasNextPage: true },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(listPoi({ page: 2, pageSize: 50 })).resolves.toEqual({
      data: [{ id: 'poi-1', name: 'Rathaus' }],
      pagination: { page: 2, pageSize: 50, hasNextPage: true },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/mainserver/poi?page=2&pageSize=50',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('creates POI via POST', async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: { id: 'poi-1', name: 'Rathaus' } }));
    vi.stubGlobal('fetch', fetchMock);

    await createPoi({ name: 'Rathaus' }, 'organization');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/mainserver/poi',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Rathaus' }) })
    );
    const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);
    expect(headers.get('X-SVA-Acting-Principal-Type')).toBe('organization');
    expect(headers.get('X-SVA-Mainserver-Contract-Version')).toBe('2');
  });

  it('lists poi categories from the categories route', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: [{ id: 'cat-1', name: 'Verwaltung' }] })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(listPoiCategories()).resolves.toEqual([{ id: 'cat-1', name: 'Verwaltung' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/mainserver/categories?dataType=point_of_interest',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('throws stable errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'forbidden', message: 'Nope' }, { status: 403 }))
    );

    await expect(listPoi({ page: 1, pageSize: 25 })).rejects.toBeInstanceOf(PoiApiError);
  });
  it('confirms the full voucher reset before committing a location update', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === undefined)
        return Response.json(
          { data: { id: 'voucher-poi-1', name: 'Ort' } },
          { headers: { 'X-SVA-Context-Binding': 'v1.context' } }
        );
      const headers = new Headers(init.headers);
      if (headers.has('X-SVA-Voucher-Reset-Mode'))
        return Response.json({
          voucherReset: {
            required: true,
            id: 'attempt',
            fingerprint: 'snapshot',
            affected: [{ title: 'Alt' }],
          },
        });
      expect(headers.get('X-SVA-Voucher-Reset-Id')).toBe('attempt');
      return Response.json({ data: { id: 'voucher-poi-1', name: 'Neu' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirm);
    await expect(
      updatePoi('voucher-poi-1', { name: 'Neu' }, 'organization')
    ).resolves.toMatchObject({ name: 'Neu' });
    expect(confirm).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('does not mutate when the editor cancels a voucher reset', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) =>
      init?.method === undefined
        ? Response.json(
            { data: { id: 'voucher-poi-2', name: 'Ort' } },
            { headers: { 'X-SVA-Context-Binding': 'v1.context' } }
          )
        : Response.json({
            voucherReset: { required: true, id: 'attempt', fingerprint: 'snapshot', affected: [] },
          })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', () => false);
    await expect(updatePoi('voucher-poi-2', { name: 'Neu' }, 'organization')).rejects.toMatchObject(
      { code: 'voucher_reset_cancelled' }
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
