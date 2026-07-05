import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  ensureFeature: vi.fn(),
  getFeatureFlags: vi.fn(() => ({ iam_admin: true, iam_bulk: true })),
  requireRoles: vi.fn(),
  authorizeInstancePermissionForUser: vi.fn(),
  toInstancePermissionApiErrorCode: vi.fn((error: string) => {
    switch (error) {
      case 'missing_instance':
        return 'invalid_instance_id';
      case 'database_unavailable':
        return 'database_unavailable';
      default:
        return 'forbidden';
    }
  }),
  resolveActorInfo: vi.fn(),
  validateCsrf: vi.fn(),
  consumeRateLimit: vi.fn(),
  resolveIdentityProviderForInstance: vi.fn(),
}));

vi.mock('./feature-flags.js', () => ({
  ensureFeature: state.ensureFeature,
  getFeatureFlags: state.getFeatureFlags,
}));

vi.mock('./shared-actor-resolution.js', () => ({
  requireRoles: state.requireRoles,
  resolveActorInfo: state.resolveActorInfo,
}));

vi.mock('../instance-permission-authorization.js', () => ({
  authorizeInstancePermissionForUser: state.authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode: state.toInstancePermissionApiErrorCode,
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: state.validateCsrf,
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: state.consumeRateLimit,
}));

vi.mock('./shared-runtime.js', () => ({
  resolveIdentityProviderForInstance: state.resolveIdentityProviderForInstance,
}));

