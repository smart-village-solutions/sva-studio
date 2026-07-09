import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resolveBulkContext: vi.fn(),
  executeBulkReprovision: vi.fn(),
  completeSuccess: vi.fn(),
}));

describe('createBulkReprovisionMainserverHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns partial successes and failures without aborting the full request', async () => {
    state.resolveBulkContext.mockResolvedValue({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
      },
      identityProvider: {
        provider: {},
      },
      payload: {
        userIds: ['user-1', 'user-2'],
      },
      idempotencyKey: 'idem-1',
    });
    state.executeBulkReprovision.mockResolvedValue({
      successes: [{ id: 'user-1' }],
      failures: [{ id: 'user-2', code: 'conflict', message: 'Für den Nutzer ist keine E-Mail-Adresse hinterlegt.' }],
    });
    state.completeSuccess.mockImplementation(async ({ actor, result }) =>
      new Response(
        JSON.stringify({
          data: {
            ...result,
            successCount: result.successes.length,
            failureCount: result.failures.length,
          },
          requestId: actor.requestId,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const { createBulkReprovisionMainserverHandlerInternal } = await import('./user-bulk-reprovision-mainserver-handler.js');
    const handler = createBulkReprovisionMainserverHandlerInternal({
      resolveBulkReprovisionMainserverContext: state.resolveBulkContext,
      executeBulkReprovisionMainserver: state.executeBulkReprovision,
      completeBulkReprovisionMainserverSuccess: state.completeSuccess,
    });

    const response = await handler(new Request('http://localhost/api/v1/iam/users/bulk-reprovision-mainserver', { method: 'POST' }), {
      sessionId: 'session-1',
      user: {
        id: 'kc-admin-1',
        instanceId: 'instance-1',
        roles: ['system_admin'],
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        successes: [{ id: 'user-1' }],
        failures: [{ id: 'user-2', code: 'conflict', message: 'Für den Nutzer ist keine E-Mail-Adresse hinterlegt.' }],
        successCount: 1,
        failureCount: 1,
      },
      requestId: 'req-1',
    });
  });
});
