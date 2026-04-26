import { beforeEach, describe, expect, it, vi } from 'vitest';

const { completeIdempotencyMock } = vi.hoisted(() => ({
  completeIdempotencyMock: vi.fn(),
}));

vi.mock('../iam-account-management/shared.js', () => ({
  completeIdempotency: completeIdempotencyMock,
  reserveIdempotency: vi.fn(),
}));

const { createFailureResponseFromResponse } = await import('./mutation-helpers.js');

const actor = {
  instanceId: 'instance-1',
  keycloakSubject: 'subject-1',
  actorAccountId: 'account-1',
  actorDisplayName: 'Actor',
  requestId: 'request-1',
};

describe('content mutation helpers', () => {
  beforeEach(() => {
    completeIdempotencyMock.mockReset();
  });

  it('preserves authorization failure status and response body for idempotent create failures', async () => {
    const authorizationResponse = new Response(
      JSON.stringify({
        error: { code: 'database_unavailable', message: 'Berechtigungen konnten nicht geprüft werden.' },
        requestId: 'request-1',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );

    const response = await createFailureResponseFromResponse(actor, 'idem-1', authorizationResponse);

    await expect(response.json()).resolves.toEqual({
      error: { code: 'database_unavailable', message: 'Berechtigungen konnten nicht geprüft werden.' },
      requestId: 'request-1',
    });
    expect(response.status).toBe(503);
    expect(completeIdempotencyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        responseStatus: 503,
        status: 'FAILED',
        responseBody: {
          error: { code: 'database_unavailable', message: 'Berechtigungen konnten nicht geprüft werden.' },
          requestId: 'request-1',
        },
      })
    );
  });
});
