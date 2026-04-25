import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createUpdateUserHandlerInternal,
  type UpdateUserHandlerDeps,
} from './user-update-handler.js';

type TestPayload = {
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly status?: 'active' | 'inactive' | 'pending';
  readonly roleIds?: readonly string[];
};

type TestPlan = {
  readonly existing: {
    readonly keycloakSubject: string;
  };
  readonly previousRoleNames: readonly string[];
  readonly nextRoleNames?: readonly string[];
};

type TestIdentityState = {
  readonly existingIdentityAttributes?: Record<string, string[]>;
  readonly nextIdentityAttributes?: Record<string, string[]>;
  readonly nextMainserverCredentialState?: {
    readonly mainserverUserApplicationId?: string;
    readonly mainserverUserApplicationSecretSet: boolean;
  };
};

const actor = {
  instanceId: 'de-musterhausen',
  actorAccountId: 'actor-account-1',
  requestId: 'req-update',
  traceId: 'trace-update',
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
  email: 'alice.changed@example.com',
  firstName: 'Alice',
  status: 'active',
  roleIds: ['role-editor'],
} satisfies TestPayload;

const plan = {
  existing: {
    keycloakSubject: 'kc-user-1',
  },
  previousRoleNames: ['viewer'],
  nextRoleNames: ['editor'],
} satisfies TestPlan;

const updatedDetail = {
  id: '11111111-1111-1111-8111-111111111111',
  keycloakSubject: 'kc-user-1',
  email: 'alice.changed@example.com',
  status: 'active',
};

const identityProvider = {
  provider: {
    updateUser: vi.fn(async () => undefined),
    syncRoles: vi.fn(async () => undefined),
  },
};

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const createDeps = (
  overrides: Partial<UpdateUserHandlerDeps<TestPayload, TestPlan, TestIdentityState>> = {}
): UpdateUserHandlerDeps<TestPayload, TestPlan, TestIdentityState> => ({
  asApiItem: vi.fn((data, requestId) => ({ data, ...(requestId ? { requestId } : {}) })),
  compensateUserIdentityUpdate: vi.fn(async () => undefined),
  createUnexpectedMutationErrorResponse: vi.fn(({ requestId, message }) =>
    createJsonResponse(500, { error: { code: 'internal_error', message }, requestId })
  ),
  createUserMutationErrorResponse: vi.fn(() => null),
  ensureManagedRealmRolesExist: vi.fn(async () => undefined),
  handleKeycloakUpdateError: vi.fn(() => null),
  iamUserOperationsCounter: {
    add: vi.fn(),
  },
  jsonResponse: vi.fn(createJsonResponse),
  logger: {
    error: vi.fn(),
  },
  notFoundResponse: vi.fn((requestId) => createJsonResponse(404, { error: { code: 'not_found' }, requestId })),
  persistUpdatedUserDetail: vi.fn(async () => updatedDetail),
  resolveUpdateRequestContext: vi.fn(async () => ({
    actor,
    identityProvider,
    payload,
    userId: updatedDetail.id,
  })),
  resolveUpdatedIdentityState: vi.fn(async () => ({
    existingIdentityAttributes: { displayName: ['Alice Example'] },
    nextIdentityAttributes: { displayName: ['Alice Changed'] },
    nextMainserverCredentialState: { mainserverUserApplicationId: 'app-1', mainserverUserApplicationSecretSet: true },
  })),
  resolveUserUpdatePlan: vi.fn(async () => plan),
  trackKeycloakCall: vi.fn(async (_operation, work) => work()),
  withInstanceScopedDb: vi.fn(async (_instanceId, work) =>
    work({
      query: vi.fn(async () => ({ rows: [], rowCount: 1 })),
    })
  ),
  ...overrides,
});

