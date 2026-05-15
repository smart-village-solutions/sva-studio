import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  persistCreatedUser: vi.fn(),
  ensureManagedRealmRolesExist: vi.fn(),
  resolveIdentityProviderForInstance: vi.fn(),
  resolveAuthConfigForInstance: vi.fn(),
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
    expect(result.invitation.status).toBe('failed');
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM user invitation email failed',
      expect.objectContaining({
        workspace_id: 'instance-1',
      })
    );
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
