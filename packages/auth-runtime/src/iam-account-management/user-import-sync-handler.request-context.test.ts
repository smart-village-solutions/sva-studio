import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resolveMutationActorWithAccount: vi.fn(),
}));

vi.mock('./mutation-request-context.shared.js', () => ({
  resolveMutationActorWithAccount: state.resolveMutationActorWithAccount,
}));

describe('user-import-sync-handler request context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveMutationActorWithAccount.mockResolvedValue({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
  });

  it('allows custom permission grants without legacy tenant admin roles', async () => {
    const { resolveSyncActor } = await import('./user-import-sync-handler.js');
    const request = new Request('http://localhost/api/v1/iam/users/sync-keycloak', { method: 'POST' });
    const ctx = {
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['custom_role'],
      },
    } as never;

    await expect(resolveSyncActor(request, ctx)).resolves.toEqual({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
    expect(state.resolveMutationActorWithAccount).toHaveBeenCalledWith(request, ctx, {
      allowedRoles: new Set(['system_admin']),
      requiredPermissionAction: 'iam.user.write',
      feature: 'iam_admin',
      scope: 'write',
      provisionMissingActorMembership: true,
    });
  }, 15_000);

  it('returns shared guard responses unchanged', async () => {
    const { resolveSyncActor } = await import('./user-import-sync-handler.js');
    const request = new Request('http://localhost/api/v1/iam/users/sync-keycloak', { method: 'POST' });
    const ctx = {
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['custom_role'],
      },
    } as never;
    const forbidden = new Response('forbidden', { status: 403 });
    state.resolveMutationActorWithAccount.mockResolvedValueOnce({ response: forbidden });

    await expect(resolveSyncActor(request, ctx)).resolves.toEqual({ error: forbidden });
  });
});
