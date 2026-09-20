import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  authorizeContentPrimitiveForUser: vi.fn(),
  resolveActorInfo: vi.fn(),
  reserveIdempotency: vi.fn(),
  completeIdempotency: vi.fn(),
  validateCsrf: vi.fn(),
  listSvaMainserverCategories: vi.fn(),
  listSvaMainserverCategoryManagement: vi.fn(),
  saveSvaMainserverCategory: vi.fn(),
  deleteSvaMainserverCategory: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
  resolveActorInfo: state.resolveActorInfo,
  reserveIdempotency: state.reserveIdempotency,
  completeIdempotency: state.completeIdempotency,
  validateCsrf: state.validateCsrf,
}));

vi.mock('./service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./service.js')>();
  return {
    ...actual,
    listSvaMainserverCategories: state.listSvaMainserverCategories,
    listSvaMainserverCategoryManagement: state.listSvaMainserverCategoryManagement,
    saveSvaMainserverCategory: state.saveSvaMainserverCategory,
    deleteSvaMainserverCategory: state.deleteSvaMainserverCategory,
  };
});

import { dispatchSvaMainserverCategoriesRequest } from './categories-route.js';

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

describe('dispatchSvaMainserverCategoriesRequest', () => {
  const confirmedCapabilitiesEnvironment = 'SVA_MAINSERVER_CONFIRMED_CAPABILITIES';

  beforeEach(() => {
    process.env[confirmedCapabilitiesEnvironment] =
      'categories.read,categories.create,categories.update,categories.delete';
    state.validateCsrf.mockReturnValue(null);
  });

  afterEach(() => {
    delete process.env[confirmedCapabilitiesEnvironment];
    vi.resetAllMocks();
  });

  const allow = (action: string) => {
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        organizationId: '22222222-2222-2222-8222-222222222222',
      },
      permissions: [action],
    });
  };

  it('ignores unrelated routes without touching auth', async () => {
    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/news')
    );

    expect(response).toBeNull();
    expect(state.withAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('ignores malformed category item paths without throwing', async () => {
    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories/%zz')
    );

    expect(response).toBeNull();
    expect(state.withAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('returns method_not_allowed for unsupported methods on the matched categories path', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories', { method: 'PUT' })
    );

    expect(state.authorizeContentPrimitiveForUser).not.toHaveBeenCalled();
    expect(response?.status).toBe(405);
    await expect(response?.json()).resolves.toEqual({
      error: 'method_not_allowed',
      message: 'Methode wird für Mainserver-Kategorien nicht unterstützt.',
    });
  });

  it('returns local authorization failures without calling the service', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung.',
      permissionDenial: {
        required_permissions: ['categories.read'],
        requirement_mode: 'allOf',
        denial_reason: 'permission_missing',
      },
    });

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories')
    );

    expect(state.listSvaMainserverCategories).not.toHaveBeenCalled();
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: 'forbidden',
      message: 'Keine Berechtigung.',
      details: {
        required_permissions: ['categories.read'],
        requirement_mode: 'allOf',
        denial_reason: 'permission_missing',
      },
    });
  });

  it('lists categories through a dedicated route boundary', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        organizationId: '22222222-2222-2222-8222-222222222222',
      },
      permissions: [],
    });
    state.listSvaMainserverCategories.mockResolvedValue([
      { id: 'cat-1', name: 'Allgemein', dataTypes: [] },
    ]);

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories')
    );

    expect(state.authorizeContentPrimitiveForUser).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'categories.read' })
    );
    expect(state.listSvaMainserverCategories).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '22222222-2222-2222-8222-222222222222',
    });
    await expect(response?.json()).resolves.toEqual({
      data: [{ id: 'cat-1', name: 'Allgemein' }],
    });
  });

  it('filters active categories for a requested content data type while keeping universal categories', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.read');
    state.listSvaMainserverCategories.mockResolvedValue([
      { id: 'universal', name: 'Allgemein', dataTypes: [] },
      { id: 'news', name: 'Presse', dataTypes: ['news_item'] },
      { id: 'event', name: 'Kultur', dataTypes: ['event_record'] },
      { id: 'multi', name: 'Amtlich', dataTypes: ['news_item', 'event_record'] },
      { id: 'poi', name: 'Ort', dataTypes: ['point_of_interest'] },
    ]);

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories?dataType=event_record')
    );

    expect(state.listSvaMainserverCategories).toHaveBeenCalledTimes(1);
    await expect(response?.json()).resolves.toEqual({
      data: [
        { id: 'universal', name: 'Allgemein' },
        { id: 'event', name: 'Kultur' },
        { id: 'multi', name: 'Amtlich' },
      ],
    });
  });

  it.each([
    'https://studio.test/api/v1/mainserver/categories?dataType=unknown',
    'https://studio.test/api/v1/mainserver/categories?dataType=',
    'https://studio.test/api/v1/mainserver/categories?dataType=news_item&dataType=event_record',
  ])('rejects invalid category data type filters before the upstream read', async (url) => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.read');

    const response = await dispatchSvaMainserverCategoriesRequest(new Request(url));

    expect(state.listSvaMainserverCategories).not.toHaveBeenCalled();
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toEqual({
      error: 'invalid_request',
      message: 'Der Kategorien-Datentypfilter ist ungültig.',
    });
  });

  it('loads the explicit management view without changing the active-only read', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.read');
    state.listSvaMainserverCategoryManagement.mockResolvedValue([
      { id: 'inactive', name: 'Archiv', active: false },
    ]);

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories?view=management')
    );

    expect(state.listSvaMainserverCategories).not.toHaveBeenCalled();
    expect(state.listSvaMainserverCategoryManagement).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '22222222-2222-2222-8222-222222222222',
    });
    await expect(response?.json()).resolves.toEqual({
      data: [{ id: 'inactive', name: 'Archiv', active: false }],
    });
  });

  it('fails closed before authorization when the category management contract is unconfirmed', async () => {
    delete process.env[confirmedCapabilitiesEnvironment];
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories?view=management')
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      error: 'category_management_contract_unavailable',
      message: 'Der Mainserver-Vertrag für diese Kategorienoperation ist nicht bestätigt.',
    });
    expect(state.authorizeContentPrimitiveForUser).not.toHaveBeenCalled();
    expect(state.listSvaMainserverCategoryManagement).not.toHaveBeenCalled();
  });

  it('rejects a create request before the upstream call when its idempotency key is missing', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.create');

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Neu',
          active: true,
          parentId: null,
          position: null,
          iconName: null,
          email: null,
          dataTypes: [],
        }),
      })
    );

    expect(state.saveSvaMainserverCategory).not.toHaveBeenCalled();
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toEqual({
      error: 'idempotency_key_required',
      message: 'Header Idempotency-Key ist erforderlich.',
    });
  });

  it('rejects mutations that fail the shared CSRF validation before authorization', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(
      new Response(JSON.stringify({ error: 'csrf_validation_failed' }), { status: 403 })
    );

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories/cat-1', {
        method: 'DELETE',
      })
    );

    expect(response?.status).toBe(403);
    expect(state.authorizeContentPrimitiveForUser).not.toHaveBeenCalled();
    expect(state.deleteSvaMainserverCategory).not.toHaveBeenCalled();
  });

  it('validates a create body before reserving its idempotency key', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.create');

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'invalid-create', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', active: true, dataTypes: [] }),
      })
    );

    expect(response?.status).toBe(400);
    expect(state.reserveIdempotency).not.toHaveBeenCalled();
    expect(state.saveSvaMainserverCategory).not.toHaveBeenCalled();
  });

  it('rejects invalid category identifiers before the upstream call', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.create');

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'invalid-identifiers', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Neu',
          active: true,
          parentId: null,
          position: null,
          iconName: null,
          email: null,
          dataTypes: ['news_item', 'invalid\nvalue'],
        }),
      })
    );

    expect(response?.status).toBe(400);
    expect(state.reserveIdempotency).not.toHaveBeenCalled();
    expect(state.saveSvaMainserverCategory).not.toHaveBeenCalled();
  });

  it('creates a category once and stores its terminal response for idempotent replay', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.create');
    state.resolveActorInfo.mockResolvedValue({
      actor: { actorAccountId: '33333333-3333-3333-8333-333333333333' },
    });
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.saveSvaMainserverCategory.mockResolvedValue({
      category: { id: 'cat-1', name: 'Neu', active: true, children: [], dataTypes: [] },
      affectedDescendantIds: [],
      errors: [],
    });

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'category-create-1', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ' Neu ',
          active: true,
          parentId: null,
          position: null,
          iconName: null,
          email: null,
          dataTypes: ['news_item'],
        }),
      })
    );

    expect(state.saveSvaMainserverCategory).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '22222222-2222-2222-8222-222222222222',
      category: {
        name: 'Neu',
        active: true,
        parentId: null,
        position: null,
        iconName: null,
        email: null,
        dataTypes: ['news_item'],
      },
    });
    expect(state.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint:
          'POST:/api/v1/mainserver/categories#organization:22222222-2222-2222-8222-222222222222',
        idempotencyKey: 'category-create-1',
        responseStatus: 201,
        status: 'COMPLETED',
      })
    );
    expect(state.reserveIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint:
          'POST:/api/v1/mainserver/categories#organization:22222222-2222-2222-8222-222222222222',
      })
    );
    expect(response?.status).toBe(201);
  });

  it('replays a terminal create response without another upstream call', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.create');
    state.resolveActorInfo.mockResolvedValue({
      actor: { actorAccountId: '33333333-3333-3333-8333-333333333333' },
    });
    state.reserveIdempotency.mockResolvedValue({
      status: 'replay',
      responseStatus: 201,
      responseBody: { category: { id: 'cat-1' }, affectedDescendantIds: [], errors: [] },
    });

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'category-create-1' },
        body: JSON.stringify({
          name: 'Neu',
          active: true,
          parentId: null,
          position: null,
          iconName: null,
          email: null,
          dataTypes: [],
        }),
      })
    );

    expect(state.saveSvaMainserverCategory).not.toHaveBeenCalled();
    expect(response?.status).toBe(201);
  });

  it('returns structured save failures as a typed terminal response', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.create');
    state.resolveActorInfo.mockResolvedValue({
      actor: { actorAccountId: '33333333-3333-3333-8333-333333333333' },
    });
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.saveSvaMainserverCategory.mockResolvedValue({
      affectedDescendantIds: [],
      errors: [{ code: 'CATEGORY_INVALID_PARENT', field: 'parentId', message: 'Ungültig' }],
    });

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'category-create-error', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Neu',
          active: true,
          parentId: 'missing',
          position: null,
          iconName: null,
          email: null,
          dataTypes: [],
        }),
      })
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      affectedDescendantIds: [],
      errors: [{ code: 'CATEGORY_INVALID_PARENT', field: 'parentId', message: 'Ungültig' }],
    });
    expect(state.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ responseStatus: 200, status: 'FAILED' })
    );
  });

  it('rejects updates without an explicit active value before the upstream call', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.update');

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories/cat-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Neu',
          parentId: null,
          position: null,
          iconName: null,
          email: null,
          dataTypes: [],
        }),
      })
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'category_management_invalid_request',
    });
    expect(state.saveSvaMainserverCategory).not.toHaveBeenCalled();
  });

  it('rejects full updates that omit nullable fields instead of clearing them implicitly', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.update');

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories/cat-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Neu',
          active: true,
          dataTypes: [],
        }),
      })
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'category_management_invalid_request',
    });
    expect(state.saveSvaMainserverCategory).not.toHaveBeenCalled();
  });

  it('updates and deletes only after their distinct actions have been authorized', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.update');
    state.saveSvaMainserverCategory.mockResolvedValue({
      category: { id: 'cat-1', name: 'Neu', active: true, children: [], dataTypes: [] },
      affectedDescendantIds: [],
      errors: [],
    });

    const update = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories/cat-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Neu',
          active: true,
          parentId: null,
          position: null,
          iconName: null,
          email: null,
          dataTypes: [],
        }),
      })
    );
    expect(update?.status).toBe(200);
    expect(state.saveSvaMainserverCategory).toHaveBeenCalledWith(
      expect.objectContaining({ category: expect.objectContaining({ id: 'cat-1' }) })
    );

    vi.resetAllMocks();
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    allow('categories.delete');
    state.deleteSvaMainserverCategory.mockResolvedValue({
      deletedCategoryId: 'cat-1',
      usage: {
        children: 0,
        resourceAssignments: 0,
        externalServiceAssignments: 0,
        dataResourceSettings: 0,
        notificationConfigurations: 0,
      },
      errors: [],
    });
    const deletion = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories/cat-1', { method: 'DELETE' })
    );
    expect(deletion?.status).toBe(200);
    expect(state.deleteSvaMainserverCategory).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-1' })
    );
  });

  it('preserves the prior generic internal error contract', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
      },
      permissions: [],
    });
    state.listSvaMainserverCategories.mockRejectedValue(new Error('boom'));

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories')
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: 'internal_error',
      message: 'Mainserver-Kategorien-Anfrage ist fehlgeschlagen.',
    });
  });
});