describe('createUpdateUserHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityProvider.provider.updateUser.mockClear();
    identityProvider.provider.syncRoles.mockClear();
  });

  it('updates identity, syncs roles, persists detail and returns the API item', async () => {
    const deps = createDeps();
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${updatedDetail.id}`), ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: updatedDetail.id,
        email: 'alice.changed@example.com',
      },
      requestId: 'req-update',
    });
    expect(deps.resolveUserUpdatePlan).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'de-musterhausen',
      actorSubject: 'kc-actor-1',
      actorRoles: ['system_admin'],
      userId: updatedDetail.id,
      payload,
    });
    expect(identityProvider.provider.updateUser).toHaveBeenCalledWith('kc-user-1', {
      email: 'alice.changed@example.com',
      firstName: 'Alice',
      lastName: undefined,
      enabled: true,
      attributes: { displayName: ['Alice Changed'] },
    });
    expect(deps.ensureManagedRealmRolesExist).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      identityProvider,
      externalRoleNames: ['editor'],
      actorAccountId: 'actor-account-1',
      requestId: 'req-update',
      traceId: 'trace-update',
    });
    expect(identityProvider.provider.syncRoles).toHaveBeenCalledWith('kc-user-1', ['editor']);
    expect(deps.persistUpdatedUserDetail).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      requestId: 'req-update',
      traceId: 'trace-update',
      actorAccountId: 'actor-account-1',
      userId: updatedDetail.id,
      keycloakSubject: 'kc-user-1',
      payload,
      nextMainserverCredentialState: { mainserverUserApplicationId: 'app-1', mainserverUserApplicationSecretSet: true },
    });
    expect(deps.iamUserOperationsCounter.add).toHaveBeenCalledWith(1, {
      action: 'update_user',
      result: 'success',
    });
  });

  it('returns the precondition response without update work', async () => {
    const preconditionResponse = createJsonResponse(400, { error: { code: 'invalid_request' } });
    const deps = createDeps({
      resolveUpdateRequestContext: vi.fn(async () => preconditionResponse),
    });
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${updatedDetail.id}`), ctx);

    expect(response).toBe(preconditionResponse);
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('returns not_found when no update plan exists', async () => {
    const deps = createDeps({
      resolveUserUpdatePlan: vi.fn(async () => undefined),
    });
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${updatedDetail.id}`), ctx);

    expect(response.status).toBe(404);
    expect(deps.notFoundResponse).toHaveBeenCalledWith('req-update');
    expect(identityProvider.provider.updateUser).not.toHaveBeenCalled();
  });

  it('compensates identity and roles when persistence fails after external sync', async () => {
    const deps = createDeps({
      persistUpdatedUserDetail: vi.fn(async () => {
        throw new Error('database unavailable');
      }),
    });
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${updatedDetail.id}`), ctx);

    expect(response.status).toBe(500);
    expect(deps.compensateUserIdentityUpdate).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      requestId: 'req-update',
      traceId: 'trace-update',
      userId: updatedDetail.id,
      plan,
      restoreIdentity: true,
      restoreRoles: true,
      restoreIdentityAttributes: { displayName: ['Alice Example'] },
      identityProvider,
    });
  });

  it('uses the injected Keycloak error mapping before generic mutation errors', async () => {
    const mappedResponse = createJsonResponse(503, { error: { code: 'keycloak_unavailable' } });
    const deps = createDeps({
      handleKeycloakUpdateError: vi.fn(() => mappedResponse),
      resolveUpdatedIdentityState: vi.fn(async () => {
        throw new Error('keycloak unavailable');
      }),
    });
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${updatedDetail.id}`), ctx);

    expect(response).toBe(mappedResponse);
    expect(deps.createUserMutationErrorResponse).not.toHaveBeenCalled();
  });

  it('logs unknown failures and returns an unexpected mutation response', async () => {
    const deps = createDeps({
      resolveUpdatedIdentityState: vi.fn(async () => {
        throw new Error('unexpected failure');
      }),
    });
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${updatedDetail.id}`), ctx);

    expect(response.status).toBe(500);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'IAM user update failed',
      expect.objectContaining({
        workspace_id: 'de-musterhausen',
      })
    );
    expect(deps.iamUserOperationsCounter.add).toHaveBeenCalledWith(1, {
      action: 'update_user',
      result: 'failure',
    });
  });
});
