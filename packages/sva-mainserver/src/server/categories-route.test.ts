import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  authorizeContentPrimitiveForUser: vi.fn(),
  listSvaMainserverCategories: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
}));

vi.mock('./service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./service.js')>();
  return {
    ...actual,
    listSvaMainserverCategories: state.listSvaMainserverCategories,
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
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('ignores unrelated routes without touching auth', async () => {
    const response = await dispatchSvaMainserverCategoriesRequest(new Request('https://studio.test/api/v1/mainserver/news'));

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
    });

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories')
    );

    expect(state.listSvaMainserverCategories).not.toHaveBeenCalled();
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: 'forbidden',
      message: 'Keine Berechtigung.',
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
    state.listSvaMainserverCategories.mockResolvedValue([{ id: 'cat-1', name: 'Allgemein' }]);

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
