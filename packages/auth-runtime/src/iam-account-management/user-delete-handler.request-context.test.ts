import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createDeleteUserHandlerInternal: vi.fn(),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1' })),
  requireUserMutationIdentityProvider: vi.fn(),
  resolveUserMutationTargetActorContext: vi.fn(),
}));

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();
  return {
    ...actual,
    getWorkspaceContext: state.getWorkspaceContext,
  };
});

vi.mock('@sva/iam-admin', () => ({
  createDeleteUserHandlerInternal: state.createDeleteUserHandlerInternal,
  hardDeleteAccount: vi.fn(),
  purgeAccountHardDeleteBlockers: vi.fn(),
  reconcileOwnedContentForAccountDelete: vi.fn(),
}));

vi.mock('./user-mutation-request-context.shared.js', () => ({
  requireUserMutationIdentityProvider: state.requireUserMutationIdentityProvider,
  resolveUserMutationTargetActorContext: state.resolveUserMutationTargetActorContext,
}));

describe('resolveDeleteRequestContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveUserMutationTargetActorContext.mockResolvedValue({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      userId: 'user-1',
    });
    state.requireUserMutationIdentityProvider.mockResolvedValue({
      provider: {
        deleteUser: vi.fn(async () => undefined),
      },
    });
    state.createDeleteUserHandlerInternal.mockReturnValue(vi.fn(async () => new Response(null, { status: 204 })));
  });

  it('builds the delete context from the shared target helper without eager identity-provider resolution', async () => {
    const { resolveDeleteRequestContext } = await import('./user-delete-handler.js');

    const context = await resolveDeleteRequestContext(
      new Request('http://localhost/api/v1/iam/users/user-1', {
        method: 'DELETE',
      }),
      {
        sessionId: 'session-1',
        user: {
          id: 'kc-actor-1',
          instanceId: 'instance-1',
          roles: ['system_admin'],
        },
      }
    );

    expect(context).toEqual({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      userId: 'user-1',
    });
    expect(state.resolveUserMutationTargetActorContext).toHaveBeenCalledWith(expect.any(Request), expect.anything(), {
      feature: 'iam_admin',
      scope: 'write',
      requiredPermissionAction: 'iam.accounts.delete',
      requestId: 'req-1',
    });
  });

  it('returns shared guard responses unchanged', async () => {
    const { resolveDeleteRequestContext } = await import('./user-delete-handler.js');
    const forbidden = new Response('forbidden', { status: 403 });
    state.resolveUserMutationTargetActorContext.mockResolvedValueOnce(forbidden);

    await expect(
      resolveDeleteRequestContext(new Request('http://localhost/api/v1/iam/users/user-1', { method: 'DELETE' }), {
        sessionId: 'session-1',
        user: {
          id: 'kc-actor-1',
          instanceId: 'instance-1',
          roles: ['custom_role'],
        },
      })
    ).resolves.toBe(forbidden);
  });

  it('returns the identity-provider response before local delete work starts', async () => {
    const { deleteUserInternal } = await import('./user-delete-handler.js');
    const idpUnavailable = new Response('idp-unavailable', { status: 409 });
    state.requireUserMutationIdentityProvider.mockResolvedValueOnce(idpUnavailable);

    await expect(
      deleteUserInternal(new Request('http://localhost/api/v1/iam/users/user-1', { method: 'DELETE' }), {
        sessionId: 'session-1',
        user: {
          id: 'kc-actor-1',
          instanceId: 'instance-1',
          roles: ['system_admin'],
        },
      })
    ).resolves.toBe(idpUnavailable);

    expect(state.createDeleteUserHandlerInternal).not.toHaveBeenCalled();
  });
});