describe('mutation-request-context.shared', () => {
  let resolveMutationActorWithAccount: typeof import('./mutation-request-context.shared.js').resolveMutationActorWithAccount;
  let requireMutationIdentityProvider: typeof import('./mutation-request-context.shared.js').requireMutationIdentityProvider;
  let requireMutationPathId: typeof import('./mutation-request-context.shared.js').requireMutationPathId;

  beforeAll(async () => {
    ({
      resolveMutationActorWithAccount,
      requireMutationIdentityProvider,
      requireMutationPathId,
    } = await import('./mutation-request-context.shared.js'));
  }, 30_000);

  beforeEach(() => {
    vi.clearAllMocks();
    state.ensureFeature.mockReturnValue(null);
    state.requireRoles.mockReturnValue(null);
    state.authorizeInstancePermissionForUser.mockResolvedValue({
      ok: true,
      actor: {
        instanceId: 'instance-1',
        keycloakSubject: 'kc-user-1',
      },
      permissions: [],
    });
    state.resolveActorInfo.mockResolvedValue({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
    state.validateCsrf.mockReturnValue(null);
    state.consumeRateLimit.mockReturnValue(null);
    state.resolveIdentityProviderForInstance.mockResolvedValue({
      provider: { users: [] },
    });
  });

  it('short-circuits on feature, role, actor, csrf, and rate-limit failures before succeeding', async () => {
    const request = new Request('http://localhost/api/v1/iam/users/123e4567-e89b-12d3-a456-426614174000', {
      method: 'PATCH',
    });
    const ctx = {
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['system_admin'],
      },
    } as never;
    const allowedRoles = new Set(['system_admin']);

    const featureError = new Response('feature', { status: 403 });
    state.ensureFeature.mockReturnValueOnce(featureError);
    await expect(
      resolveMutationActorWithAccount(request, ctx, { allowedRoles, feature: 'iam_admin', scope: 'write' })
    ).resolves.toEqual({ response: featureError });
    expect(state.authorizeInstancePermissionForUser).not.toHaveBeenCalled();

    state.authorizeInstancePermissionForUser.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für diese Instanzoperation.',
    });
    await expect(
      resolveMutationActorWithAccount(request, ctx, {
        allowedRoles,
        requiredPermissionAction: 'iam.user.write',
        feature: 'iam_admin',
        scope: 'write',
      })
    ).resolves.toMatchObject({ response: expect.any(Response) });

    const actorError = new Response('actor', { status: 401 });
    state.resolveActorInfo.mockResolvedValueOnce({ error: actorError });
    await expect(
      resolveMutationActorWithAccount(request, ctx, { allowedRoles, feature: 'iam_admin', scope: 'write' })
    ).resolves.toEqual({ response: actorError });

    state.resolveActorInfo.mockResolvedValueOnce({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: '',
        requestId: 'req-missing-account',
      },
    });
    const missingAccount = await resolveMutationActorWithAccount(request, ctx, {
      allowedRoles,
      feature: 'iam_admin',
      scope: 'write',
    });
    expect('response' in missingAccount && missingAccount.response.status).toBe(403);

    const csrfError = new Response('csrf', { status: 403 });
    state.validateCsrf.mockReturnValueOnce(csrfError);
    await expect(
      resolveMutationActorWithAccount(request, ctx, { allowedRoles, feature: 'iam_admin', scope: 'write' })
    ).resolves.toEqual({ response: csrfError });

    const rateLimitError = new Response('rate', { status: 429 });
    state.consumeRateLimit.mockReturnValueOnce(rateLimitError);
    await expect(
      resolveMutationActorWithAccount(request, ctx, { allowedRoles, feature: 'iam_admin', scope: 'write' })
    ).resolves.toEqual({ response: rateLimitError });

    await expect(
      resolveMutationActorWithAccount(request, ctx, {
        allowedRoles,
        feature: 'iam_admin',
        scope: 'bulk',
        provisionMissingActorMembership: true,
      })
    ).resolves.toEqual({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
    expect(state.resolveActorInfo).toHaveBeenLastCalledWith(request, ctx, {
      requireActorMembership: true,
      provisionMissingActorMembership: true,
    });
    expect(state.consumeRateLimit).toHaveBeenLastCalledWith({
      actorKeycloakSubject: 'kc-user-1',
      instanceId: 'instance-1',
      requestId: 'req-1',
      scope: 'bulk',
    });
  });

  it('allows custom permission grants without legacy tenant admin roles', async () => {
    const request = new Request('http://localhost/api/v1/iam/users/123e4567-e89b-12d3-a456-426614174000', {
      method: 'PATCH',
    });
    const ctx = {
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['custom_role'],
      },
    } as never;

    await expect(
      resolveMutationActorWithAccount(request, ctx, {
        allowedRoles: new Set(['system_admin']),
        requiredPermissionAction: 'iam.user.write',
        feature: 'iam_admin',
        scope: 'write',
      })
    ).resolves.toEqual({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
    expect(state.authorizeInstancePermissionForUser).toHaveBeenCalledWith({
      ctx,
      action: 'iam.user.write',
      instanceId: 'instance-1',
    });
    expect(state.requireRoles).not.toHaveBeenCalled();
  });

  it('rejects root-only platform admins for instance-scoped tenant mutations without an instance context', async () => {
    const request = new Request('http://localhost/api/v1/iam/users/123e4567-e89b-12d3-a456-426614174000', {
      method: 'PATCH',
    });
    const ctx = {
      user: {
        id: 'kc-root-admin',
        roles: ['instance_registry_admin'],
      },
    } as never;
    const missingInstance = new Response(
      JSON.stringify({
        error: {
          code: 'invalid_instance_id',
        },
      }),
      {
        status: 400,
        headers: {
          'content-type': 'application/json',
        },
      }
    );
    state.resolveActorInfo.mockResolvedValueOnce({ error: missingInstance });

    const result = await resolveMutationActorWithAccount(request, ctx, {
      allowedRoles: new Set(['system_admin']),
      requiredPermissionAction: 'iam.user.write',
      feature: 'iam_admin',
      scope: 'write',
    });

    expect(state.resolveActorInfo).toHaveBeenCalledWith(request, ctx, {
      requireActorMembership: true,
      provisionMissingActorMembership: undefined,
    });
    expect(state.authorizeInstancePermissionForUser).not.toHaveBeenCalled();
    expect(result).toEqual({ response: missingInstance });
    await expect((result as { response: Response }).response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_instance_id',
      },
    });
  });

  it('authorizes explicit mutation permissions against the resolved request tenant', async () => {
    const request = new Request(
      'http://localhost/api/v1/iam/users/123e4567-e89b-12d3-a456-426614174000?instanceId=instance-2',
      {
        method: 'DELETE',
      }
    );
    const ctx = {
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['custom_role'],
      },
    } as never;
    state.resolveActorInfo.mockResolvedValueOnce({
      actor: {
        instanceId: 'instance-2',
        actorAccountId: 'actor-2',
        requestId: 'req-2',
        traceId: 'trace-2',
      },
    });

    await expect(
      resolveMutationActorWithAccount(request, ctx, {
        allowedRoles: new Set(['system_admin']),
        requiredPermissionAction: 'iam.accounts.delete',
        feature: 'iam_admin',
        scope: 'write',
      })
    ).resolves.toEqual({
      actor: {
        instanceId: 'instance-2',
        actorAccountId: 'actor-2',
        requestId: 'req-2',
        traceId: 'trace-2',
      },
    });

    expect(state.authorizeInstancePermissionForUser).toHaveBeenCalledWith({
      ctx,
      action: 'iam.accounts.delete',
      instanceId: 'instance-2',
    });
  });

  it('validates mutation path ids and resolves tenant-admin identity providers', async () => {
    const validRequest = new Request('http://localhost/api/v1/iam/users/123e4567-e89b-12d3-a456-426614174000');
    expect(requireMutationPathId(validRequest, { paramName: 'userId' })).toBe('123e4567-e89b-12d3-a456-426614174000');

    const invalidResponse = requireMutationPathId(new Request('http://localhost/api/v1/iam/users/not-a-uuid'), {
      paramName: 'userId',
      requestId: 'req-invalid',
    });
    expect(invalidResponse).toBeInstanceOf(Response);
    expect((invalidResponse as Response).status).toBe(400);

    await expect(requireMutationIdentityProvider('instance-1', 'req-1')).resolves.toEqual({
      provider: { users: [] },
    });

    state.resolveIdentityProviderForInstance.mockResolvedValueOnce(null);
    const missingIdentityProvider = await requireMutationIdentityProvider('instance-1', 'req-2', {
      syncError: { code: 'IDP_UNAVAILABLE' },
      syncState: 'failed',
    });
    expect(missingIdentityProvider).toBeInstanceOf(Response);
    expect((missingIdentityProvider as Response).status).toBe(409);
    await expect((missingIdentityProvider as Response).json()).resolves.toMatchObject({
      error: {
        code: 'tenant_admin_client_not_configured',
        details: {
          dependency: 'keycloak',
          execution_mode: 'tenant_admin',
          instance_id: 'instance-1',
          reason_code: 'tenant_admin_client_not_configured',
          syncError: { code: 'IDP_UNAVAILABLE' },
          syncState: 'failed',
        },
      },
      requestId: 'req-2',
    });
  });
});
