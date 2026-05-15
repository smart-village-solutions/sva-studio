import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  executeCreateUser: vi.fn(),
  createUserMutationErrorResponse: vi.fn(),
}));

vi.mock('./user-create-operation.js', () => ({
  executeCreateUser: state.executeCreateUser,
}));

vi.mock('./user-mutation-errors.js', () => ({
  createUserMutationErrorResponse: state.createUserMutationErrorResponse,
}));

describe('executeCreateUserWithKnownErrors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clones readonly role and group ids before delegating to the create operation', async () => {
    state.executeCreateUser.mockResolvedValue({
      user: { id: 'user-1' },
      invitation: { status: 'sent' },
    });
    state.createUserMutationErrorResponse.mockReturnValue(null);

    const { executeCreateUserWithKnownErrors } = await import('./user-create-handler.js');
    const payload = {
      email: 'alice@example.com',
      roleIds: ['role-1'] as const,
      groupIds: ['group-1'] as const,
    };

    await expect(
      executeCreateUserWithKnownErrors({
        actor: {
          instanceId: 'inst-1',
          actorAccountId: 'actor-1',
          actorRoles: ['system_admin'],
          requestId: 'req-1',
        },
        actorSubject: 'subject-1',
        identityProvider: {} as never,
        payload,
      })
    ).resolves.toEqual({
      user: { id: 'user-1' },
      invitation: { status: 'sent' },
    });

    expect(state.executeCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          email: 'alice@example.com',
          roleIds: ['role-1'],
          groupIds: ['group-1'],
        },
      })
    );
    const delegatedPayload = state.executeCreateUser.mock.calls[0]?.[0].payload;
    expect(delegatedPayload.roleIds).not.toBe(payload.roleIds);
    expect(delegatedPayload.groupIds).not.toBe(payload.groupIds);
  });

  it('maps known mutation errors to thrown responses and defaults missing groups to an empty array', async () => {
    const knownResponse = new Response(
      JSON.stringify({
        error: {
          code: 'invalid_request',
          message: 'Mindestens eine aktive Gruppe existiert nicht.',
        },
      }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
    state.executeCreateUser.mockRejectedValue(new Error('invalid_request:Mindestens eine aktive Gruppe existiert nicht.'));
    state.createUserMutationErrorResponse.mockReturnValue(knownResponse);

    const { executeCreateUserWithKnownErrors } = await import('./user-create-handler.js');

    await expect(
      executeCreateUserWithKnownErrors({
        actor: {
          instanceId: 'inst-1',
          actorAccountId: 'actor-1',
          actorRoles: ['system_admin'],
          requestId: 'req-1',
        },
        actorSubject: 'subject-1',
        identityProvider: {} as never,
        payload: {
          email: 'alice@example.com',
          roleIds: [],
        },
      })
    ).rejects.toBe(knownResponse);

    expect(state.executeCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          email: 'alice@example.com',
          roleIds: [],
          groupIds: [],
        },
      })
    );
    expect(state.createUserMutationErrorResponse).toHaveBeenCalledWith({
      error: expect.any(Error),
      requestId: 'req-1',
      forbiddenFallbackMessage: 'Nutzer enthält unzulässige Rollen- oder Gruppenzuweisungen.',
    });
  });

  it('rethrows unknown create operation errors unchanged', async () => {
    const failure = new Error('boom');
    state.executeCreateUser.mockRejectedValue(failure);
    state.createUserMutationErrorResponse.mockReturnValue(null);

    const { executeCreateUserWithKnownErrors } = await import('./user-create-handler.js');

    await expect(
      executeCreateUserWithKnownErrors({
        actor: {
          instanceId: 'inst-1',
          actorAccountId: 'actor-1',
          actorRoles: ['system_admin'],
        },
        actorSubject: 'subject-1',
        identityProvider: {} as never,
        payload: {
          email: 'alice@example.com',
          roleIds: [],
          groupIds: [],
        },
      })
    ).rejects.toThrow('boom');
  });
});
