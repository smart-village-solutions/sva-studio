import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createJsonResponse, createTestDepsBuilder, dbWriteFailedErrorBody } from './handler-test-helpers.js';
import { createUpdateRoleHandlerInternal, type UpdateRoleHandlerDeps } from './role-update-handler.js';
import { syncTechnicalRoleUpdate, type PreparedRoleUpdate } from './role-update-sync.js';

const actor = {
  instanceId: 'de-musterhausen',
  actorAccountId: 'actor-account-1',
  requestId: 'req-update-role',
  traceId: 'trace-update-role',
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
  displayName: 'Editor Plus',
  description: 'Can edit more content',
  roleLevel: 25,
  permissionIds: ['permission-1'],
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

const systemAdminRole = {
  ...existingRole,
  role_key: 'system_admin',
  role_name: 'system_admin',
  display_name: 'System Admin',
  external_role_name: 'system_admin',
  description: 'System administration',
  is_system_role: true,
  role_level: 100,
};

const roleItem = {
  id: 'role-1',
  roleKey: 'editor',
  displayName: 'Editor Plus',
};

const identityProvider = {
  provider: {
    updateRole: vi.fn(async () => undefined),
  },
};

const createDeps = createTestDepsBuilder<
  UpdateRoleHandlerDeps<
    typeof payload,
    ReturnType<typeof buildAttributes>,
    typeof identityProvider,
    typeof existingRole,
    typeof roleItem
  >
>(() => ({
    asApiItem: vi.fn((data, requestId) => ({ data, ...(requestId ? { requestId } : {}) })),
    buildRoleAttributes: vi.fn(buildAttributes),
    buildRoleSyncFailure: vi.fn(({ requestId, fallbackMessage, roleId }) =>
      createJsonResponse(503, { error: { code: 'keycloak_unavailable', message: fallbackMessage, roleId }, requestId })
    ),
    createApiError: vi.fn((status, code, message, requestId, details) =>
      createJsonResponse(status, { error: { code, message, ...(details ? { details } : {}) }, requestId })
    ),
    iamRoleSyncCounter: {
      add: vi.fn(),
    },
    jsonResponse: vi.fn(createJsonResponse),
    logger: {
      error: vi.fn(),
    },
    mapRoleSyncErrorCode: vi.fn(() => 'IDP_UNAVAILABLE'),
    markRoleSyncState: vi.fn(async () => undefined),
    parseUpdateRoleBody: vi.fn(async () => ({ ok: true, data: payload, rawBody: JSON.stringify(payload) })),
    persistUpdatedRole: vi.fn(async () => roleItem),
    requireRoleId: vi.fn(() => 'role-1'),
    requireRoleIdentityProvider: vi.fn(async () => identityProvider),
    resolveMutableRole: vi.fn(async () => existingRole),
    resolveRoleMutationActor: vi.fn(async () => ({ actor })),
    sanitizeRoleErrorMessage: vi.fn((error) => (error instanceof Error ? error.message : String(error))),
    trackKeycloakCall: vi.fn(async (_operation, work) => work()),
    validateRequestedPermissions: vi.fn(async () => null),
  })) satisfies UpdateRoleHandlerDeps<
    typeof payload,
    ReturnType<typeof buildAttributes>,
    typeof identityProvider,
    typeof existingRole,
    typeof roleItem
  >;

const preparedRetryUpdate = {
  actor,
  roleId: 'role-system-admin',
  existing: systemAdminRole,
  data: payload,
  operation: 'retry',
  displayName: 'System Admin',
  description: 'System administration',
  roleLevel: 100,
  externalRoleName: 'system_admin',
} satisfies PreparedRoleUpdate<typeof payload, typeof existingRole>;

const expectRetrySyncFailureMarked = (
  deps: UpdateRoleHandlerDeps<typeof payload, ReturnType<typeof buildAttributes>, typeof identityProvider, typeof existingRole, typeof roleItem>,
  errorCode: 'COMPENSATION_FAILED' | 'DB_WRITE_FAILED'
) => {
  expect(deps.markRoleSyncState).toHaveBeenLastCalledWith(
    expect.objectContaining({
      operation: 'retry',
      result: 'failure',
      errorCode,
    })
  );
  expect(deps.iamRoleSyncCounter.add).toHaveBeenLastCalledWith(1, {
    operation: 'retry',
    result: 'failure',
    error_code: errorCode,
  });
};

function buildAttributes(input: { readonly instanceId: string; readonly roleKey: string; readonly displayName: string }) {
  return { managedBy: 'studio' as const, ...input };
}

describe('createUpdateRoleHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityProvider.provider.updateRole.mockClear();
  });

  it('updates tenant roles locally without updating Keycloak', async () => {
    const deps = createDeps();
    const handler = createUpdateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'PATCH' }), ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: roleItem,
      requestId: 'req-update-role',
    });
    expect(deps.requireRoleIdentityProvider).not.toHaveBeenCalled();
    expect(identityProvider.provider.updateRole).not.toHaveBeenCalled();
    expect(deps.markRoleSyncState).not.toHaveBeenCalled();
    expect(deps.persistUpdatedRole).toHaveBeenCalledWith({
      actor,
      roleId: 'role-1',
      existing: existingRole,
      displayName: 'Editor Plus',
      description: 'Can edit more content',
      roleLevel: 25,
      externalRoleName: 'editor',
      permissionIds: ['permission-1'],
      operation: 'update',
    });
  });

  it('rejects retry sync for non-technical tenant roles', async () => {
    const keycloakError = new Error('keycloak down');
    const deps = createDeps({
      parseUpdateRoleBody: vi.fn(async () => ({ ok: true, data: { ...payload, retrySync: true }, rawBody: '{}' })),
    });
    const handler = createUpdateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'PATCH' }), ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        details: {
          syncState: 'pending',
          syncAction: 'reconcile_roles',
        },
      },
      requestId: 'req-update-role',
    });
    expect(deps.resolveMutableRole).not.toHaveBeenCalled();
    expect(identityProvider.provider.updateRole).not.toHaveBeenCalled();
    expect(keycloakError).toBeInstanceOf(Error);
  });

  it('returns DB_WRITE_FAILED without Keycloak compensation for tenant role persistence errors', async () => {
    const deps = createDeps({
      persistUpdatedRole: vi.fn(async () => {
        throw new Error('db write failed');
      }),
    });
    const handler = createUpdateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'PATCH' }), ctx);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject(dbWriteFailedErrorBody('internal_error', 'req-update-role'));
    expect(identityProvider.provider.updateRole).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Role update database write failed',
      expect.objectContaining({
        operation: 'update_role',
        error_code: 'DB_WRITE_FAILED',
        error: 'db write failed',
      })
    );
  });

  it('returns precondition responses before mutation work', async () => {
    const guardResponse = createJsonResponse(403, { error: { code: 'forbidden' } });
    const deps = createDeps({
      resolveRoleMutationActor: vi.fn(async () => ({ response: guardResponse })),
    });
    const handler = createUpdateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'PATCH' }), ctx);

    expect(response).toBe(guardResponse);
    expect(deps.parseUpdateRoleBody).not.toHaveBeenCalled();
    expect(identityProvider.provider.updateRole).not.toHaveBeenCalled();
  });

  it('returns invalid_request before Keycloak when tenant permissions are not manageable', async () => {
    const invalidResponse = createJsonResponse(400, {
      error: { code: 'invalid_request', message: 'Mindestens eine Berechtigung ist im Tenant nicht verwaltbar.' },
      requestId: 'req-update-role',
    });
    const deps = createDeps({
      validateRequestedPermissions: vi.fn(async () => invalidResponse),
    });
    const handler = createUpdateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'PATCH' }), ctx);

    expect(response).toBe(invalidResponse);
    expect(deps.requireRoleIdentityProvider).not.toHaveBeenCalled();
    expect(identityProvider.provider.updateRole).not.toHaveBeenCalled();
    expect(deps.persistUpdatedRole).not.toHaveBeenCalled();
  });

  it('marks retry DB write failures as retry failures', async () => {
    const deps = createDeps({
      persistUpdatedRole: vi.fn(async () => {
        throw new Error('db write failed');
      }),
    });

    const response = await syncTechnicalRoleUpdate(deps, preparedRetryUpdate);

    expect(response.status).toBe(500);
    expectRetrySyncFailureMarked(deps, 'DB_WRITE_FAILED');
  });

  it('marks retry compensation failures as retry failures', async () => {
    const deps = createDeps({
      persistUpdatedRole: vi.fn(async () => {
        throw new Error('db write failed');
      }),
      trackKeycloakCall: vi.fn(async (operation, work) => {
        if (operation === 'update_role_compensation') {
          throw new Error('compensation failed');
        }
        return work();
      }),
    });

    const response = await syncTechnicalRoleUpdate(deps, preparedRetryUpdate);

    expect(response.status).toBe(500);
    expectRetrySyncFailureMarked(deps, 'COMPENSATION_FAILED');
  });
});
