import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createUpdateRoleHandlerInternal, type UpdateRoleHandlerDeps } from './role-update-handler.js';

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

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const createDeps = (
  overrides: Partial<
    UpdateRoleHandlerDeps<typeof payload, ReturnType<typeof buildAttributes>, typeof identityProvider, typeof existingRole, typeof roleItem>
  > = {}
) =>
  ({
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
    ...overrides,
  }) satisfies UpdateRoleHandlerDeps<
    typeof payload,
    ReturnType<typeof buildAttributes>,
    typeof identityProvider,
    typeof existingRole,
    typeof roleItem
  >;

function buildAttributes(input: { readonly instanceId: string; readonly roleKey: string; readonly displayName: string }) {
  return { managedBy: 'studio' as const, ...input };
}

describe('createUpdateRoleHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityProvider.provider.updateRole.mockClear();
  });

  it('updates the role in Keycloak, persists it locally and returns the API item', async () => {
    const deps = createDeps();
    const handler = createUpdateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'PATCH' }), ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: roleItem,
      requestId: 'req-update-role',
    });
    expect(identityProvider.provider.updateRole).toHaveBeenCalledWith('editor', {
      description: 'Can edit more content',
      attributes: {
        managedBy: 'studio',
        instanceId: 'de-musterhausen',
        roleKey: 'editor',
        displayName: 'Editor Plus',
      },
    });
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

  it('marks sync failure and returns the injected Keycloak failure response', async () => {
    const keycloakError = new Error('keycloak down');
    const deps = createDeps({
      trackKeycloakCall: vi.fn(async (operation, work) => {
        if (operation === 'update_role') {
          throw keycloakError;
        }
        return work();
      }),
    });
    const handler = createUpdateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'PATCH' }), ctx);

    expect(response.status).toBe(503);
    expect(deps.markRoleSyncState).toHaveBeenCalledWith({
      actor,
      roleId: 'role-1',
      operation: 'update',
      result: 'failure',
      roleKey: 'editor',
      externalRoleName: 'editor',
      errorCode: 'IDP_UNAVAILABLE',
      syncState: 'failed',
    });
    expect(deps.buildRoleSyncFailure).toHaveBeenCalledWith({
      error: keycloakError,
      requestId: 'req-update-role',
      fallbackMessage: 'Rolle konnte nicht mit Keycloak synchronisiert werden.',
      roleId: 'role-1',
    });
  });

  it('compensates Keycloak when local persistence fails after the external update', async () => {
    const deps = createDeps({
      persistUpdatedRole: vi.fn(async () => {
        throw new Error('db write failed');
      }),
    });
    const handler = createUpdateRoleHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/roles/role-1', { method: 'PATCH' }), ctx);

    expect(response.status).toBe(500);
    expect(identityProvider.provider.updateRole).toHaveBeenCalledTimes(2);
    expect(identityProvider.provider.updateRole).toHaveBeenLastCalledWith('editor', {
      description: 'Can edit content',
      attributes: {
        managedBy: 'studio',
        instanceId: 'de-musterhausen',
        roleKey: 'editor',
        displayName: 'Editor',
      },
    });
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Role update database write failed after successful Keycloak update',
      expect.objectContaining({
        error: 'db write failed',
        role_key: 'editor',
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
});
