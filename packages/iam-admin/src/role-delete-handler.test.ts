import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dbWriteFailedErrorBody } from '../test-support/handler-test-helpers.js';
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

const systemAdminRole = {
  ...existingRole,
  role_key: 'system_admin',
  role_name: 'system_admin',
  display_name: 'System Admin',
  external_role_name: 'system_admin',
  is_system_role: true,
  role_level: 90,
};

const identityProvider = {
  provider: {
    assignRealmRoles: vi.fn(async () => undefined),
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

const rejectDbWrite = async () => {
  throw new Error('db write failed');
};

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
    listDirectRoleAssignmentSubjects: vi.fn(async () => []),
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

const runDeleteRoleRequest = (
  deps: DeleteRoleHandlerDeps<ReturnType<typeof buildAttributes>, typeof identityProvider, typeof existingRole>
) => {
  const handler = createDeleteRoleHandlerInternal(deps);
  return handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'DELETE' }), ctx);
};

describe('createDeleteRoleHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityProvider.provider.assignRealmRoles.mockClear();
    identityProvider.provider.createRole.mockClear();
    identityProvider.provider.deleteRole.mockClear();
  });

  it('deletes tenant roles locally without deleting Keycloak roles', async () => {
    const deps = createDeps();

    const response = await runDeleteRoleRequest(deps);

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
    expect(deps.requireRoleIdentityProvider).not.toHaveBeenCalled();
    expect(identityProvider.provider.deleteRole).not.toHaveBeenCalled();
    expect(deps.deleteRoleFromDatabase).toHaveBeenCalledWith({
      actor,
      roleId: 'role-1',
      roleKey: 'editor',
      externalRoleName: 'editor',
    });
  });

  it('does not require Keycloak for local role deletion', async () => {
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

    const response = await runDeleteRoleRequest(deps);

    expect(response.status).toBe(200);
    expect(deps.deleteRoleFromDatabase).toHaveBeenCalled();
    expect(identityProvider.provider.deleteRole).not.toHaveBeenCalled();
  });

  it('returns DB_WRITE_FAILED without Keycloak compensation when local deletion fails', async () => {
    const deps = createDeps({
      deleteRoleFromDatabase: vi.fn(rejectDbWrite),
    });

    const response = await runDeleteRoleRequest(deps);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject(dbWriteFailedErrorBody('internal_error', 'req-delete-role'));
    expect(deps.requireRoleIdentityProvider).not.toHaveBeenCalled();
    expect(identityProvider.provider.deleteRole).not.toHaveBeenCalled();
    expect(identityProvider.provider.createRole).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Role delete database write failed',
      expect.objectContaining({
        operation: 'delete_role',
        error_code: 'DB_WRITE_FAILED',
        error: 'db write failed',
      })
    );
  });

  it('marks sync failure when Keycloak deletion fails with a non-404 error', async () => {
    const deps = createDeps({
      resolveDeletableRole: vi.fn(async () => ({
        ...existingRole,
        role_key: 'system_admin',
        role_name: 'system_admin',
        display_name: 'System Admin',
        external_role_name: 'system_admin',
        is_system_role: true,
        role_level: 90,
      })),
      trackKeycloakCall: vi.fn(async (operation, work) => {
        if (operation === 'delete_role') {
          throw new Error('keycloak down');
        }
        return work();
      }),
    });

    const response = await runDeleteRoleRequest(deps);

    expect(response.status).toBe(503);
    expect(deps.markDeleteRoleSyncState).toHaveBeenCalledWith({
      actor,
      roleId: 'role-1',
      roleKey: 'system_admin',
      externalRoleName: 'system_admin',
      result: 'failure',
      eventType: 'role.sync_failed',
      errorCode: 'IDP_UNAVAILABLE',
      syncState: 'failed',
    });
  });

  it('deletes technical roles in Keycloak by canonical role key when legacy aliases exist', async () => {
    const deps = createDeps({
      resolveDeletableRole: vi.fn(async () => ({
        ...systemAdminRole,
        external_role_name: 'legacy-system-admin',
      })),
    });

    const response = await runDeleteRoleRequest(deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        roleKey: 'system_admin',
        externalRoleName: 'system_admin',
      },
    });
    expect(identityProvider.provider.deleteRole).toHaveBeenCalledWith('system_admin');
    expect(deps.deleteRoleFromDatabase).toHaveBeenCalledWith({
      actor,
      roleId: 'role-1',
      roleKey: 'system_admin',
      externalRoleName: 'system_admin',
    });
  });

  it('recreates the role in Keycloak when local deletion fails', async () => {
    const deps = createDeps({
      resolveDeletableRole: vi.fn(async () => systemAdminRole),
      deleteRoleFromDatabase: vi.fn(rejectDbWrite),
    });

    const response = await runDeleteRoleRequest(deps);

    expect(response.status).toBe(500);
    expect(identityProvider.provider.createRole).toHaveBeenCalledWith({
      externalName: 'system_admin',
      description: 'Can edit content',
      attributes: {
        managedBy: 'studio',
        instanceId: 'de-musterhausen',
        roleKey: 'system_admin',
        displayName: 'System Admin',
      },
    });
  });

  it('replays direct user role mappings when compensation recreates a deleted role', async () => {
    const deps = createDeps({
      resolveDeletableRole: vi.fn(async () => systemAdminRole),
      deleteRoleFromDatabase: vi.fn(rejectDbWrite),
      listDirectRoleAssignmentSubjects: vi.fn(async () => ['kc-user-1', 'kc-user-2']),
    });

    const response = await runDeleteRoleRequest(deps);

    expect(response.status).toBe(500);
    expect(identityProvider.provider.createRole).toHaveBeenCalledOnce();
    expect(identityProvider.provider.assignRealmRoles).toHaveBeenCalledTimes(2);
    expect(identityProvider.provider.assignRealmRoles).toHaveBeenNthCalledWith(1, 'kc-user-1', ['system_admin']);
    expect(identityProvider.provider.assignRealmRoles).toHaveBeenNthCalledWith(2, 'kc-user-2', ['system_admin']);
  });

  it('preserves the provider method context when replaying direct role assignments during compensation', async () => {
    const assignCalls: unknown[] = [];
    const contextualIdentityProvider = {
      provider: {
        createRole: vi.fn(async () => undefined),
        deleteRole: vi.fn(async () => undefined),
        assignRealmRoles(this: unknown, _subject: string, _roles: readonly string[]) {
          assignCalls.push(this);
          return Promise.resolve();
        },
      },
    };
    const deps = createDeps({
      resolveDeletableRole: vi.fn(async () => systemAdminRole),
      deleteRoleFromDatabase: vi.fn(rejectDbWrite),
      listDirectRoleAssignmentSubjects: vi.fn(async () => ['kc-user-1']),
      requireRoleIdentityProvider: vi.fn(async () => contextualIdentityProvider),
    });

    const response = await runDeleteRoleRequest(deps);

    expect(response.status).toBe(500);
    expect(assignCalls).toEqual([contextualIdentityProvider.provider]);
  });
});
