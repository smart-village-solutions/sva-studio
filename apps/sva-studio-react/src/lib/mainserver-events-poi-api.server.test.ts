import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  authorizeContentPrimitiveForUser: vi.fn(),
  validateCsrf: vi.fn(),
  createSvaMainserverEvent: vi.fn(),
  updateSvaMainserverEvent: vi.fn(),
  createSvaMainserverPoi: vi.fn(),
  updateSvaMainserverPoi: vi.fn(),
  listSvaMainserverEvents: vi.fn(),
  getSvaMainserverEvent: vi.fn(),
  deleteSvaMainserverEvent: vi.fn(),
  listSvaMainserverPoi: vi.fn(),
  getSvaMainserverPoi: vi.fn(),
  deleteSvaMainserverPoi: vi.fn(),
  createSdkLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn() })),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1', traceId: 'trace-1' })),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
  validateCsrf: state.validateCsrf,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: state.createSdkLogger,
  getWorkspaceContext: state.getWorkspaceContext,
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  SvaMainserverError: class SvaMainserverError extends Error {
    public readonly code: string;
    public readonly statusCode?: number;

    public constructor(input: { readonly code: string; readonly message: string; readonly statusCode?: number }) {
      super(input.message);
      this.code = input.code;
      this.statusCode = input.statusCode;
    }
  },
  createSvaMainserverEvent: state.createSvaMainserverEvent,
  updateSvaMainserverEvent: state.updateSvaMainserverEvent,
  createSvaMainserverPoi: state.createSvaMainserverPoi,
  updateSvaMainserverPoi: state.updateSvaMainserverPoi,
  listSvaMainserverEvents: state.listSvaMainserverEvents,
  getSvaMainserverEvent: state.getSvaMainserverEvent,
  deleteSvaMainserverEvent: state.deleteSvaMainserverEvent,
  listSvaMainserverPoi: state.listSvaMainserverPoi,
  getSvaMainserverPoi: state.getSvaMainserverPoi,
  deleteSvaMainserverPoi: state.deleteSvaMainserverPoi,
}));

import { SvaMainserverError } from '@sva/sva-mainserver/server';
import { dispatchMainserverEventsPoiRequest } from './mainserver-events-poi-api.server';

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'subject-1',
    email: 'editor@example.invalid',
    displayName: 'Editor',
    roles: ['editor'],
    instanceId: 'de-musterhausen',
  },
};

const createRequest = (url: string, init?: RequestInit): Request =>
  new Request(url, {
    ...init,
    headers: {
      Origin: 'https://studio.test',
      'X-Requested-With': 'XMLHttpRequest',
      ...(init?.headers ?? {}),
    },
  });

const mockAuthorizedMutation = () => {
  state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
  state.validateCsrf.mockReturnValue(null);
  state.authorizeContentPrimitiveForUser.mockResolvedValue({
    ok: true,
    actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
    permissions: [],
  });
};

