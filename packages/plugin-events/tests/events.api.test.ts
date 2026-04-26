import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEvent, EventsApiError, listEvents, listPoiForEventSelection } from '../src/events.api.js';

describe('events api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists events from the host facade', async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: [{ id: 'event-1', title: 'Stadtfest' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listEvents()).resolves.toEqual([{ id: 'event-1', title: 'Stadtfest' }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/mainserver/events', expect.objectContaining({ credentials: 'include' }));
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
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: [{ id: 'poi-1', name: 'Rathaus' }] })));

    await expect(listPoiForEventSelection()).resolves.toEqual([{ id: 'poi-1', name: 'Rathaus' }]);
  });

  it('throws stable errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'forbidden', message: 'Nope' }, { status: 403 })));

    await expect(listEvents()).rejects.toBeInstanceOf(EventsApiError);
  });
});
