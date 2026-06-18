import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  asApiItem: vi.fn(),
  completeIdempotency: vi.fn(),
  createApiError: vi.fn(),
  createUserMutationErrorResponse: vi.fn(),
  executeCreateUser: vi.fn(),
  iamUserOperationsCounterAdd: vi.fn(),
  jsonResponse: vi.fn(),
  parseRequestBody: vi.fn(),
  requireIdempotencyKey: vi.fn(),
  reserveIdempotency: vi.fn(),
  resolveIdentityProviderForInstance: vi.fn(),
  resolveMutationActorWithAccount: vi.fn(),
  toPayloadHash: vi.fn(),
}));

vi.mock('../db.js', () => ({
  jsonResponse: state.jsonResponse,
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: state.asApiItem,
  createApiError: state.createApiError,
  parseRequestBody: state.parseRequestBody,
  requireIdempotencyKey: state.requireIdempotencyKey,
  toPayloadHash: state.toPayloadHash,
}));

vi.mock('./shared.js', () => ({
  completeIdempotency: state.completeIdempotency,
  iamUserOperationsCounter: {
    add: state.iamUserOperationsCounterAdd,
  },
  reserveIdempotency: state.reserveIdempotency,
  resolveIdentityProviderForInstance: state.resolveIdentityProviderForInstance,
}));

vi.mock('./user-create-operation.js', () => ({
  executeCreateUser: state.executeCreateUser,
}));

vi.mock('./user-mutation-errors.js', () => ({
  createUserMutationErrorResponse: state.createUserMutationErrorResponse,
}));

vi.mock('./mutation-request-context.shared.js', () => ({
  resolveMutationActorWithAccount: state.resolveMutationActorWithAccount,
}));

describe('user-create-handler request context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.asApiItem.mockImplementation((data, requestId) => ({ data, requestId }));
    state.completeIdempotency.mockResolvedValue(undefined);
    state.createApiError.mockImplementation((status, code, message, requestId) =>
      new Response(JSON.stringify({ error: { code, message }, ...(requestId ? { requestId } : {}) }), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    );
    state.createUserMutationErrorResponse.mockReturnValue(null);
    state.executeCreateUser.mockResolvedValue({
      user: { id: 'user-1' },
      invitation: { status: 'sent' },
    });
    state.jsonResponse.mockImplementation((status, payload) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    );
    state.parseRequestBody.mockResolvedValue({
      ok: true,
      data: {
        email: 'alice@example.com',
        roleIds: ['role-1'],
      },
      rawBody: '{"email":"alice@example.com","roleIds":["role-1"]}',
    });
    state.requireIdempotencyKey.mockReturnValue({ key: 'idem-1' });
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.resolveIdentityProviderForInstance.mockResolvedValue({ provider: {} });
    state.resolveMutationActorWithAccount.mockResolvedValue({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
    state.toPayloadHash.mockReturnValue('payload-hash');
  });

  it('allows custom permission grants without legacy tenant admin roles', async () => {
    const { createUserInternal } = await import('./user-create-handler.js');
    const request = new Request('http://localhost/api/v1/iam/users', {
      method: 'POST',
      body: '{"email":"alice@example.com","roleIds":["role-1"]}',
    });
    const ctx = {
      activeOrganizationId: 'org-1',
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['custom_role'],
      },
    } as never;

    const response = await createUserInternal(request, ctx);

    expect(response.status).toBe(201);
    expect(state.resolveMutationActorWithAccount).toHaveBeenCalledWith(request, ctx, {
      allowedRoles: new Set(['system_admin']),
      requiredPermissionAction: 'iam.user.write',
      feature: 'iam_admin',
      scope: 'write',
      provisionMissingActorMembership: true,
    });
    expect(state.executeCreateUser).toHaveBeenCalledWith({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        activeOrganizationId: 'org-1',
        actorRoles: ['custom_role'],
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      actorSubject: 'kc-user-1',
      identityProvider: { provider: {} },
      payload: {
        email: 'alice@example.com',
        groupIds: [],
        roleIds: ['role-1'],
      },
    });
  }, 15_000);

  it('returns shared guard responses unchanged', async () => {
    const { createUserInternal } = await import('./user-create-handler.js');
    const request = new Request('http://localhost/api/v1/iam/users', { method: 'POST' });
    const ctx = {
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['custom_role'],
      },
    } as never;
    const forbidden = new Response('forbidden', { status: 403 });
    state.resolveMutationActorWithAccount.mockResolvedValueOnce({ response: forbidden });

    await expect(createUserInternal(request, ctx)).resolves.toBe(forbidden);
    expect(state.requireIdempotencyKey).not.toHaveBeenCalled();
  });
});
