import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  authorizeContentPrimitiveForUser: vi.fn(),
  validateCsrf: vi.fn(),
  createSvaMainserverGenericItem: vi.fn(),
  updateSvaMainserverGenericItem: vi.fn(),
  listSvaMainserverGenericItems: vi.fn(),
  getSvaMainserverGenericItem: vi.fn(),
  deleteSvaMainserverGenericItem: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  createSdkLogger: vi.fn(() => ({ info: state.loggerInfo, warn: state.loggerWarn })),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1', traceId: 'trace-1' })),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
  validateCsrf: state.validateCsrf,
}));

vi.mock('@sva/server-runtime', async () => {
  const actual = await vi.importActual<typeof import('@sva/server-runtime')>('@sva/server-runtime');
  return {
    ...actual,
    createSdkLogger: state.createSdkLogger,
    getWorkspaceContext: state.getWorkspaceContext,
  };
});

vi.mock('./service.js', () => ({
  createSvaMainserverGenericItem: state.createSvaMainserverGenericItem,
  updateSvaMainserverGenericItem: state.updateSvaMainserverGenericItem,
  listSvaMainserverGenericItems: state.listSvaMainserverGenericItems,
  getSvaMainserverGenericItem: state.getSvaMainserverGenericItem,
  deleteSvaMainserverGenericItem: state.deleteSvaMainserverGenericItem,
}));

import { dispatchSvaMainserverGenericItemsRequest } from './generic-items-route.js';

const ctx = {
  sessionId: 'session-1',
  activeOrganizationId: '11111111-1111-1111-8111-111111111111',
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
    actor: {
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      organizationId: '11111111-1111-1111-8111-111111111111',
    },
    permissions: [],
  });
};

describe('dispatchSvaMainserverGenericItemsRequest', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('ignores unrelated routes', async () => {
    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news')
    );

    expect(response).toBeNull();
    expect(state.withAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('lists generic items after read authorization', async () => {
    mockAuthorizedMutation();
    state.listSvaMainserverGenericItems.mockResolvedValue({
      data: [{ id: 'generic-1' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items')
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      data: [{ id: 'generic-1' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    expect(state.listSvaMainserverGenericItems).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'de-musterhausen', page: 1, pageSize: 25 })
    );
  });

  it('creates generic items with normalized payload fields', async () => {
    mockAuthorizedMutation();
    state.createSvaMainserverGenericItem.mockResolvedValue({ id: 'generic-1' });

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Freier Eintrag',
          genericType: 'faq',
          teaser: 'Kurztext',
          payload: { answer: '42' },
          categories: [{ name: 'Service' }],
          contacts: [{ email: 'faq@example.invalid' }],
          webUrls: [{ url: 'https://example.invalid/faq' }],
          addresses: [{ city: 'Musterhausen' }],
          contentBlocks: [{ body: '<p>Antwort</p>' }],
          mediaContents: [{ captionText: 'Bild', sourceUrl: { url: 'https://example.invalid/image.jpg' } }],
          dates: [{ dateStart: '2026-08-01' }],
          accessibilityInformations: [{ description: 'Lesbar' }],
          visible: false,
        }),
      })
    );

    expect(response?.status).toBe(201);
    expect(state.createSvaMainserverGenericItem).toHaveBeenCalledWith(
      expect.objectContaining({
        genericItem: expect.objectContaining({
          title: 'Freier Eintrag',
          genericType: 'faq',
          teaser: 'Kurztext',
          payload: { answer: '42' },
          visible: false,
          categories: [{ name: 'Service' }],
          contacts: [{ email: 'faq@example.invalid' }],
        }),
      })
    );
  });

  it('updates generic items through PATCH', async () => {
    mockAuthorizedMutation();
    state.updateSvaMainserverGenericItem.mockResolvedValue({ id: 'generic-1' });

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items/generic-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Aktualisiert', genericType: 'faq' }),
      })
    );

    expect(response?.status).toBe(200);
    expect(state.updateSvaMainserverGenericItem).toHaveBeenCalledWith(
      expect.objectContaining({
        genericItemId: 'generic-1',
        genericItem: expect.objectContaining({ title: 'Aktualisiert', genericType: 'faq' }),
      })
    );
  });

  it('deletes generic items', async () => {
    mockAuthorizedMutation();
    state.deleteSvaMainserverGenericItem.mockResolvedValue({ id: 'generic-1', deleted: true });

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items/generic-1', { method: 'DELETE' })
    );

    expect(response?.status).toBe(200);
    expect(state.deleteSvaMainserverGenericItem).toHaveBeenCalledWith(
      expect.objectContaining({ genericItemId: 'generic-1' })
    );
  });

  it('rejects missing required fields', async () => {
    mockAuthorizedMutation();

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items', {
        method: 'POST',
        body: JSON.stringify({ genericType: 'faq' }),
      })
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toEqual({
      error: 'invalid_request',
      message: 'Der Titel ist erforderlich.',
    });
  });
});
