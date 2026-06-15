import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
  },
  withRequestContext: vi.fn(),
  withAuthenticatedUser: vi.fn(),
  toJsonErrorResponse: vi.fn(),
  buildLogContext: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
  toJsonErrorResponse: state.toJsonErrorResponse,
  withRequestContext: state.withRequestContext,
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: state.buildLogContext,
}));

describe('withAuthenticatedIamHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.withRequestContext.mockImplementation(async (_input, work) => await work());
    state.withAuthenticatedUser.mockImplementation(async (_request, work) =>
      await work({ sessionId: 'session-1', user: { id: 'user-1', instanceId: 'tenant-a', roles: ['system_admin'] } })
    );
    state.buildLogContext.mockReturnValue({
      request_id: 'req-iam',
      trace_id: 'trace-iam',
    });
    state.toJsonErrorResponse.mockImplementation(
      (status: number, code: string, message: string, details?: unknown) =>
        new Response(JSON.stringify({ error: { code, message }, ...(details ? { details } : {}) }), {
          status,
          headers: { 'content-type': 'application/json' },
        })
    );
  });

  it('runs authenticated IAM handlers inside the request context wrapper', async () => {
    const { withAuthenticatedIamHandler } = await import('./core-shared.js');
    const request = new Request('https://example.test/api/v1/iam/users');
    const response = new Response('ok');
    const handler = vi.fn(async () => response);

    await expect(withAuthenticatedIamHandler(request, handler)).resolves.toBe(response);

    expect(state.withRequestContext).toHaveBeenCalledWith(
      {
        request,
        fallbackWorkspaceId: 'default',
      },
      expect.any(Function)
    );
    expect(state.withAuthenticatedUser).toHaveBeenCalledWith(request, expect.any(Function));
    expect(handler).toHaveBeenCalledWith(request, expect.objectContaining({ sessionId: 'session-1' }));
  });

  it('logs unexpected errors and returns a stable internal_error response', async () => {
    const { withAuthenticatedIamHandler } = await import('./core-shared.js');
    const request = new Request('https://example.test/api/v1/iam/users');
    state.withAuthenticatedUser.mockRejectedValueOnce(new Error('boom'));

    const response = await withAuthenticatedIamHandler(request, vi.fn());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'internal_error',
        message: 'Unbehandelter IAM-Fehler.',
      },
      details: {
        requestId: 'req-iam',
      },
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM request failed unexpectedly',
      expect.objectContaining({
        endpoint: 'https://example.test/api/v1/iam/users',
        error_type: 'Error',
        error_message: 'boom',
        request_id: 'req-iam',
        trace_id: 'trace-iam',
      })
    );
    expect(state.toJsonErrorResponse).toHaveBeenCalledWith(
      500,
      'internal_error',
      'Unbehandelter IAM-Fehler.',
      { requestId: 'req-iam' }
    );
  });
});
