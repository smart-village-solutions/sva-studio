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
  });

  it('sends an UPDATE_PASSWORD invitation after successful creation when requested', async () => {
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
        sendPasswordSetupEmail: true,
      },
    });

    expect(identityProvider.provider.executeActionsEmail).toHaveBeenCalledWith('kc-user-1', {
      actions: ['UPDATE_PASSWORD'],
      clientId: 'sva-studio',
      redirectUri: 'https://tenant.example.test/auth/callback',
    });
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
});
