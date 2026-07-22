import { afterEach, describe, expect, it, vi } from 'vitest';
import { SvaMainserverError } from './errors.js';

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

  it('filters FAQ reads and authorizes them with the FAQ action', async () => {
    mockAuthorizedMutation();
    state.listSvaMainserverGenericItems.mockResolvedValue({
      data: [{ id: 'faq-1', genericType: 'FAQ' }, { id: 'generic-1', genericType: 'INFO' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false, total: 1 },
    });

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/faqs')
    );

    await expect(response?.json()).resolves.toEqual({
      data: [{ id: 'faq-1', genericType: 'FAQ' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false, total: 1 },
    });
    expect(state.authorizeContentPrimitiveForUser).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'faq.read', resource: { contentType: 'faq.faq' } })
    );
  });

  it('collects and deterministically paginates FAQ records across upstream pages', async () => {
    mockAuthorizedMutation();
    state.listSvaMainserverGenericItems
      .mockResolvedValueOnce({
        data: [
          { id: 'generic-1', genericType: 'INFO', title: 'Allgemein' },
          { id: 'faq-2', genericType: 'FAQ', title: 'Zweite', payload: { languageCode: 'de', sortWeight: 2 } },
        ],
        pagination: { page: 1, pageSize: 100, hasNextPage: true },
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'faq-3', genericType: 'FAQ', title: 'Erste', payload: { languageCode: 'de', sortWeight: 1 } },
          { id: 'faq-1', genericType: 'FAQ', title: 'English', payload: { languageCode: 'en', sortWeight: 1 } },
        ],
        pagination: { page: 2, pageSize: 100, hasNextPage: false },
      });

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/faqs?page=1&pageSize=25')
    );

    await expect(response?.json()).resolves.toEqual({
      data: [
        { id: 'faq-3', genericType: 'FAQ', title: 'Erste', payload: { languageCode: 'de', sortWeight: 1 } },
        { id: 'faq-2', genericType: 'FAQ', title: 'Zweite', payload: { languageCode: 'de', sortWeight: 2 } },
        { id: 'faq-1', genericType: 'FAQ', title: 'English', payload: { languageCode: 'en', sortWeight: 1 } },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false, total: 3 },
    });
    expect(state.listSvaMainserverGenericItems).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ page: 1, pageSize: 100 })
    );
    expect(state.listSvaMainserverGenericItems).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 2, pageSize: 100 })
    );
  });

  it('enforces the FAQ discriminator on writes', async () => {
    mockAuthorizedMutation();
    state.createSvaMainserverGenericItem.mockResolvedValue({ id: 'faq-1' });

    await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/faqs', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Frage',
          genericType: 'INFO',
          contentBlocks: [{ body: 'Antwort ohne HTML' }],
          payload: { languageCode: 'de', sortWeight: 0 },
        }),
      })
    );

    expect(state.createSvaMainserverGenericItem).toHaveBeenCalledWith(
      expect.objectContaining({ genericItem: expect.objectContaining({ genericType: 'FAQ' }) })
    );
  });

  it('rejects faq writes with html in the answer body before calling the service', async () => {
    mockAuthorizedMutation();

    const createResponse = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/faqs', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Frage',
          genericType: 'FAQ',
          contentBlocks: [{ body: '<p>Antwort</p>' }],
        }),
      })
    );
    const updateResponse = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/faqs/faq-1', {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Frage',
          genericType: 'FAQ',
          contentBlocks: [{ body: '<script>alert(1)</script>' }],
        }),
      })
    );

    expect(createResponse?.status).toBe(400);
    await expect(createResponse?.json()).resolves.toEqual({
      error: 'invalid_request',
      message: 'HTML in der FAQ-Antwort ist nicht erlaubt.',
    });
    expect(updateResponse?.status).toBe(400);
    await expect(updateResponse?.json()).resolves.toEqual({
      error: 'invalid_request',
      message: 'HTML in der FAQ-Antwort ist nicht erlaubt.',
    });
    expect(state.createSvaMainserverGenericItem).not.toHaveBeenCalled();
    expect(state.updateSvaMainserverGenericItem).not.toHaveBeenCalled();
  });

  it('rejects faq writes without a single plain-text answer and controlled payload fields', async () => {
    mockAuthorizedMutation();

    const missingAnswerResponse = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/faqs', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Frage',
          genericType: 'FAQ',
          payload: { languageCode: 'de', sortWeight: 0 },
        }),
      })
    );
    const invalidPayloadResponse = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/faqs', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Frage',
          genericType: 'FAQ',
          contentBlocks: [{ body: 'Antwort' }],
          payload: { languageCode: 'invalid locale', sortWeight: 1.5 },
        }),
      })
    );
    const unsupportedFieldsResponse = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/faqs', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Frage',
          genericType: 'FAQ',
          contentBlocks: [{ body: 'Antwort' }],
          payload: { languageCode: 'de', sortWeight: 0 },
          categories: [{ name: 'Service' }],
        }),
      })
    );

    expect(missingAnswerResponse?.status).toBe(400);
    await expect(missingAnswerResponse?.json()).resolves.toEqual({
      error: 'invalid_request',
      message: 'Die FAQ-Antwort ist erforderlich.',
    });
    expect(invalidPayloadResponse?.status).toBe(400);
    await expect(invalidPayloadResponse?.json()).resolves.toEqual({
      error: 'invalid_request',
      message: 'Der FAQ-Sprachcode ist ungültig.',
    });
    expect(unsupportedFieldsResponse?.status).toBe(400);
    await expect(unsupportedFieldsResponse?.json()).resolves.toEqual({
      error: 'invalid_request',
      message: 'FAQ unterstützt nur Frage, Antwort und kontrollierten Payload.',
    });
    expect(state.createSvaMainserverGenericItem).not.toHaveBeenCalled();
  });

  it('passes includeInvisible=true through the generic items list route', async () => {
    mockAuthorizedMutation();
    state.listSvaMainserverGenericItems.mockResolvedValue({
      data: [{ id: 'generic-hidden', visible: false }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items?includeInvisible=true')
    );

    expect(response?.status).toBe(200);
    expect(state.listSvaMainserverGenericItems).toHaveBeenCalledWith(
      expect.objectContaining({ includeInvisible: true, page: 1, pageSize: 25 })
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

  it('merges existing faq payload fields during updates and logs faq content type', async () => {
    mockAuthorizedMutation();
    state.getSvaMainserverGenericItem.mockResolvedValue({
      id: 'faq-1',
      genericType: 'FAQ',
      payload: { languageCode: 'de', sortWeight: 2, legacy: 'keep' },
    });
    state.updateSvaMainserverGenericItem.mockResolvedValue({ id: 'faq-1' });

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/faqs/faq-1', {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Frage',
          genericType: 'FAQ',
          contentBlocks: [{ body: 'Antwort' }],
          payload: { languageCode: 'fr', sortWeight: 3 },
        }),
      })
    );

    expect(response?.status).toBe(200);
    expect(state.updateSvaMainserverGenericItem).toHaveBeenCalledWith(
      expect.objectContaining({
        genericItemId: 'faq-1',
        genericItem: expect.objectContaining({
          genericType: 'FAQ',
          payload: { languageCode: 'fr', sortWeight: 3, legacy: 'keep' },
        }),
      })
    );
    expect(state.loggerInfo).toHaveBeenCalledWith(
      'Mainserver generic items route succeeded',
      expect.objectContaining({
        content_type: 'faq.faq',
      })
    );
  });

  it('reads generic item details after item authorization', async () => {
    mockAuthorizedMutation();
    state.getSvaMainserverGenericItem.mockResolvedValue({ id: 'generic-1' });

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items/generic-1')
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({ data: { id: 'generic-1' } });
    expect(state.getSvaMainserverGenericItem).toHaveBeenCalledWith(
      expect.objectContaining({ genericItemId: 'generic-1', instanceId: 'de-musterhausen' })
    );
  });

  it('returns not found when a faq detail request resolves to a non-faq generic item', async () => {
    mockAuthorizedMutation();
    state.getSvaMainserverGenericItem.mockResolvedValue({
      id: 'generic-1',
      genericType: 'INFO',
    });

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/faqs/generic-1')
    );

    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toEqual({
      error: 'not_found',
      message: 'FAQ wurde nicht gefunden.',
    });
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

  it('returns not found when faq update or delete targets a non-faq generic item', async () => {
    mockAuthorizedMutation();
    state.getSvaMainserverGenericItem.mockResolvedValue({
      id: 'generic-1',
      genericType: 'INFO',
    });

    const updateResponse = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/faqs/generic-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Aktualisiert', genericType: 'FAQ' }),
      })
    );
    const deleteResponse = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/faqs/generic-1', {
        method: 'DELETE',
      })
    );

    expect(updateResponse?.status).toBe(404);
    await expect(updateResponse?.json()).resolves.toEqual({
      error: 'not_found',
      message: 'FAQ wurde nicht gefunden.',
    });
    expect(deleteResponse?.status).toBe(404);
    await expect(deleteResponse?.json()).resolves.toEqual({
      error: 'not_found',
      message: 'FAQ wurde nicht gefunden.',
    });
    expect(state.updateSvaMainserverGenericItem).not.toHaveBeenCalled();
    expect(state.deleteSvaMainserverGenericItem).not.toHaveBeenCalled();
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

  it('rejects malformed nested payload sections before calling the service', async () => {
    mockAuthorizedMutation();

    const invalidContactsResponse = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items', {
        method: 'POST',
        body: JSON.stringify({ title: 'Freier Eintrag', genericType: 'faq', contacts: 'invalid' }),
      })
    );
    const invalidContentBlocksResponse = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items', {
        method: 'POST',
        body: JSON.stringify({ title: 'Freier Eintrag', genericType: 'faq', contentBlocks: [{}] }),
      })
    );
    const invalidLocationsResponse = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items', {
        method: 'POST',
        body: JSON.stringify({ title: 'Freier Eintrag', genericType: 'faq', locations: ['invalid'] }),
      })
    );

    expect(invalidContactsResponse?.status).toBe(400);
    expect(invalidContentBlocksResponse?.status).toBe(400);
    expect(invalidLocationsResponse?.status).toBe(400);
    expect(state.createSvaMainserverGenericItem).not.toHaveBeenCalled();
  });

  it('returns invalid JSON request errors before calling the create service', async () => {
    mockAuthorizedMutation();

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items', {
        method: 'POST',
        body: '{invalid-json',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    expect(response?.status).toBe(400);
    expect(state.createSvaMainserverGenericItem).not.toHaveBeenCalled();
  });

  it('rejects mutating requests when csrf validation fails', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue({ ok: false });

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items', {
        method: 'POST',
        body: JSON.stringify({ title: 'Freier Eintrag', genericType: 'faq' }),
      })
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: 'csrf_validation_failed',
      message: 'Sicherheitsprüfung fehlgeschlagen.',
    });
    expect(state.authorizeContentPrimitiveForUser).not.toHaveBeenCalled();
    expect(state.createSvaMainserverGenericItem).not.toHaveBeenCalled();
  });

  it('returns local authorization errors before calling the service', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Nicht erlaubt.',
    });

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items')
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: 'forbidden',
      message: 'Nicht erlaubt.',
    });
    expect(state.listSvaMainserverGenericItems).not.toHaveBeenCalled();
  });

  it('returns method-not-allowed for unsupported route methods', async () => {
    mockAuthorizedMutation();

    const response = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items/generic-1', { method: 'PUT' })
    );

    expect(response?.status).toBe(405);
    await expect(response?.json()).resolves.toEqual({
      error: 'method_not_allowed',
      message: 'Methode wird für diesen Mainserver-Inhalt nicht unterstützt.',
    });
  });

  it('maps upstream and unexpected errors without leaking internal details', async () => {
    mockAuthorizedMutation();
    state.listSvaMainserverGenericItems.mockRejectedValueOnce(
      new SvaMainserverError({
        code: 'network_error',
        message: 'Upstream fehlgeschlagen.',
        statusCode: 502,
      })
    );
    state.getSvaMainserverGenericItem.mockRejectedValueOnce(new Error('boom'));

    const upstreamResponse = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items')
    );
    const unexpectedResponse = await dispatchSvaMainserverGenericItemsRequest(
      createRequest('https://studio.test/api/v1/mainserver/generic-items/generic-1')
    );

    expect(upstreamResponse?.status).toBe(502);
    await expect(upstreamResponse?.json()).resolves.toEqual({
      error: 'network_error',
      message: 'Upstream fehlgeschlagen.',
    });
    expect(unexpectedResponse?.status).toBe(500);
    await expect(unexpectedResponse?.json()).resolves.toEqual({
      error: 'internal_error',
      message: 'Mainserver-Anfrage ist fehlgeschlagen.',
    });
  });
});
