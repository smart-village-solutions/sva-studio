import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createJsonResponse, createTestDepsBuilder, dbWriteFailedErrorBody } from '../test-support/handler-test-helpers.js';
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

const createDeps = createTestDepsBuilder<
  CreateRoleHandlerDeps<typeof payload, typeof identityProvider, typeof roleItem>
>(() => ({
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
    validateRequestedPermissions: vi.fn(async () => null),
  })) satisfies CreateRoleHandlerDeps<typeof payload, typeof identityProvider, typeof roleItem>;

const runCreateRoleRequest = async (deps: CreateRoleHandlerDeps<typeof payload, typeof identityProvider, typeof roleItem>) => {
  const handler = createCreateRoleHandlerInternal(deps);
  return handler(new Request('http://localhost/api/v1/iam/roles', { method: 'POST' }), ctx);
};

describe('createCreateRoleHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityProvider.provider.createRole.mockClear();
    identityProvider.provider.deleteRole.mockClear();
  });

  it('persists tenant roles locally without creating Keycloak roles', async () => {
    const deps = createDeps();
    const handler = createCreateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles', { method: 'POST' }), ctx);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: roleItem,
      requestId: 'req-create-role',
    });
    expect(deps.requireRoleIdentityProvider).not.toHaveBeenCalled();
    expect(identityProvider.provider.createRole).not.toHaveBeenCalled();
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
    const response = await runCreateRoleRequest(deps);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(replayBody);
    expect(identityProvider.provider.createRole).not.toHaveBeenCalled();
  });

  it('does not require an identity provider for local tenant roles', async () => {
    const deps = createDeps({
      requireRoleIdentityProvider: vi.fn(async () => createJsonResponse(409, { error: { code: 'tenant_admin_client_not_configured' } })),
    });
    const response = await runCreateRoleRequest(deps);

    expect(response.status).toBe(201);
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

  it('returns invalid_request before idempotency when tenant permissions are not manageable', async () => {
    const invalidResponse = createJsonResponse(400, {
      error: { code: 'invalid_request', message: 'Mindestens eine Berechtigung ist im Tenant nicht verwaltbar.' },
      requestId: 'req-create-role',
    });
    const deps = createDeps({
      validateRequestedPermissions: vi.fn(async () => invalidResponse),
    });
    const handler = createCreateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles', { method: 'POST' }), ctx);

    expect(response).toBe(invalidResponse);
    expect(deps.reserveIdempotency).not.toHaveBeenCalled();
    expect(identityProvider.provider.createRole).not.toHaveBeenCalled();
    expect(deps.persistCreatedRole).not.toHaveBeenCalled();
  });

  it('returns a DB write conflict without Keycloak compensation when local persistence fails', async () => {
    const deps = createDeps({
      persistCreatedRole: vi.fn(async () => {
        throw new Error('db write failed');
      }),
    });
    const handler = createCreateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles', { method: 'POST' }), ctx);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject(dbWriteFailedErrorBody('conflict', 'req-create-role'));
    expect(identityProvider.provider.createRole).not.toHaveBeenCalled();
    expect(identityProvider.provider.deleteRole).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Role create database write failed',
      expect.objectContaining({
        operation: 'create_role',
        error_code: 'DB_WRITE_FAILED',
        error: 'db write failed',
      })
    );
    expect(deps.completeIdempotency).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'actor-account-1',
      endpoint: 'POST:/api/v1/iam/roles',
      idempotencyKey: 'idem-role-1',
      status: 'FAILED',
      responseStatus: 409,
      responseBody: expect.objectContaining({
        error: expect.objectContaining({
          code: 'conflict',
          details: expect.objectContaining({ syncError: { code: 'DB_WRITE_FAILED' } }),
        }),
      }),
    });
  });
});
