import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  requireMutationIdentityProvider: vi.fn(),
  requireMutationPathId: vi.fn(),
  resolveMutationActorWithAccount: vi.fn(),
}));

vi.mock('./mutation-request-context.shared.js', () => ({
  requireMutationIdentityProvider: state.requireMutationIdentityProvider,
  requireMutationPathId: state.requireMutationPathId,
  resolveMutationActorWithAccount: state.resolveMutationActorWithAccount,
}));

describe('user-mutation-request-context.shared', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveMutationActorWithAccount.mockResolvedValue({
      actor: {
        actorAccountId: 'actor-1',
        instanceId: 'instance-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
    state.requireMutationPathId.mockReturnValue('user-1');
    state.requireMutationIdentityProvider.mockResolvedValue({
      provider: { users: [] },
    });
  });

  it('delegates actor resolution and user id extraction through the shared mutation helpers', async () => {
    const {
      requireUserId,
      resolveUserMutationActor,
      resolveUserMutationTargetActorContext,
    } = await import('./user-mutation-request-context.shared.js');
    const request = new Request('http://localhost/api/v1/iam/users/user-1', { method: 'PATCH' });
    const ctx = {
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['system_admin'],
      },
    } as never;

    await expect(
      resolveUserMutationActor(request, ctx, {
        feature: 'iam_admin',
        scope: 'write',
      })
    ).resolves.toEqual({
      actor: {
        actorAccountId: 'actor-1',
        instanceId: 'instance-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
    expect(state.resolveMutationActorWithAccount).toHaveBeenCalledWith(request, ctx, {
      allowedRoles: new Set(['system_admin', 'app_manager']),
      feature: 'iam_admin',
      provisionMissingActorMembership: true,
      requiredPermissionAction: 'iam.user.write',
      scope: 'write',
    });

    expect(requireUserId(request, 'req-1')).toBe('user-1');
    expect(state.requireMutationPathId).toHaveBeenCalledWith(request, {
      paramName: 'userId',
      requestId: 'req-1',
    });

    await expect(
      resolveUserMutationTargetActorContext(request, ctx, {
        feature: 'iam_bulk',
        provisionMissingActorMembership: false,
        scope: 'bulk',
      })
    ).resolves.toEqual({
      actor: {
        actorAccountId: 'actor-1',
        instanceId: 'instance-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      userId: 'user-1',
    });
  });

  it('returns shared responses for actor, user-id, and identity-provider failures', async () => {
    const {
      requireUserMutationIdentityProvider,
      resolveUserMutationTargetActorContext,
      resolveUserMutationTargetContext,
    } = await import('./user-mutation-request-context.shared.js');
    const request = new Request('http://localhost/api/v1/iam/users/user-1', { method: 'PATCH' });
    const ctx = {
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['system_admin'],
      },
    } as never;

    const actorResponse = new Response('actor', { status: 403 });
    state.resolveMutationActorWithAccount.mockResolvedValueOnce({ response: actorResponse });
    await expect(
      resolveUserMutationTargetActorContext(request, ctx, {
        feature: 'iam_admin',
        scope: 'write',
      })
    ).resolves.toBe(actorResponse);

    const userIdResponse = new Response('user-id', { status: 400 });
    state.requireMutationPathId.mockReturnValueOnce(userIdResponse);
    await expect(
      resolveUserMutationTargetActorContext(request, ctx, {
        feature: 'iam_admin',
        scope: 'write',
      })
    ).resolves.toBe(userIdResponse);

    await expect(requireUserMutationIdentityProvider('instance-1', 'req-1')).resolves.toEqual({
      provider: { users: [] },
    });

    const identityProviderResponse = new Response('idp', { status: 409 });
    state.requireMutationIdentityProvider.mockResolvedValueOnce(identityProviderResponse);
    await expect(
      resolveUserMutationTargetContext(request, ctx, {
        feature: 'iam_admin',
        scope: 'write',
      })
    ).resolves.toBe(identityProviderResponse);

    await expect(
      resolveUserMutationTargetContext(request, ctx, {
        feature: 'iam_admin',
        scope: 'write',
      })
    ).resolves.toEqual({
      actor: {
        actorAccountId: 'actor-1',
        instanceId: 'instance-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      identityProvider: {
        provider: { users: [] },
      },
      userId: 'user-1',
    });
  });
});
