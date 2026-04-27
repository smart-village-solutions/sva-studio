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
    public constructor(
      public readonly code: string,
      message = code,
      public readonly statusCode?: number
    ) {
      super(message);
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
