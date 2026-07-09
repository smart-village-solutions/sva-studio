import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  let executeBulkReprovisionMainserver:
    | ((input: {
        actor: {
          instanceId: string;
          actorAccountId: string;
          requestId?: string;
          traceId?: string;
        };
        ctx: {
          activeOrganizationId?: string;
          user: {
            id: string;
            roles: string[];
          };
        };
        userIds: readonly string[];
        identityProvider: {
          provider: unknown;
        };
      }) => Promise<unknown>)
    | null = null;

  return {
    emitActivityLog: vi.fn(async () => undefined),
    ensureActorCanManageTarget: vi.fn(() => ({ ok: true })),
    getExecuteBulkReprovisionMainserver: () => executeBulkReprovisionMainserver,
    provisionMainserverUserCredentials: vi.fn(),
    resolveActorMaxRoleLevel: vi.fn(async () => 100),
    resolveUserDetail: vi.fn(),
    setExecuteBulkReprovisionMainserver: (fn: typeof executeBulkReprovisionMainserver) => {
      executeBulkReprovisionMainserver = fn;
    },
    trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) => execute()),
    withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (client: object) => Promise<unknown>) => work({})),
  };
});

vi.mock('@sva/iam-admin', () => ({
  createBulkReprovisionMainserverHandlerInternal:
    (deps: { executeBulkReprovisionMainserver: typeof state.getExecuteBulkReprovisionMainserver extends () => infer T ? T : never }) => {
      state.setExecuteBulkReprovisionMainserver(deps.executeBulkReprovisionMainserver);
      return vi.fn();
    },
}));

vi.mock('./user-bulk-reprovision-mainserver-context.js', () => ({
  completeBulkReprovisionMainserverFailure: vi.fn(),
  completeBulkReprovisionMainserverSuccess: vi.fn(),
  resolveBulkReprovisionMainserverContext: vi.fn(),
}));

vi.mock('./mainserver-user-provisioning.js', () => ({
  provisionMainserverUserCredentials: state.provisionMainserverUserCredentials,
}));

vi.mock('./shared-actor-authorization.js', () => ({
  ensureActorCanManageTarget: state.ensureActorCanManageTarget,
  resolveActorMaxRoleLevel: state.resolveActorMaxRoleLevel,
}));

vi.mock('./shared-activity.js', () => ({
  emitActivityLog: state.emitActivityLog,
}));

vi.mock('./shared-observability.js', () => ({
  iamUserOperationsCounter: { add: vi.fn() },
  trackKeycloakCall: state.trackKeycloakCall,
}));

vi.mock('./shared-runtime.js', () => ({
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

vi.mock('./user-detail-query.js', () => ({
  resolveUserDetail: state.resolveUserDetail,
}));

describe('user-bulk-reprovision-mainserver-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveUserDetail.mockResolvedValue({
      id: 'user-1',
      keycloakSubject: 'kc-user-1',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Example',
      roles: [],
    });
    state.provisionMainserverUserCredentials.mockResolvedValue({
      mainserverUserApplicationId: 'app-1',
      mainserverUserApplicationSecret: 'secret-1',
    });
  });

  it('passes the active organization to mainserver reprovisioning for bulk actions', async () => {
    await import('./user-bulk-reprovision-mainserver-handler.js');
    const executeBulkReprovisionMainserver = state.getExecuteBulkReprovisionMainserver();
    if (!executeBulkReprovisionMainserver) {
      throw new Error('executeBulkReprovisionMainserver not captured');
    }

    await executeBulkReprovisionMainserver({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      ctx: {
        activeOrganizationId: 'org-1',
        user: {
          id: 'kc-actor-1',
          roles: ['system_admin'],
        },
      },
      userIds: ['user-1'],
      identityProvider: {
        provider: {
          getUserAttributes: vi.fn(async () => ({ locale: ['de'] })),
          updateUser: vi.fn(async () => undefined),
        },
      },
    });

    expect(state.provisionMainserverUserCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({
          activeOrganizationId: 'org-1',
        }),
      })
    );
  });
});
