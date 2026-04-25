import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCreateRoleHandlerInternal, type CreateRoleHandlerDeps } from './role-create-handler.js';

const actor = {
  instanceId: 'de-musterhausen',
  actorAccountId: 'actor-account-1',
  requestId: 'req-create-role',
  traceId: 'trace-create-role',
};

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-actor-1',
    instanceId: 'de-musterhausen',
    roles: ['system_admin'],
  },
};

const payload = {
  roleName: 'editor',
  displayName: 'Editor',
  description: 'Can edit content',
  roleLevel: 20,
  permissionIds: ['permission-1'],
};

const roleItem = {
  id: 'role-1',
  roleKey: 'editor',
};

const identityProvider = {
  provider: {
    createRole: vi.fn(async () => undefined),
    deleteRole: vi.fn(async () => undefined),
  },
};

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const createDeps = (overrides: Partial<CreateRoleHandlerDeps<typeof payload, typeof identityProvider, typeof roleItem>> = {}) =>
  ({
    asApiItem: vi.fn((data, requestId) => ({ data, ...(requestId ? { requestId } : {}) })),
    buildRoleAttributes: vi.fn((input) => ({ managedBy: 'studio', ...input })),
    buildRoleSyncFailure: vi.fn(({ requestId, fallbackMessage }) =>
      createJsonResponse(503, { error: { code: 'keycloak_unavailable', message: fallbackMessage }, requestId })
    ),
    completeIdempotency: vi.fn(async () => undefined),
    createApiError: vi.fn((status, code, message, requestId, details) =>
      createJsonResponse(status, { error: { code, message, ...(details ? { details } : {}) }, requestId })
    ),
    iamRoleSyncCounter: {
      add: vi.fn(),
    },
    iamUserOperationsCounter: {
      add: vi.fn(),
    },
    jsonResponse: vi.fn(createJsonResponse),
    logger: {
      error: vi.fn(),
    },
    mapRoleSyncErrorCode: vi.fn(() => 'IDP_UNAVAILABLE'),
    parseCreateRoleBody: vi.fn(async () => ({ ok: true, data: payload, rawBody: JSON.stringify(payload) })),
    persistCreatedRole: vi.fn(async () => roleItem),
    requireIdempotencyKey: vi.fn(() => ({ key: 'idem-role-1' })),
    requireRoleIdentityProvider: vi.fn(async () => identityProvider),
    reserveIdempotency: vi.fn(async () => ({ status: 'reserved' })),
    resolveRoleMutationActor: vi.fn(async () => ({ actor })),
    sanitizeRoleErrorMessage: vi.fn((error) => (error instanceof Error ? error.message : String(error))),
    toPayloadHash: vi.fn(() => 'payload-hash-1'),
    trackKeycloakCall: vi.fn(async (_operation, work) => work()),
    ...overrides,
  }) satisfies CreateRoleHandlerDeps<typeof payload, typeof identityProvider, typeof roleItem>;

describe('createCreateRoleHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityProvider.provider.createRole.mockClear();
    identityProvider.provider.deleteRole.mockClear();
  });

  it('creates the role in Keycloak, persists it locally and completes idempotency', async () => {
    const deps = createDeps();
    const handler = createCreateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles', { method: 'POST' }), ctx);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: roleItem,
      requestId: 'req-create-role',
    });
    expect(identityProvider.provider.createRole).toHaveBeenCalledWith({
      externalName: 'editor',
      description: 'Can edit content',
      attributes: {
        managedBy: 'studio',
        instanceId: 'de-musterhausen',
        roleKey: 'editor',
        displayName: 'Editor',
      },
    });
    expect(deps.persistCreatedRole).toHaveBeenCalledWith({
      actor,
      roleKey: 'editor',
      displayName: 'Editor',
      externalRoleName: 'editor',
      description: 'Can edit content',
      roleLevel: 20,
      permissionIds: ['permission-1'],
    });
    expect(deps.completeIdempotency).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'actor-account-1',
      endpoint: 'POST:/api/v1/iam/roles',
      idempotencyKey: 'idem-role-1',
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody: expect.objectContaining({ requestId: 'req-create-role' }),
    });
  });

  it('returns replayed idempotency responses without creating a role', async () => {
    const replayBody = { data: { id: 'existing-role' } };
    const deps = createDeps({
      reserveIdempotency: vi.fn(async () => ({ status: 'replay', responseStatus: 201, responseBody: replayBody })),
    });
    const handler = createCreateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles', { method: 'POST' }), ctx);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(replayBody);
    expect(identityProvider.provider.createRole).not.toHaveBeenCalled();
  });

  it('stores a failed idempotency response when no identity provider is configured', async () => {
    const deps = createDeps({
      requireRoleIdentityProvider: vi.fn(async () => createJsonResponse(409, { error: { code: 'tenant_admin_client_not_configured' } })),
    });
    const handler = createCreateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles', { method: 'POST' }), ctx);

    expect(response.status).toBe(503);
    expect(deps.completeIdempotency).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'actor-account-1',
      endpoint: 'POST:/api/v1/iam/roles',
      idempotencyKey: 'idem-role-1',
      status: 'FAILED',
      responseStatus: 503,
      responseBody: expect.objectContaining({
        error: expect.objectContaining({ code: 'keycloak_unavailable' }),
      }),
    });
  });

  it('compensates Keycloak role creation when local persistence fails', async () => {
    const deps = createDeps({
      persistCreatedRole: vi.fn(async () => {
        throw new Error('db write failed');
      }),
    });
    const handler = createCreateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles', { method: 'POST' }), ctx);

    expect(response.status).toBe(409);
    expect(identityProvider.provider.deleteRole).toHaveBeenCalledWith('editor');
    expect(deps.completeIdempotency).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'actor-account-1',
      endpoint: 'POST:/api/v1/iam/roles',
      idempotencyKey: 'idem-role-1',
      status: 'FAILED',
      responseStatus: 409,
      responseBody: expect.objectContaining({
        error: expect.objectContaining({ code: 'conflict' }),
      }),
    });
  });
});
