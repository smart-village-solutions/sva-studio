import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  persistCreatedUser: vi.fn(),
  ensureManagedRealmRolesExist: vi.fn(),
  resolveIdentityProviderForInstance: vi.fn(),
  resolveAuthConfigForInstance: vi.fn(),
  provisionMainserverUserCredentials: vi.fn(),
  trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) => execute()),
  withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (client: object) => Promise<unknown>) => work({})),
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('./user-create-persistence.js', () => ({
  persistCreatedUser: state.persistCreatedUser,
}));

vi.mock('./shared-managed-role-sync.js', () => ({
  ensureManagedRealmRolesExist: state.ensureManagedRealmRolesExist,
}));

vi.mock('./shared.js', () => ({
  logger: state.logger,
  resolveIdentityProviderForInstance: state.resolveIdentityProviderForInstance,
  trackKeycloakCall: state.trackKeycloakCall,
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

vi.mock('../config.js', () => ({
  resolveAuthConfigForInstance: state.resolveAuthConfigForInstance,
}));

vi.mock('./mainserver-user-provisioning.js', () => ({
  provisionMainserverUserCredentials: state.provisionMainserverUserCredentials,
}));

describe('executeCreateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.persistCreatedUser.mockResolvedValue({
      responseData: {
        id: 'account-1',
        keycloakSubject: 'kc-user-1',
        displayName: 'Alice Example',
        status: 'active',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
      roleNames: [],
    });
    state.resolveAuthConfigForInstance.mockResolvedValue({
      clientId: 'sva-studio',
      redirectUri: 'https://tenant.example.test/auth/callback',
      postLogoutRedirectUri: 'https://tenant.example.test/',
    });
    state.provisionMainserverUserCredentials.mockResolvedValue(null);
  });

  it('creates a user without sending an invite when the payload disables it', async () => {
    const identityProvider = {
      provider: {
        createUser: vi.fn(async () => ({ externalId: 'kc-user-1' })),
        syncRoles: vi.fn(async () => undefined),
        executeActionsEmail: vi.fn(async () => undefined),
      },
      realm: 'tenant-realm',
      source: 'instance' as const,
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin' as const,
    };

    const { executeCreateUser } = await import('./user-create-operation.js');
    const result = await executeCreateUser({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
      },
      actorSubject: 'kc-actor-1',
      identityProvider,
      payload: {
        email: 'alice@example.com',
        firstName: 'Alice',
        roleIds: [],
        sendPasswordSetupEmail: false,
      },
    });

    expect(identityProvider.provider.executeActionsEmail).not.toHaveBeenCalled();
    expect(result.invitation.status).toBe('not_requested');
  }, 15_000);

  it('provisions Mainserver credentials for the created Keycloak user after local persistence and role sync', async () => {
    state.provisionMainserverUserCredentials.mockResolvedValue({
      mainserverUserApplicationId: 'mainserver-app-1',
      mainserverUserApplicationSecret: 'mainserver-secret-1',
    });
    state.persistCreatedUser.mockResolvedValue({
      responseData: {
        id: 'account-1',
        keycloakSubject: 'kc-user-1',
        displayName: 'Alice Example',
        status: 'active',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
      roleNames: ['system_admin'],
    });
    const identityProvider = {
      provider: {
        createUser: vi.fn(async () => ({ externalId: 'kc-user-1' })),
        updateUser: vi.fn(async () => undefined),
        syncRoles: vi.fn(async () => undefined),
      },
      realm: 'tenant-realm',
      source: 'instance' as const,
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin' as const,
    };

    const { executeCreateUser } = await import('./user-create-operation.js');
    await executeCreateUser({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      actorSubject: 'kc-actor-1',
      identityProvider,
      payload: {
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Example',
        roleIds: [],
        sendPasswordSetupEmail: false,
      },
    });

    expect(state.persistCreatedUser).toHaveBeenCalled();
    expect(identityProvider.provider.syncRoles).toHaveBeenCalledWith('kc-user-1', ['system_admin']);
    expect(state.provisionMainserverUserCredentials).toHaveBeenCalledWith({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      actorSubject: 'kc-actor-1',
      keycloakSubject: 'kc-user-1',
      payload: {
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Example',
        roleIds: [],
        sendPasswordSetupEmail: false,
      },
    });
    expect(identityProvider.provider.updateUser).not.toHaveBeenCalled();
    expect(state.persistCreatedUser.mock.invocationCallOrder[0]).toBeLessThan(
      identityProvider.provider.syncRoles.mock.invocationCallOrder[0] ?? 0
    );
    expect(identityProvider.provider.syncRoles.mock.invocationCallOrder[0]).toBeLessThan(
      state.provisionMainserverUserCredentials.mock.invocationCallOrder[0] ?? 0
    );
  });

  it('keeps the local user active when Mainserver provisioning fails after persistence', async () => {
    state.provisionMainserverUserCredentials.mockRejectedValue(new Error('mainserver unavailable'));
    const deactivateUser = vi.fn(async () => undefined);
    state.resolveIdentityProviderForInstance.mockResolvedValue({
      provider: { deactivateUser },
      realm: 'tenant-realm',
      source: 'instance',
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin',
    });
    const identityProvider = {
      provider: {
        createUser: vi.fn(async () => ({ externalId: 'kc-user-1' })),
        syncRoles: vi.fn(async () => undefined),
      },
      realm: 'tenant-realm',
      source: 'instance' as const,
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin' as const,
    };

    const { executeCreateUser } = await import('./user-create-operation.js');
    const result = await executeCreateUser({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      actorSubject: 'kc-actor-1',
      identityProvider,
      payload: {
        email: 'alice@example.com',
        firstName: 'Alice',
        roleIds: [],
        sendPasswordSetupEmail: false,
      },
    });

    expect(result.user).toMatchObject({
      id: 'account-1',
      keycloakSubject: 'kc-user-1',
      mainserverUserApplicationSecretSet: false,
    });
    expect(result.invitation.status).toBe('not_requested');
    expect(state.resolveIdentityProviderForInstance).not.toHaveBeenCalled();
    expect(deactivateUser).not.toHaveBeenCalled();
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM user mainserver provisioning failed',
      expect.objectContaining({
        workspace_id: 'instance-1',
      })
    );
  });

  it('sends an UPDATE_PASSWORD invitation after successful creation when requested', async () => {
    const executeActionsEmail = vi.fn(async function (
      this: { assertWriteAvailability: () => void },
      _userId: string,
      _input: {
        actions: readonly string[];
        clientId?: string;
        redirectUri?: string;
      }
    ) {
      this.assertWriteAvailability();
    });
    const identityProvider = {
      provider: {
        createUser: vi.fn(async () => ({ externalId: 'kc-user-1' })),
        syncRoles: vi.fn(async () => undefined),
        listUsers: vi.fn(async () => [{ externalId: 'kc-user-1', email: 'alice@example.com' }]),
        assertWriteAvailability: vi.fn(),
        executeActionsEmail,
      },
      realm: 'tenant-realm',
      source: 'instance' as const,
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin' as const,
    };

    const { executeCreateUser } = await import('./user-create-operation.js');
    const result = await executeCreateUser({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
      },
      actorSubject: 'kc-actor-1',
      identityProvider,
      payload: {
        email: 'alice@example.com',
        firstName: 'Alice',
        roleIds: [],
        sendPasswordSetupEmail: true,
      },
    });

    expect(identityProvider.provider.executeActionsEmail).toHaveBeenCalledWith('kc-user-1', {
      actions: ['UPDATE_PASSWORD'],
      clientId: 'sva-studio',
      redirectUri: 'https://tenant.example.test/auth/callback',
    });
    expect(identityProvider.provider.assertWriteAvailability).toHaveBeenCalledTimes(1);
    expect(result.invitation.status).toBe('sent');
  });

  it('keeps user creation successful and marks the invitation as failed when email delivery fails', async () => {
    const identityProvider = {
      provider: {
        createUser: vi.fn(async () => ({ externalId: 'kc-user-1' })),
        syncRoles: vi.fn(async () => undefined),
        listUsers: vi.fn(async () => [{ externalId: 'kc-user-1', email: 'alice@example.com' }]),
        executeActionsEmail: vi.fn(async () => {
          throw new Error('smtp failed');
        }),
      },
      realm: 'tenant-realm',
      source: 'instance' as const,
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin' as const,
    };

    const { executeCreateUser } = await import('./user-create-operation.js');
    const result = await executeCreateUser({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      actorSubject: 'kc-actor-1',
      identityProvider,
      payload: {
        email: 'alice@example.com',
        firstName: 'Alice',
        roleIds: [],
        sendPasswordSetupEmail: true,
      },
    });

    expect(result.user.id).toBe('account-1');
    expect(result).toMatchObject({
      invitation: {
        status: 'failed',
        error: {
          code: 'internal_error',
          message: 'Einladungs-E-Mail konnte nicht versendet werden.',
          retryable: false,
        },
      },
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM user invitation email failed',
      expect.objectContaining({
        workspace_id: 'instance-1',
      })
    );
  });

  it('waits until the created Keycloak user is queryable before sending the invitation email', async () => {
    vi.useFakeTimers();
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ externalId: 'kc-user-1', email: 'alice@example.com' }]);
    const executeActionsEmail = vi.fn(async () => undefined);
    const identityProvider = {
      provider: {
        createUser: vi.fn(async () => ({ externalId: 'kc-user-1' })),
        syncRoles: vi.fn(async () => undefined),
        listUsers,
        executeActionsEmail,
      },
      realm: 'tenant-realm',
      source: 'instance' as const,
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin' as const,
    };

    const { executeCreateUser } = await import('./user-create-operation.js');
    const resultPromise = executeCreateUser({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
      },
      actorSubject: 'kc-actor-1',
      identityProvider,
      payload: {
        email: 'alice@example.com',
        firstName: 'Alice',
        roleIds: [],
        sendPasswordSetupEmail: true,
      },
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.invitation.status).toBe('sent');
    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(listUsers).toHaveBeenNthCalledWith(1, { email: 'alice@example.com' });
    expect(listUsers).toHaveBeenNthCalledWith(2, { email: 'alice@example.com' });
    expect(executeActionsEmail).toHaveBeenCalledWith('kc-user-1', {
      actions: ['UPDATE_PASSWORD'],
      clientId: 'sva-studio',
      redirectUri: 'https://tenant.example.test/auth/callback',
    });

    vi.useRealTimers();
  });

  it('returns a precise invitation failure when the created user does not become queryable in Keycloak in time', async () => {
    vi.useFakeTimers();
    const identityProvider = {
      provider: {
        createUser: vi.fn(async () => ({ externalId: 'kc-user-1' })),
        syncRoles: vi.fn(async () => undefined),
        listUsers: vi.fn(async () => []),
        executeActionsEmail: vi.fn(async () => undefined),
      },
      realm: 'tenant-realm',
      source: 'instance' as const,
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin' as const,
    };

    const { executeCreateUser } = await import('./user-create-operation.js');
    const resultPromise = executeCreateUser({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      actorSubject: 'kc-actor-1',
      identityProvider,
      payload: {
        email: 'alice@example.com',
        firstName: 'Alice',
        roleIds: [],
        sendPasswordSetupEmail: true,
      },
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toMatchObject({
      invitation: {
        status: 'failed',
        error: {
          code: 'keycloak_user_not_ready',
          retryable: true,
        },
      },
    });
    expect(identityProvider.provider.executeActionsEmail).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('ensures managed realm roles exist before syncing mapped roles to the created identity user', async () => {
    state.persistCreatedUser.mockResolvedValue({
      responseData: {
        id: 'account-1',
        keycloakSubject: 'kc-user-1',
        displayName: 'Alice Example',
        status: 'active',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
      roleNames: ['system_admin', 'editor'],
    });
    const identityProvider = {
      provider: {
        createUser: vi.fn(async () => ({ externalId: 'kc-user-1' })),
        syncRoles: vi.fn(async () => undefined),
      },
      realm: 'tenant-realm',
      source: 'instance' as const,
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin' as const,
    };

    const { executeCreateUser } = await import('./user-create-operation.js');
    await executeCreateUser({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      actorSubject: 'kc-actor-1',
      identityProvider,
      payload: {
        email: 'alice@example.com',
        firstName: 'Alice',
        roleIds: ['role-1', 'role-2'],
        sendPasswordSetupEmail: false,
      },
    });

    expect(state.ensureManagedRealmRolesExist).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      identityProvider,
      externalRoleNames: ['system_admin', 'editor'],
      actorAccountId: 'actor-1',
      requestId: 'req-1',
      traceId: 'trace-1',
    });
    expect(identityProvider.provider.syncRoles).toHaveBeenCalledWith('kc-user-1', ['system_admin', 'editor']);
  });

  it('deactivates the created external user when persistence fails after Keycloak creation', async () => {
    state.persistCreatedUser.mockRejectedValue(new Error('db write failed'));
    const deactivateUser = vi.fn(async () => undefined);
    state.resolveIdentityProviderForInstance.mockResolvedValue({
      provider: { deactivateUser },
      realm: 'tenant-realm',
      source: 'instance',
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin',
    });
    const identityProvider = {
      provider: {
        createUser: vi.fn(async () => ({ externalId: 'kc-user-1' })),
        syncRoles: vi.fn(async () => undefined),
      },
      realm: 'tenant-realm',
      source: 'instance' as const,
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin' as const,
    };

    const { executeCreateUser } = await import('./user-create-operation.js');

    await expect(
      executeCreateUser({
        actor: {
          instanceId: 'instance-1',
          actorAccountId: 'actor-1',
          requestId: 'req-1',
          traceId: 'trace-1',
        },
        actorSubject: 'kc-actor-1',
        identityProvider,
        payload: {
          email: 'alice@example.com',
          firstName: 'Alice',
          roleIds: [],
          sendPasswordSetupEmail: false,
        },
      })
    ).rejects.toThrow('db write failed');

    expect(state.resolveIdentityProviderForInstance).toHaveBeenCalledWith('instance-1', {
      executionMode: 'tenant_admin',
    });
    expect(deactivateUser).toHaveBeenCalledWith('kc-user-1');
    expect(state.provisionMainserverUserCredentials).not.toHaveBeenCalled();
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM user creation failed',
      expect.objectContaining({
        workspace_id: 'instance-1',
      })
    );
  });

  it('logs compensation failures when the created external user cannot be deactivated', async () => {
    state.persistCreatedUser.mockRejectedValue(new Error('db write failed'));
    state.resolveIdentityProviderForInstance.mockResolvedValue({
      provider: {
        deactivateUser: vi.fn(async () => {
          throw new Error('deactivate failed');
        }),
      },
      realm: 'tenant-realm',
      source: 'instance',
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin',
    });
    const identityProvider = {
      provider: {
        createUser: vi.fn(async () => ({ externalId: 'kc-user-1' })),
        syncRoles: vi.fn(async () => undefined),
      },
      realm: 'tenant-realm',
      source: 'instance' as const,
      clientId: 'tenant-admin',
      adminRealm: 'tenant-realm',
      executionMode: 'tenant_admin' as const,
    };

    const { executeCreateUser } = await import('./user-create-operation.js');

    await expect(
      executeCreateUser({
        actor: {
          instanceId: 'instance-1',
          actorAccountId: 'actor-1',
          requestId: 'req-1',
          traceId: 'trace-1',
        },
        actorSubject: 'kc-actor-1',
        identityProvider,
        payload: {
          email: 'alice@example.com',
          firstName: 'Alice',
          roleIds: [],
          sendPasswordSetupEmail: false,
        },
      })
    ).rejects.toThrow('db write failed');

    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM user create compensation failed',
      expect.objectContaining({
        workspace_id: 'instance-1',
      })
    );
  });
});
