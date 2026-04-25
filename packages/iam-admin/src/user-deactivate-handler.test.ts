import type { IamUserDetail } from '@sva/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createDeactivateUserHandlerInternal,
  type DeactivateUserHandlerDeps,
} from './user-deactivate-handler.js';

const actor = {
  instanceId: 'de-musterhausen',
  actorAccountId: 'actor-account-1',
  requestId: 'req-deactivate',
  traceId: 'trace-deactivate',
};

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-actor-1',
    instanceId: 'de-musterhausen',
    roles: ['system_admin'],
  },
};

const userDetail = {
  id: '11111111-1111-1111-8111-111111111111',
  keycloakSubject: 'kc-user-1',
  displayName: 'Alice Example',
  email: 'alice@example.com',
  status: 'active',
  roles: [{ roleId: 'role-editor', roleKey: 'editor', roleName: 'Editor', roleLevel: 10 }],
  mainserverUserApplicationSecretSet: false,
} satisfies IamUserDetail;

const deactivatedDetail = {
  ...userDetail,
  status: 'inactive',
} satisfies IamUserDetail;

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const createDeps = (overrides: Partial<DeactivateUserHandlerDeps> = {}): DeactivateUserHandlerDeps => {
  const identityProvider = {
    provider: {
      deactivateUser: vi.fn(async () => undefined),
    },
  };
  let resolveUserDetailCallCount = 0;

  return {
    asApiItem: vi.fn((data, requestId) => ({ data, ...(requestId ? { requestId } : {}) })),
    createUnexpectedMutationErrorResponse: vi.fn(({ requestId, message }) =>
      createJsonResponse(500, { error: { code: 'internal_error', message }, requestId })
    ),
    createUserMutationErrorResponse: vi.fn(() => null),
    emitActivityLog: vi.fn(async () => undefined),
    ensureActorCanManageTarget: vi.fn(() => ({ ok: true })),
    iamUserOperationsCounter: {
      add: vi.fn(),
    },
    isRecoverableUserProjectionError: vi.fn(() => false),
    isSystemAdminAccount: vi.fn(async () => false),
    jsonResponse: vi.fn(createJsonResponse),
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
    },
    mergeMainserverCredentialState: vi.fn((user, state) => ({
      ...user,
      mainserverUserApplicationId: state.mainserverUserApplicationId,
      mainserverUserApplicationSecretSet: state.mainserverUserApplicationSecretSet,
    })),
    notifyPermissionInvalidation: vi.fn(async () => undefined),
    notFoundResponse: vi.fn((requestId) => createJsonResponse(404, { error: { code: 'not_found' }, requestId })),
    resolveActorMaxRoleLevel: vi.fn(async () => 100),
    resolveDeactivateRequestContext: vi.fn(async () => ({
      actor,
      identityProvider,
      userId: userDetail.id,
    })),
    resolveProjectedMainserverCredentialState: vi.fn(async () => ({
      mainserverUserApplicationId: 'app-1',
      mainserverUserApplicationSecretSet: true,
    })),
    resolveSystemAdminCount: vi.fn(async () => 2),
    resolveUserDetail: vi.fn(async () => {
      resolveUserDetailCallCount += 1;
      return resolveUserDetailCallCount === 1 ? userDetail : deactivatedDetail;
    }),
    trackKeycloakCall: vi.fn(async (_operation, work) => work()),
    withInstanceScopedDb: vi.fn(async (_instanceId, work) =>
      work({
        query: vi.fn(async () => ({ rows: [], rowCount: 1 })),
      })
    ),
    ...overrides,
  };
};

describe('createDeactivateUserHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deactivates a user locally and in Keycloak, invalidates permissions and returns projected detail', async () => {
    const deps = createDeps();
    const handler = createDeactivateUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${userDetail.id}`), ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: userDetail.id,
        status: 'inactive',
        mainserverUserApplicationId: 'app-1',
        mainserverUserApplicationSecretSet: true,
      },
      requestId: 'req-deactivate',
    });
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'user.deactivated',
        subjectId: userDetail.id,
      })
    );
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledWith(
      expect.anything(),
      {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
        trigger: 'user_deactivated',
      }
    );
    expect(deps.trackKeycloakCall).toHaveBeenCalledWith('deactivate_user', expect.any(Function));
    expect(deps.iamUserOperationsCounter.add).toHaveBeenCalledWith(1, {
      action: 'deactivate_user',
      result: 'success',
    });
  });

  it('returns the precondition response without mutation work', async () => {
    const preconditionResponse = createJsonResponse(400, { error: { code: 'invalid_request' } });
    const deps = createDeps({
      resolveDeactivateRequestContext: vi.fn(async () => preconditionResponse),
    });
    const handler = createDeactivateUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${userDetail.id}`), ctx);

    expect(response).toBe(preconditionResponse);
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('returns not_found when the user record does not exist', async () => {
    const deps = createDeps({
      resolveUserDetail: vi.fn(async () => undefined),
    });
    const handler = createDeactivateUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${userDetail.id}`), ctx);

    expect(response.status).toBe(404);
    expect(deps.notFoundResponse).toHaveBeenCalledWith('req-deactivate');
    expect(deps.trackKeycloakCall).not.toHaveBeenCalled();
  });

  it('maps self-deactivation through mutation error handling', async () => {
    const deps = createDeps({
      createUserMutationErrorResponse: vi.fn(() => createJsonResponse(409, { error: { code: 'self_protection' } })),
      resolveUserDetail: vi.fn(async () => ({
        ...userDetail,
        keycloakSubject: 'kc-actor-1',
      })),
    });
    const handler = createDeactivateUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${userDetail.id}`), ctx);

    expect(response.status).toBe(409);
    expect(deps.createUserMutationErrorResponse).toHaveBeenCalledWith({
      error: expect.objectContaining({
        message: 'self_protection:Eigener Nutzer kann nicht deaktiviert werden.',
      }),
      requestId: 'req-deactivate',
      forbiddenFallbackMessage: 'Deaktivierung dieses Nutzers ist nicht erlaubt.',
    });
  });

  it('protects the last active system admin', async () => {
    const deps = createDeps({
      createUserMutationErrorResponse: vi.fn(() =>
        createJsonResponse(409, { error: { code: 'last_admin_protection' } })
      ),
      isSystemAdminAccount: vi.fn(async () => true),
      resolveSystemAdminCount: vi.fn(async () => 1),
    });
    const handler = createDeactivateUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${userDetail.id}`), ctx);

    expect(response.status).toBe(409);
    expect(deps.createUserMutationErrorResponse).toHaveBeenCalledWith({
      error: expect.objectContaining({
        message: 'last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.',
      }),
      requestId: 'req-deactivate',
      forbiddenFallbackMessage: 'Deaktivierung dieses Nutzers ist nicht erlaubt.',
    });
  });

  it('logs recoverable credential projection failures and still returns the deactivated user', async () => {
    const deps = createDeps({
      isRecoverableUserProjectionError: vi.fn(() => true),
      resolveProjectedMainserverCredentialState: vi.fn(async () => {
        throw new Error('projection unavailable');
      }),
    });
    const handler = createDeactivateUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${userDetail.id}`), ctx);

    expect(response.status).toBe(200);
    expect(deps.logger.warn).toHaveBeenCalledWith(
      'IAM deactivate user credential projection degraded',
      expect.objectContaining({
        workspace_id: 'de-musterhausen',
      })
    );
  });
});