describe('dispatchMainserverEventsPoiRequest', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('ignores unrelated routes', async () => {
    const response = await dispatchMainserverEventsPoiRequest(createRequest('https://studio.test/api/v1/mainserver/news'));

    expect(response).toBeNull();
    expect(state.withAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('lists events and POI after read authorization', async () => {
    mockAuthorizedMutation();
    state.listSvaMainserverEvents.mockResolvedValue([{ id: 'event-1' }]);
    state.listSvaMainserverPoi.mockResolvedValue([{ id: 'poi-1' }]);

    const eventsResponse = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/events')
    );
    const poiResponse = await dispatchMainserverEventsPoiRequest(createRequest('https://studio.test/api/v1/mainserver/poi'));

    expect(eventsResponse?.status).toBe(200);
    await expect(eventsResponse?.json()).resolves.toEqual({ data: [{ id: 'event-1' }] });
    expect(poiResponse?.status).toBe(200);
    await expect(poiResponse?.json()).resolves.toEqual({ data: [{ id: 'poi-1' }] });
    expect(state.listSvaMainserverEvents).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
    });
    expect(state.listSvaMainserverPoi).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
    });
  });

  it('reads event and POI details after item authorization', async () => {
    mockAuthorizedMutation();
    state.getSvaMainserverEvent.mockResolvedValue({ id: 'event-1' });
    state.getSvaMainserverPoi.mockResolvedValue({ id: 'poi-1' });

    const eventsResponse = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/events/event-1')
    );
    const poiResponse = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/poi/poi-1')
    );

    expect(eventsResponse?.status).toBe(200);
    expect(poiResponse?.status).toBe(200);
    expect(state.getSvaMainserverEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-1', instanceId: 'de-musterhausen' })
    );
    expect(state.getSvaMainserverPoi).toHaveBeenCalledWith(
      expect.objectContaining({ poiId: 'poi-1', instanceId: 'de-musterhausen' })
    );
  });

  it('creates events with parsed dates, contact, URLs, addresses, recurrence and POI link', async () => {
    mockAuthorizedMutation();
    state.createSvaMainserverEvent.mockResolvedValue({ id: 'event-1' });

    const response = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/events', {
        method: 'POST',
        body: JSON.stringify({
          title: ' Stadtfest ',
          description: 'Sommerprogramm',
          externalId: 'ext-1',
          keywords: 'stadt,fest',
          repeat: true,
          categoryName: 'Kultur',
          dates: [
            {
              weekday: 'Samstag',
              dateStart: '2026-06-06',
              dateEnd: '2026-06-07',
              timeStart: '10:00',
              timeEnd: '20:00',
              timeDescription: 'ganztägig',
              useOnlyTimeDescription: false,
            },
            null,
          ],
          categories: [{ name: 'Festival' }],
          addresses: [
            {
              id: '42',
              addition: 'Marktplatz',
              street: 'Markt 1',
              zip: '12345',
              city: 'Musterhausen',
              kind: 'venue',
              geoLocation: { latitude: '52.5', longitude: '13.4' },
            },
          ],
          contact: {
            firstName: 'Erika',
            lastName: 'Mustermann',
            phone: '+49 30 123',
            fax: '+49 30 456',
            email: 'event@example.invalid',
            webUrls: [{ url: 'https://example.invalid/contact', description: 'Kontakt' }],
          },
          urls: [{ url: 'https://example.invalid/event', description: 'Programm' }],
          tags: [' draußen ', '', 7],
          recurring: 'weekly',
          recurringType: 'weekday',
          recurringInterval: '1',
          recurringWeekdays: [' sa ', '', 0],
          pointOfInterestId: 'poi-1',
          pushNotification: true,
        }),
      })
    );

    expect(response?.status).toBe(201);
    expect(state.createSvaMainserverEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: {
          title: 'Stadtfest',
          description: 'Sommerprogramm',
          externalId: 'ext-1',
          keywords: 'stadt,fest',
          dates: [
            {
              weekday: 'Samstag',
              dateStart: '2026-06-06',
              dateEnd: '2026-06-07',
              timeStart: '10:00',
              timeEnd: '20:00',
              timeDescription: 'ganztägig',
              useOnlyTimeDescription: false,
            },
          ],
          repeat: true,
          categoryName: 'Kultur',
          categories: [{ name: 'Festival' }],
          addresses: [
            {
              id: 42,
              addition: 'Marktplatz',
              street: 'Markt 1',
              zip: '12345',
              city: 'Musterhausen',
              kind: 'venue',
              geoLocation: { latitude: 52.5, longitude: 13.4 },
            },
          ],
          contacts: [
            {
              firstName: 'Erika',
              lastName: 'Mustermann',
              phone: '+49 30 123',
              fax: '+49 30 456',
              email: 'event@example.invalid',
              webUrls: [{ url: 'https://example.invalid/contact', description: 'Kontakt' }],
            },
          ],
          urls: [{ url: 'https://example.invalid/event', description: 'Programm' }],
          tags: ['draußen'],
          recurring: 'weekly',
          recurringType: 'weekday',
          recurringInterval: '1',
          recurringWeekdays: ['sa'],
          pointOfInterestId: 'poi-1',
          pushNotification: true,
        },
      })
    );
  });

  it('updates POI with parsed optional fields, payload, contact, URLs and addresses', async () => {
    mockAuthorizedMutation();
    state.updateSvaMainserverPoi.mockResolvedValue({ id: 'poi-1' });

    const response = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/poi/poi-1', {
        method: 'PATCH',
        body: JSON.stringify({
          name: ' Rathaus ',
          description: 'Zentrale Verwaltung',
          mobileDescription: 'Kurzinfo',
          externalId: 'poi-ext-1',
          keywords: 'service',
          active: false,
          categoryName: 'Verwaltung',
          payload: { source: 'cms' },
          categories: [{ name: 'Bürgerbüro' }],
          addresses: [{ street: 'Rathausplatz 1', city: 'Musterhausen' }],
          contact: { email: 'poi@example.invalid' },
          webUrls: [{ url: 'https://example.invalid/poi' }],
          tags: [' amt '],
        }),
      })
    );

    expect(response?.status).toBe(200);
    expect(state.updateSvaMainserverPoi).toHaveBeenCalledWith(
      expect.objectContaining({
        poiId: 'poi-1',
        poi: {
          name: 'Rathaus',
          description: 'Zentrale Verwaltung',
          mobileDescription: 'Kurzinfo',
          externalId: 'poi-ext-1',
          keywords: 'service',
          active: false,
          categoryName: 'Verwaltung',
          payload: { source: 'cms' },
          categories: [{ name: 'Bürgerbüro' }],
          addresses: [{ street: 'Rathausplatz 1', city: 'Musterhausen' }],
          contact: { email: 'poi@example.invalid' },
          webUrls: [{ url: 'https://example.invalid/poi' }],
          tags: ['amt'],
        },
      })
    );
  });

  it('deletes event and POI items after delete authorization', async () => {
    mockAuthorizedMutation();
    state.deleteSvaMainserverEvent.mockResolvedValue({ id: 'event-1', deleted: true });
    state.deleteSvaMainserverPoi.mockResolvedValue({ id: 'poi-1', deleted: true });

    const eventResponse = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/events/event-1', { method: 'DELETE' })
    );
    const poiResponse = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/poi/poi-1', { method: 'DELETE' })
    );

    expect(eventResponse?.status).toBe(200);
    expect(poiResponse?.status).toBe(200);
    expect(state.deleteSvaMainserverEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-1', instanceId: 'de-musterhausen' })
    );
    expect(state.deleteSvaMainserverPoi).toHaveBeenCalledWith(
      expect.objectContaining({ poiId: 'poi-1', instanceId: 'de-musterhausen' })
    );
  });

  it('rejects mutation requests when CSRF validation fails', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(new Response('CSRF', { status: 403 }));

    const response = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/events', {
        method: 'POST',
        body: JSON.stringify({ title: 'Stadtfest' }),
      })
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({ error: 'csrf_validation_failed' });
    expect(state.authorizeContentPrimitiveForUser).not.toHaveBeenCalled();
  });

  it('returns local authorization errors before calling GraphQL', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Forbidden',
    });

    const response = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/poi/poi-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Rathaus' }),
      })
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: 'forbidden', message: 'Forbidden' });
    expect(state.updateSvaMainserverPoi).not.toHaveBeenCalled();
  });

  it.each([
    ['non-object event body', 'events', { method: 'POST', body: JSON.stringify(null) }],
    ['missing event title', 'events', { method: 'POST', body: JSON.stringify({ description: 'ohne Titel' }) }],
    ['missing POI name', 'poi', { method: 'POST', body: JSON.stringify({ description: 'ohne Name' }) }],
    ['non-list POI URLs', 'poi', { method: 'POST', body: JSON.stringify({ name: 'Rathaus', webUrls: 'https://bad' }) }],
    [
      'non-HTTPS event URL',
      'events',
      { method: 'POST', body: JSON.stringify({ title: 'Stadtfest', urls: [{ url: 'http://example.invalid' }] }) },
    ],
    [
      'invalid event address item',
      'events',
      { method: 'POST', body: JSON.stringify({ title: 'Stadtfest', addresses: ['Marktplatz'] }) },
    ],
    [
      'invalid event geo coordinates',
      'events',
      {
        method: 'POST',
        body: JSON.stringify({ title: 'Stadtfest', addresses: [{ geoLocation: { latitude: 91, longitude: 13 } }] }),
      },
    ],
    ['invalid event contact', 'events', { method: 'POST', body: JSON.stringify({ title: 'Stadtfest', contact: 'Team' }) }],
    ['invalid event tags', 'events', { method: 'POST', body: JSON.stringify({ title: 'Stadtfest', tags: 'sommer' }) }],
    [
      'invalid category item',
      'poi',
      { method: 'POST', body: JSON.stringify({ name: 'Rathaus', categories: ['Verwaltung'] }) },
    ],
    [
      'invalid category name',
      'poi',
      { method: 'POST', body: JSON.stringify({ name: 'Rathaus', categories: [{ name: '' }] }) },
    ],
  ])('rejects invalid request payloads: %s', async (_label, path, init) => {
    mockAuthorizedMutation();

    const response = await dispatchMainserverEventsPoiRequest(
      createRequest(`https://studio.test/api/v1/mainserver/${path}`, init)
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ error: 'invalid_request' });
    expect(state.createSvaMainserverEvent).not.toHaveBeenCalled();
    expect(state.createSvaMainserverPoi).not.toHaveBeenCalled();
  });

  it('returns method-not-allowed for unsupported route methods', async () => {
    mockAuthorizedMutation();

    const response = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/events', { method: 'PUT' })
    );

    expect(response?.status).toBe(405);
    await expect(response?.json()).resolves.toEqual({
      error: 'method_not_allowed',
      message: 'Methode wird für diesen Mainserver-Inhalt nicht unterstützt.',
    });
  });

  it('maps upstream and unexpected errors without leaking internal details', async () => {
    mockAuthorizedMutation();
    state.listSvaMainserverEvents.mockRejectedValueOnce(
      new SvaMainserverError({ code: 'forbidden', message: 'Kein Zugriff' })
    );
    state.listSvaMainserverEvents.mockRejectedValueOnce(new Error('database password leaked'));

    const forbiddenResponse = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/events')
    );
    const internalResponse = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/events')
    );

    expect(forbiddenResponse?.status).toBe(403);
    await expect(forbiddenResponse?.json()).resolves.toEqual({ error: 'forbidden', message: 'Kein Zugriff' });
    expect(internalResponse?.status).toBe(500);
    await expect(internalResponse?.json()).resolves.toEqual({
      error: 'internal_error',
      message: 'Mainserver-Anfrage ist fehlgeschlagen.',
    });
  });

  it('keeps nested event category children when parsing mutations', async () => {
    mockAuthorizedMutation();
    state.updateSvaMainserverEvent.mockResolvedValue({ id: 'event-1' });

    const response = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/events/event-1', {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Stadtfest',
          categories: [
            {
              name: ' Kultur ',
              payload: { color: 'green' },
              children: [{ name: ' Bühne ' }],
            },
          ],
        }),
      })
    );

    expect(response?.status).toBe(200);
    expect(state.updateSvaMainserverEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          categories: [{ name: 'Kultur', payload: { color: 'green' }, children: [{ name: 'Bühne' }] }],
        }),
      })
    );
  });

  it('keeps nested POI category children when parsing mutations', async () => {
    mockAuthorizedMutation();
    state.createSvaMainserverPoi.mockResolvedValue({ id: 'poi-1' });

    const response = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/poi', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Rathaus',
          categories: [{ name: 'Verwaltung', children: [{ name: 'Service' }] }],
        }),
      })
    );

    expect(response?.status).toBe(201);
    expect(state.createSvaMainserverPoi).toHaveBeenCalledWith(
      expect.objectContaining({
        poi: expect.objectContaining({
          categories: [{ name: 'Verwaltung', children: [{ name: 'Service' }] }],
        }),
      })
    );
  });

  it('rejects invalid nested category children before GraphQL', async () => {
    mockAuthorizedMutation();

    const response = await dispatchMainserverEventsPoiRequest(
      createRequest('https://studio.test/api/v1/mainserver/poi', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Rathaus',
          categories: [{ name: 'Verwaltung', children: 'Service' }],
        }),
      })
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ error: 'invalid_request' });
    expect(state.createSvaMainserverPoi).not.toHaveBeenCalled();
  });
});
