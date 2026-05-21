import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  ensureFeature: vi.fn(),
  getFeatureFlags: vi.fn(() => ({ iam_admin: true, iam_bulk: true })),
  requireRoles: vi.fn(),
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
    expect(state.requireRoles).not.toHaveBeenCalled();

    const roleError = new Response('role', { status: 403 });
    state.requireRoles.mockReturnValueOnce(roleError);
    await expect(
      resolveMutationActorWithAccount(request, ctx, { allowedRoles, feature: 'iam_admin', scope: 'write' })
    ).resolves.toEqual({ response: roleError });

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
