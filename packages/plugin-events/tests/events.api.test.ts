import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEvent, EventsApiError, listEvents, listPoiForEventSelection } from '../src/events.api.js';

describe('events api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists events from the host facade', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [{ id: 'event-1', title: 'Stadtfest' }],
        pagination: { page: 2, pageSize: 50, hasNextPage: true },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(listEvents({ page: 2, pageSize: 50 })).resolves.toEqual({
      data: [{ id: 'event-1', title: 'Stadtfest' }],
      pagination: { page: 2, pageSize: 50, hasNextPage: true },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/mainserver/events?page=2&pageSize=50',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('creates events via POST', async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: { id: 'event-1', title: 'Stadtfest' } }));
    vi.stubGlobal('fetch', fetchMock);

    await createEvent({ title: 'Stadtfest' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/mainserver/events',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ title: 'Stadtfest' }) })
    );
  });

  it('maps POI selection items through the POI facade', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            data: [{ id: 'poi-1', name: 'Rathaus' }],
            pagination: { page: 1, pageSize: 100, hasNextPage: true },
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            data: [{ id: 'poi-2', name: 'Markt' }],
            pagination: { page: 2, pageSize: 100, hasNextPage: false },
          })
        )
    );

    await expect(listPoiForEventSelection()).resolves.toEqual([
      { id: 'poi-1', name: 'Rathaus' },
      { id: 'poi-2', name: 'Markt' },
    ]);
  });

  it('stops POI selection pagination when the upstream page is empty despite hasNextPage', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            data: [{ id: 'poi-1', name: 'Rathaus' }],
            pagination: { page: 1, pageSize: 100, hasNextPage: true },
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            data: [],
            pagination: { page: 2, pageSize: 100, hasNextPage: true },
          })
        )
    );

    await expect(listPoiForEventSelection()).resolves.toEqual([{ id: 'poi-1', name: 'Rathaus' }]);
  });

  it('includes the last allowed POI selection page', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const page = Number(new URL(url, 'https://studio.test').searchParams.get('page'));

      return Response.json({
        data: [{ id: `poi-${page}`, name: `POI ${page}` }],
        pagination: { page, pageSize: 100, hasNextPage: page < 101 },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const items = await listPoiForEventSelection();

    expect(items).toHaveLength(101);
    expect(items[0]).toEqual({ id: 'poi-1', name: 'POI 1' });
    expect(items.at(-1)).toEqual({ id: 'poi-101', name: 'POI 101' });
  });

  it('fails instead of silently truncating when POI selection pagination exceeds the maximum page budget', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const page = Number(new URL(url, 'https://studio.test').searchParams.get('page'));

        return Response.json({
          data: [{ id: `poi-${page}`, name: `POI ${page}` }],
          pagination: { page, pageSize: 100, hasNextPage: true },
        });
      })
    );

    await expect(listPoiForEventSelection()).rejects.toMatchObject<EventsApiError>({
      code: 'poi_selection_page_limit_exceeded',
    });
  });

  it('throws stable errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'forbidden', message: 'Nope' }, { status: 403 })));

    await expect(listEvents({ page: 1, pageSize: 25 })).rejects.toBeInstanceOf(EventsApiError);
  });
});
