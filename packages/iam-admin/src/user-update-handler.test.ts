import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createJsonResponse, createTestDepsBuilder } from './handler-test-helpers.js';
import {
  createUpdateUserHandlerInternal,
  RoleMutationCapabilityUnavailableError,
  shouldUpdateUserIdentityAttributes,
  shouldUpdateUserIdentityPayload,
  type UpdateUserHandlerDeps,
} from './user-update-handler.js';

type TestPayload = {
  readonly displayName?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecret?: string;
  readonly status?: 'active' | 'inactive' | 'pending';
  readonly roleIds?: readonly string[];
};

type TestPlan = {
  readonly existing: {
    readonly keycloakSubject: string;
    readonly mainserverUserApplicationId?: string;
    readonly mainserverUserApplicationSecretSet?: boolean;
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
  nextRoleNames: ['system_admin', 'editor'],
} satisfies TestPlan;

const updatedDetail = {
  id: '11111111-1111-1111-8111-111111111111',
  keycloakSubject: 'kc-user-1',
  email: 'alice.changed@example.com',
  status: 'active',
};

const userUpdateRequestUrl = `http://localhost/api/v1/iam/users/${updatedDetail.id}`;

const createUserUpdateRequest = () => new Request(userUpdateRequestUrl);

const createPlan = (overrides: Partial<TestPlan> = {}): TestPlan => ({
  existing: {
    keycloakSubject: 'kc-user-1',
  },
  previousRoleNames: [],
  ...overrides,
});

const identityProvider = {
  provider: {
    updateUser: vi.fn(async () => undefined),
    syncRoles: vi.fn(async () => undefined),
    assignRealmRoles: vi.fn(async () => undefined),
    removeRealmRoles: vi.fn(async () => undefined),
  },
};

const createLegacyIdentityProvider = () => ({
  provider: {
    updateUser: vi.fn(async () => undefined),
    syncRoles: vi.fn(async () => undefined),
  },
});

const createPlanOnlyUpdateDeps = (planOverrides: Partial<TestPlan>) => ({
  resolveUserUpdatePlan: vi.fn(async () => createPlan(planOverrides)),
  resolveUpdatedIdentityState: vi.fn(async () => ({})),
});

const createDeps = createTestDepsBuilder<UpdateUserHandlerDeps<TestPayload, TestPlan, TestIdentityState>>(() => ({
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
}));

describe('createUpdateUserHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityProvider.provider.updateUser.mockClear();
    identityProvider.provider.syncRoles.mockClear();
    identityProvider.provider.assignRealmRoles.mockClear();
    identityProvider.provider.removeRealmRoles.mockClear();
  });

  it('updates identity, assigns added technical roles, persists detail and returns the API item', async () => {
    const deps = createDeps();
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(createUserUpdateRequest(), ctx);

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
      roleKeys: ['system_admin'],
      actorAccountId: 'actor-account-1',
      requestId: 'req-update',
      traceId: 'trace-update',
    });
    expect(identityProvider.provider.assignRealmRoles).toHaveBeenCalledWith('kc-user-1', ['system_admin']);
    expect(identityProvider.provider.syncRoles).not.toHaveBeenCalled();
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

  it('removes system_admin on demotion without broad role replacement or legacy role deletion', async () => {
    const deps = createDeps({
      resolveUserUpdatePlan: vi.fn(async () => createPlan({
        previousRoleNames: ['system_admin', 'legacy_keycloak_editor'],
        nextRoleNames: ['editor'],
      })),
    });
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(createUserUpdateRequest(), ctx);

    expect(response.status).toBe(200);
    expect(deps.ensureManagedRealmRolesExist).not.toHaveBeenCalled();
    expect(identityProvider.provider.removeRealmRoles).toHaveBeenCalledWith('kc-user-1', ['system_admin']);
    expect(identityProvider.provider.assignRealmRoles).not.toHaveBeenCalled();
    expect(identityProvider.provider.syncRoles).not.toHaveBeenCalled();
  });

  it('does not require role mutation capabilities when no technical role delta exists', async () => {
    const legacyIdentityProvider = createLegacyIdentityProvider();
    const deps = createDeps({
      resolveUpdateRequestContext: vi.fn(async () => ({
        actor,
        identityProvider: legacyIdentityProvider,
        payload: {
          firstName: 'Alice',
        },
        userId: updatedDetail.id,
      })),
      ...createPlanOnlyUpdateDeps({
        previousRoleNames: ['system_admin'],
        nextRoleNames: undefined,
      }),
    });
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(createUserUpdateRequest(), ctx);

    expect(response.status).toBe(200);
    expect(legacyIdentityProvider.provider.updateUser).toHaveBeenCalledWith(
      'kc-user-1',
      expect.objectContaining({ firstName: 'Alice' })
    );
    expect(legacyIdentityProvider.provider.syncRoles).not.toHaveBeenCalled();
    expect(deps.ensureManagedRealmRolesExist).not.toHaveBeenCalled();
  });

  it('persists db-only role updates without resolving an identity provider', async () => {
    const deps = createDeps({
      resolveUpdateRequestContext: vi.fn(async () => ({
        actor,
        payload: {
          roleIds: ['role-editor'],
        },
        resolveIdentityProvider: vi.fn(async () => {
          throw new Error('identity provider should not be resolved');
        }),
        userId: updatedDetail.id,
      })),
      ...createPlanOnlyUpdateDeps({
        existing: {
          keycloakSubject: 'kc-user-1',
          mainserverUserApplicationId: 'existing-app',
          mainserverUserApplicationSecretSet: true,
        },
        previousRoleNames: [],
        nextRoleNames: [],
      }),
    });
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(createUserUpdateRequest(), ctx);

    expect(response.status).toBe(200);
    expect(deps.resolveUpdatedIdentityState).toHaveBeenCalledWith({
      plan: expect.objectContaining({
        previousRoleNames: [],
        nextRoleNames: [],
      }),
      payload: {
        roleIds: ['role-editor'],
      },
      identityProvider: undefined,
    });
    expect(identityProvider.provider.updateUser).not.toHaveBeenCalled();
    expect(deps.ensureManagedRealmRolesExist).not.toHaveBeenCalled();
    expect(deps.persistUpdatedUserDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        existingMainserverCredentialState: {
          mainserverUserApplicationId: 'existing-app',
          mainserverUserApplicationSecretSet: true,
        },
      })
    );
  });

  it('fails through the Keycloak error mapping when a technical role delta needs missing capabilities', async () => {
    const mappedResponse = createJsonResponse(503, { error: { code: 'keycloak_unavailable' } });
    const assignRealmRoles = vi.fn(async () => undefined);
    const partialIdentityProvider = {
      provider: {
        ...createLegacyIdentityProvider().provider,
        assignRealmRoles,
      },
    };
    const deps = createDeps({
      resolveUpdateRequestContext: vi.fn(async () => ({
        actor,
        identityProvider: partialIdentityProvider,
        payload,
        userId: updatedDetail.id,
      })),
      handleKeycloakUpdateError: vi.fn(({ error }) =>
        error instanceof RoleMutationCapabilityUnavailableError ? mappedResponse : null
      ),
      resolveUpdatedIdentityState: vi.fn(async () => ({})),
    });
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(createUserUpdateRequest(), ctx);

    expect(response).toBe(mappedResponse);
    expect(assignRealmRoles).not.toHaveBeenCalled();
    expect(deps.handleKeycloakUpdateError).toHaveBeenCalledWith({
      error: expect.any(RoleMutationCapabilityUnavailableError),
      requestId: 'req-update',
    });
    expect(deps.compensateUserIdentityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        identityProvider: partialIdentityProvider,
        restoreRoles: false,
      })
    );
    expect(deps.persistUpdatedUserDetail).not.toHaveBeenCalled();
  });

  it('returns the precondition response without update work', async () => {
    const preconditionResponse = createJsonResponse(400, { error: { code: 'invalid_request' } });
    const deps = createDeps({
      resolveUpdateRequestContext: vi.fn(async () => preconditionResponse),
    });
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(createUserUpdateRequest(), ctx);

    expect(response).toBe(preconditionResponse);
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('returns not_found when no update plan exists', async () => {
    const deps = createDeps({
      resolveUserUpdatePlan: vi.fn(async () => undefined),
    });
    const handler = createUpdateUserHandlerInternal(deps);

    const response = await handler(createUserUpdateRequest(), ctx);

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

    const response = await handler(createUserUpdateRequest(), ctx);

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

    const response = await handler(createUserUpdateRequest(), ctx);

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

    const response = await handler(createUserUpdateRequest(), ctx);

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

describe('user update identity predicates', () => {
  it('keeps attribute updates as a subset of identity-provider updates', () => {
    const attributePayloads: readonly TestPayload[] = [
      { displayName: 'Alice' },
      { mainserverUserApplicationId: 'app-1' },
      { mainserverUserApplicationSecret: 'secret-1' },
    ];

    for (const payload of attributePayloads) {
      expect(shouldUpdateUserIdentityAttributes(payload)).toBe(true);
      expect(shouldUpdateUserIdentityPayload(payload)).toBe(true);
    }

    expect(shouldUpdateUserIdentityAttributes({ email: 'alice@example.test' })).toBe(false);
    expect(shouldUpdateUserIdentityPayload({ email: 'alice@example.test' })).toBe(true);
    expect(shouldUpdateUserIdentityPayload({ roleIds: ['role-editor'] })).toBe(false);
  });
});
