import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  completeIdempotency: vi.fn(async () => undefined),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1' })),
  parseRequestBody: vi.fn(),
  requireIdempotencyKey: vi.fn(),
  reserveIdempotency: vi.fn(),
  requireUserMutationIdentityProvider: vi.fn(),
  resolveUserMutationActor: vi.fn(),
  toPayloadHash: vi.fn(() => 'payload-hash'),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getWorkspaceContext: state.getWorkspaceContext,
}));

vi.mock('../db.js', () => ({
  jsonResponse: (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
}));

vi.mock('./api-helpers.js', () => ({
  createApiError: (status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ error: { code, message }, ...(requestId ? { requestId } : {}) }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  parseRequestBody: state.parseRequestBody,
  requireIdempotencyKey: state.requireIdempotencyKey,
  toPayloadHash: state.toPayloadHash,
}));

vi.mock('./shared-idempotency.js', () => ({
  completeIdempotency: state.completeIdempotency,
  reserveIdempotency: state.reserveIdempotency,
}));

vi.mock('./user-mutation-request-context.shared.js', () => ({
  requireUserMutationIdentityProvider: state.requireUserMutationIdentityProvider,
  resolveUserMutationActor: state.resolveUserMutationActor,
}));

describe('user-bulk-reprovision-mainserver-context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireIdempotencyKey.mockReturnValue({ key: 'idem-1' });
    state.parseRequestBody.mockResolvedValue({
      ok: true,
      data: { userIds: ['user-1'] },
      rawBody: '{"userIds":["user-1"]}',
    });
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.resolveUserMutationActor.mockResolvedValue({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
  });

  it('completes reserved idempotency entries when identity-provider preflight fails', async () => {
    state.requireUserMutationIdentityProvider.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'tenant_admin_client_not_configured',
            message: 'Tenant-lokale Keycloak-Administration ist nicht konfiguriert.',
          },
          requestId: 'req-1',
        }),
        {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const { resolveBulkReprovisionMainserverContext } = await import(
      './user-bulk-reprovision-mainserver-context.js'
    );

    const response = await resolveBulkReprovisionMainserverContext(
      new Request('http://localhost/api/v1/iam/users/bulk-reprovision-mainserver', {
        method: 'POST',
        body: '{"userIds":["user-1"]}',
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
    expect((response as Response).status).toBe(409);
    expect(state.completeIdempotency).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      actorAccountId: 'actor-1',
      endpoint: 'POST:/api/v1/iam/users/bulk-reprovision-mainserver',
      idempotencyKey: 'idem-1',
      status: 'FAILED',
      responseStatus: 409,
      responseBody: {
        error: {
          code: 'tenant_admin_client_not_configured',
          message: 'Tenant-lokale Keycloak-Administration ist nicht konfiguriert.',
        },
        requestId: 'req-1',
      },
    });
  });
});
