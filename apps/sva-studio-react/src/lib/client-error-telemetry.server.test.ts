import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: { id: 'account-telemetry-test', instanceId: 'instance-telemetry-test' },
  requestId: 'telemetry-request',
  csrfResponse: null as Response | null,
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@sva/auth-runtime/server', () => ({
  validateCsrf: () => state.csrfResponse,
  withAuthenticatedUser: async (_request: Request, handler: (ctx: unknown) => unknown) =>
    handler({ user: state.user }),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: () => ({ requestId: state.requestId }),
}));

import { dispatchClientErrorTelemetryRequest } from './client-error-telemetry.server.js';

const eventId = '8d4ebdc9-75f4-4e5c-b3b5-cbd65d8155f6';
const request = (body: string, headers: HeadersInit = {}) =>
  new Request('https://studio.test/api/v1/monitoring/client-errors', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });

describe('client error telemetry', () => {
  beforeEach(() => {
    state.user = { id: `account-${crypto.randomUUID()}`, instanceId: 'instance-telemetry-test' };
    state.requestId = 'telemetry-request';
    state.csrfResponse = null;
    vi.clearAllMocks();
  });

  it('accepts one bounded safe event and atomically deduplicates it per account and instance', async () => {
    const payload = JSON.stringify({ clientEventId: eventId, errorCode: 'client_unhandled_error' });
    const first = await dispatchClientErrorTelemetryRequest(request(payload));
    const duplicate = await dispatchClientErrorTelemetryRequest(request(payload));

    await expect(first?.json()).resolves.toEqual({ accepted: true, deduplicated: false });
    await expect(duplicate?.json()).resolves.toEqual({ accepted: true, deduplicated: true });
    expect(state.logger.warn).toHaveBeenCalledTimes(1);
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Studio browser reported an uncorrelated client error',
      expect.objectContaining({
        event: 'studio.client.error.reported',
        request_id: 'telemetry-request',
        client_event_id: eventId,
        error_code: 'client_unhandled_error',
      })
    );
  });

  it('requires CSRF, rejects unknown fields, and enforces the byte limit', async () => {
    state.csrfResponse = new Response(null, { status: 403 });
    expect((await dispatchClientErrorTelemetryRequest(request('{}')))?.status).toBe(403);
    state.csrfResponse = null;

    expect(
      (
        await dispatchClientErrorTelemetryRequest(
          request(
            JSON.stringify({
              clientEventId: eventId,
              errorCode: 'client_unhandled_error',
              message: 'PII',
            })
          )
        )
      )?.status
    ).toBe(400);
    expect((await dispatchClientErrorTelemetryRequest(request(' '.repeat(2_049))))?.status).toBe(
      413
    );
    expect(state.logger.warn).not.toHaveBeenCalled();
  });

  it('limits accepted attempts to twenty per authenticated account per minute', async () => {
    let last: Response | null = null;
    for (let index = 0; index < 21; index += 1) {
      const clientEventId = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
      last = (await dispatchClientErrorTelemetryRequest(
        request(JSON.stringify({ clientEventId, errorCode: 'client_unhandled_rejection' }))
      )) as Response;
    }
    expect(last?.status).toBe(429);
    expect(state.logger.warn).toHaveBeenCalledTimes(20);
  });
});
