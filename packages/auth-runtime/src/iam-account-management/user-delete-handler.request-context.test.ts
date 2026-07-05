import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1' })),
  resolveUserMutationTargetActorContext: vi.fn(),
}));

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();
  return {
    ...actual,
    getWorkspaceContext: state.getWorkspaceContext,
  };
});

vi.mock('./user-mutation-request-context.shared.js', () => ({
  requireUserMutationIdentityProvider: vi.fn(),
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
});
