import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPoi, listPoi, PoiApiError } from '../src/poi.api.js';

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

    await createPoi({ name: 'Rathaus' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/mainserver/poi',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Rathaus' }) })
    );
  });

  it('throws stable errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'forbidden', message: 'Nope' }, { status: 403 })));

    await expect(listPoi({ page: 1, pageSize: 25 })).rejects.toBeInstanceOf(PoiApiError);
  });
});
