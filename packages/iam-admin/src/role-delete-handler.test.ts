import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDeleteRoleHandlerInternal, type DeleteRoleHandlerDeps } from './role-delete-handler.js';

const actor = {
  instanceId: 'de-musterhausen',
  actorAccountId: 'actor-account-1',
  requestId: 'req-delete-role',
  traceId: 'trace-delete-role',
};

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-actor-1',
    instanceId: 'de-musterhausen',
    roles: ['system_admin'],
  },
};

const existingRole = {
  role_key: 'editor',
  role_name: 'editor',
  display_name: 'Editor',
  external_role_name: 'editor',
  description: 'Can edit content',
  is_system_role: false,
  managed_by: 'studio',
  role_level: 20,
};

const identityProvider = {
  provider: {
    createRole: vi.fn(async () => undefined),
    deleteRole: vi.fn(async () => undefined),
  },
};

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const buildAttributes = (input: { readonly instanceId: string; readonly roleKey: string; readonly displayName: string }) => ({
  managedBy: 'studio' as const,
  ...input,
});

const createDeps = (
  overrides: Partial<DeleteRoleHandlerDeps<ReturnType<typeof buildAttributes>, typeof identityProvider, typeof existingRole>> = {}
) =>
  ({
    asApiItem: vi.fn((data, requestId) => ({ data, ...(requestId ? { requestId } : {}) })),
    buildRoleAttributes: vi.fn(buildAttributes),
    createApiError: vi.fn((status, code, message, requestId, details) =>
      createJsonResponse(status, { error: { code, message, ...(details ? { details } : {}) }, requestId })
    ),
    deleteRoleFromDatabase: vi.fn(async () => undefined),
    iamRoleSyncCounter: {
      add: vi.fn(),
    },
    isIdentityRoleNotFoundError: vi.fn(() => false),
    jsonResponse: vi.fn(createJsonResponse),
    logger: {
      error: vi.fn(),
    },
    mapRoleSyncErrorCode: vi.fn(() => 'IDP_UNAVAILABLE'),
    markDeleteRoleSyncState: vi.fn(async () => undefined),
    requireRoleId: vi.fn(() => 'role-1'),
    requireRoleIdentityProvider: vi.fn(async () => identityProvider),
    resolveDeletableRole: vi.fn(async () => existingRole),
    resolveRoleMutationActor: vi.fn(async () => ({ actor })),
    sanitizeRoleErrorMessage: vi.fn((error) => (error instanceof Error ? error.message : String(error))),
    trackKeycloakCall: vi.fn(async (_operation, work) => work()),
    ...overrides,
  }) satisfies DeleteRoleHandlerDeps<ReturnType<typeof buildAttributes>, typeof identityProvider, typeof existingRole>;

describe('createDeleteRoleHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityProvider.provider.createRole.mockClear();
    identityProvider.provider.deleteRole.mockClear();
  });

  it('deletes the role in Keycloak and locally, then returns the deleted role summary', async () => {
    const deps = createDeps();
    const handler = createDeleteRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'DELETE' }), ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: 'role-1',
        roleKey: 'editor',
        roleName: 'Editor',
        externalRoleName: 'editor',
        syncState: 'synced',
      },
      requestId: 'req-delete-role',
    });
    expect(identityProvider.provider.deleteRole).toHaveBeenCalledWith('editor');
    expect(deps.deleteRoleFromDatabase).toHaveBeenCalledWith({
      actor,
      roleId: 'role-1',
      roleKey: 'editor',
      externalRoleName: 'editor',
    });
  });

  it('treats identity-provider 404 as already deleted and still removes local state', async () => {
    const missingRoleError = new Error('missing role');
    const deps = createDeps({
      isIdentityRoleNotFoundError: vi.fn((error) => error === missingRoleError),
      trackKeycloakCall: vi.fn(async (operation, work) => {
        if (operation === 'delete_role') {
          throw missingRoleError;
        }
        return work();
      }),
    });
    const handler = createDeleteRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'DELETE' }), ctx);

    expect(response.status).toBe(200);
    expect(deps.deleteRoleFromDatabase).toHaveBeenCalled();
  });

  it('marks sync failure when Keycloak deletion fails with a non-404 error', async () => {
    const deps = createDeps({
      trackKeycloakCall: vi.fn(async (operation, work) => {
        if (operation === 'delete_role') {
          throw new Error('keycloak down');
        }
        return work();
      }),
    });
    const handler = createDeleteRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'DELETE' }), ctx);

    expect(response.status).toBe(503);
    expect(deps.markDeleteRoleSyncState).toHaveBeenCalledWith({
      actor,
      roleId: 'role-1',
      roleKey: 'editor',
      externalRoleName: 'editor',
      result: 'failure',
      eventType: 'role.sync_failed',
      errorCode: 'IDP_UNAVAILABLE',
      syncState: 'failed',
    });
  });

  it('recreates the role in Keycloak when local deletion fails', async () => {
    const deps = createDeps({
      deleteRoleFromDatabase: vi.fn(async () => {
        throw new Error('db write failed');
      }),
    });
    const handler = createDeleteRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'DELETE' }), ctx);

    expect(response.status).toBe(500);
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
  });
});
