import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  buildMainserverIdentityAttributes: vi.fn(({ existingAttributes, mainserverUserApplicationId, mainserverUserApplicationSecret }) => ({
    ...(existingAttributes ?? {}),
    ...(mainserverUserApplicationId !== undefined
      ? { mainserverUserApplicationId: [mainserverUserApplicationId] }
      : {}),
    ...(mainserverUserApplicationSecret !== undefined
      ? { mainserverUserApplicationSecret: [mainserverUserApplicationSecret] }
      : {}),
  })),
  trackKeycloakCall: vi.fn(async (_operation: string, work: () => Promise<unknown>) => work()),
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('../mainserver-credentials.js', () => ({
  buildMainserverIdentityAttributes: state.buildMainserverIdentityAttributes,
}));

vi.mock('./shared.js', () => ({
  logger: state.logger,
  resolveIdentityProvider: vi.fn(),
  trackKeycloakCall: state.trackKeycloakCall,
}));

const createCompensationPlan = (overrides: {
  readonly keycloakSubject?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly status?: 'active' | 'inactive';
  readonly previousRoleNames?: readonly string[];
  readonly nextRoleNames?: readonly string[];
} = {}) => ({
  existing: {
    keycloakSubject: overrides.keycloakSubject ?? 'kc-1',
    email: overrides.email ?? 'jane@example.test',
    firstName: overrides.firstName ?? 'Jane',
    lastName: overrides.lastName ?? 'Doe',
    status: overrides.status ?? 'active',
  },
  previousRoleNames: overrides.previousRoleNames ?? [],
  nextRoleNames: overrides.nextRoleNames ?? [],
});

const createIdentityProviderMocks = () => ({
  updateUser: vi.fn(async () => undefined),
  assignRealmRoles: vi.fn(async () => undefined),
  removeRealmRoles: vi.fn(async () => undefined),
  syncRoles: vi.fn(async () => undefined),
});

describe('user update identity helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds identity attributes and overlays displayName when provided', async () => {
    const { buildIdentityAttributesForUserUpdate } = await import('./user-update-identity.js');

    expect(
      buildIdentityAttributesForUserUpdate({
        existingAttributes: { locale: ['de'] },
        payload: {
          displayName: 'Jane Doe',
          mainserverUserApplicationId: 'app-1',
          mainserverUserApplicationSecret: 'secret-1',
        } as never,
      })
    ).toEqual({
      locale: ['de'],
      mainserverUserApplicationId: ['app-1'],
      mainserverUserApplicationSecret: ['secret-1'],
      displayName: ['Jane Doe'],
    });

    expect(
      buildIdentityAttributesForUserUpdate({
        existingAttributes: { locale: ['de'] },
        payload: {} as never,
      })
    ).toEqual({
      locale: ['de'],
    });
  });

  it('compensates identity and role updates and logs failures without throwing', async () => {
    const { compensateUserIdentityUpdate } = await import('./user-update-identity.js');
    const updateUser = vi
      .fn()
      .mockRejectedValueOnce(new Error('identity compensation failed'))
      .mockResolvedValueOnce(undefined);
    const assignRealmRoles = vi.fn().mockRejectedValueOnce('role compensation failed');
    const removeRealmRoles = vi.fn(async () => undefined);
    const identityProvider = {
      provider: {
        updateUser,
        assignRealmRoles,
        removeRealmRoles,
      },
    };
    const plan = createCompensationPlan({
      previousRoleNames: ['system_admin'],
      nextRoleNames: [],
    });

    await compensateUserIdentityUpdate({
      instanceId: 'instance-1',
      requestId: 'req-1',
      traceId: 'trace-1',
      userId: 'user-1',
      plan: plan as never,
      restoreIdentity: true,
      restoreRoles: true,
      restoreIdentityAttributes: { locale: ['de'] },
      identityProvider: identityProvider as never,
    });

    expect(state.trackKeycloakCall).toHaveBeenCalledTimes(2);
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM user update compensation failed',
      expect.objectContaining({
        workspace_id: 'instance-1',
      })
    );
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM user role compensation failed',
      expect.objectContaining({
        workspace_id: 'instance-1',
      })
    );

    await compensateUserIdentityUpdate({
      instanceId: 'instance-1',
      userId: 'user-1',
      plan: createCompensationPlan({ status: 'inactive', previousRoleNames: ['system_admin'] }) as never,
      restoreIdentity: true,
      restoreRoles: false,
      restoreIdentityAttributes: { locale: ['de'] },
      identityProvider: {
        provider: {
          updateUser,
          assignRealmRoles,
          removeRealmRoles,
        },
      } as never,
    });
    expect(updateUser).toHaveBeenLastCalledWith('kc-1', expect.objectContaining({ enabled: false }));
  });

  it('returns early when neither identity nor roles must be restored and logs string compensation errors', async () => {
    const { compensateUserIdentityUpdate } = await import('./user-update-identity.js');
    const { assignRealmRoles, removeRealmRoles, syncRoles, updateUser } = createIdentityProviderMocks();

    await compensateUserIdentityUpdate({
      instanceId: 'instance-1',
      userId: 'user-1',
      plan: createCompensationPlan({
        previousRoleNames: ['editor'],
        nextRoleNames: ['editor'],
      }) as never,
      restoreIdentity: false,
      restoreRoles: false,
      identityProvider: {
        provider: {
          updateUser,
          syncRoles,
        },
      } as never,
    });

    expect(state.trackKeycloakCall).not.toHaveBeenCalled();

    assignRealmRoles.mockRejectedValueOnce('sync failed');
    await compensateUserIdentityUpdate({
      instanceId: 'instance-1',
      requestId: 'req-2',
      traceId: 'trace-2',
      userId: 'user-2',
      plan: createCompensationPlan({
        keycloakSubject: 'kc-2',
        email: 'john@example.test',
        firstName: 'John',
        previousRoleNames: ['system_admin'],
        nextRoleNames: [],
      }) as never,
      restoreIdentity: false,
      restoreRoles: true,
      identityProvider: {
        provider: {
          updateUser,
          assignRealmRoles,
          removeRealmRoles,
          syncRoles,
        },
      } as never,
    });

    expect(syncRoles).not.toHaveBeenCalled();
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM user role compensation failed',
      expect.objectContaining({
        context: expect.objectContaining({
          error: 'sync failed',
          request_id: 'req-2',
          trace_id: 'trace-2',
        }),
      })
    );
  });

  it('compensates role updates with non-destructive technical deltas', async () => {
    const { compensateUserIdentityUpdate } = await import('./user-update-identity.js');
    const { assignRealmRoles, removeRealmRoles, syncRoles } = createIdentityProviderMocks();

    await compensateUserIdentityUpdate({
      instanceId: 'instance-1',
      userId: 'user-1',
      plan: createCompensationPlan({
        previousRoleNames: ['system_admin'],
        nextRoleNames: ['other_technical'],
      }) as never,
      restoreIdentity: false,
      restoreRoles: true,
      identityProvider: {
        provider: {
          assignRealmRoles,
          removeRealmRoles,
          syncRoles,
        },
      } as never,
    });

    expect(assignRealmRoles).toHaveBeenCalledWith('kc-1', ['system_admin']);
    expect(removeRealmRoles).toHaveBeenCalledWith('kc-1', ['other_technical']);
    expect(syncRoles).not.toHaveBeenCalled();
  });
});
