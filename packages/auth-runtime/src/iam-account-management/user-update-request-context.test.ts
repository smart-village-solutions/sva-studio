import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1' })),
  parseRequestBody: vi.fn(),
  resolveUserMutationActor: vi.fn(),
  requireUserId: vi.fn(),
  resolveUserMutationTargetActorContext: vi.fn(),
  requireUserMutationIdentityProvider: vi.fn(),
}));

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();
  return {
    ...actual,
    getWorkspaceContext: state.getWorkspaceContext,
  };
});

vi.mock('./api-helpers.js', () => ({
  createApiError: (status: number, code: string, message: string, requestId?: string) =>
    new Response(
      JSON.stringify({
        error: { code, message },
        ...(requestId ? { requestId } : {}),
      }),
      {
        status,
        headers: { 'content-type': 'application/json' },
      }
    ),
  parseRequestBody: state.parseRequestBody,
}));

vi.mock('./schemas.js', () => ({
  updateUserSchema: {},
}));

vi.mock('./user-mutation-request-context.shared.js', () => ({
  requireUserId: state.requireUserId,
  requireUserMutationIdentityProvider: state.requireUserMutationIdentityProvider,
  resolveUserMutationActor: state.resolveUserMutationActor,
  resolveUserMutationTargetActorContext: state.resolveUserMutationTargetActorContext,
}));

describe('resolveUpdateRequestContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveUserMutationActor.mockImplementation(() => {
      throw new Error('legacy actor resolver should not be used');
    });
    state.requireUserId.mockImplementation(() => {
      throw new Error('legacy userId resolver should not be used');
    });
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
        assignRealmRoles: vi.fn(async () => undefined),
        removeRealmRoles: vi.fn(async () => undefined),
        users: [],
      },
    });
  });

  it('builds the update context from the shared target helper', async () => {
    state.parseRequestBody.mockResolvedValue({
      ok: true,
      data: {
        displayName: 'Alice Example',
      },
    });

    const { resolveUpdateRequestContext } = await import('./user-update-request-context.js');

    const context = await resolveUpdateRequestContext(
      new Request('http://localhost/api/v1/iam/users/user-1', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: 'Alice Example' }),
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
      payload: {
        displayName: 'Alice Example',
      },
      resolveIdentityProvider: expect.any(Function),
      userId: 'user-1',
    });
    expect(state.resolveUserMutationTargetActorContext).toHaveBeenCalledOnce();
    expect(state.requireUserMutationIdentityProvider).not.toHaveBeenCalled();
    await expect(
      (context as Exclude<typeof context, Response>).resolveIdentityProvider()
    ).resolves.toEqual({
      provider: {
        assignRealmRoles: expect.any(Function),
        removeRealmRoles: expect.any(Function),
        users: [],
      },
    });
  });

  it('returns invalid_request before resolving the identity provider when the payload is invalid', async () => {
    state.parseRequestBody.mockResolvedValue({
      ok: false,
    });

    const { resolveUpdateRequestContext } = await import('./user-update-request-context.js');

    const response = await resolveUpdateRequestContext(
      new Request('http://localhost/api/v1/iam/users/user-1', {
        method: 'PATCH',
        body: '{}',
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

    expect(response).toBeInstanceOf(Response);
    expect(state.requireUserMutationIdentityProvider).not.toHaveBeenCalled();
    await expect((response as Response).json()).resolves.toEqual({
      error: { code: 'invalid_request', message: 'Ungültiger Payload.' },
      requestId: 'req-1',
    });
  });

  it('allows updates without early role-capability checks', async () => {
    state.parseRequestBody.mockResolvedValue({
      ok: true,
      data: {
        firstName: 'Alice',
      },
    });
    state.requireUserMutationIdentityProvider.mockResolvedValue({
      provider: {
        users: [],
      },
    });

    const { resolveUpdateRequestContext } = await import('./user-update-request-context.js');

    const context = await resolveUpdateRequestContext(
      new Request('http://localhost/api/v1/iam/users/user-1', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: 'Alice' }),
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
      payload: {
        firstName: 'Alice',
      },
      resolveIdentityProvider: expect.any(Function),
      userId: 'user-1',
    });
    expect(state.requireUserMutationIdentityProvider).not.toHaveBeenCalled();
  });
});
