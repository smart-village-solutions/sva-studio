import { describe, expect, it, vi } from 'vitest';
import { createStudioApiClient, StudioApiError, StudioApiRedirectError, UpstreamSchemaError } from './api-client.js';

describe('Studio API client', () => {
  it('sets bearer, correlation and idempotency headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'demo' } }), { status: 200 }));
    const tokens = { getToken: vi.fn().mockResolvedValue('access-token') };
    const client = createStudioApiClient(
      { baseUrl: 'https://studio.example/', readTimeoutMs: 1_000, mutationTimeoutMs: 2_000 }, tokens, fetchImpl
    );
    await client.request({ method: 'POST', path: '/api/v1/iam/instances', body: {}, requestId: 'req-1', idempotencyKey: 'idem-1', confirmationChallengeId: 'challenge-1', confirmationPhrase: 'ARCHIVE demo' });
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({
      authorization: 'Bearer access-token', 'x-request-id': 'req-1', 'idempotency-key': 'idem-1',
      'x-confirmation-challenge-id': 'challenge-1', 'x-confirmation-phrase': 'ARCHIVE demo',
    });
  });

  it('refreshes exactly once after a 401 response', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"data":true}', { status: 200 }));
    const tokens = { getToken: vi.fn().mockResolvedValue('token') };
    const client = createStudioApiClient({ baseUrl: 'https://studio.example', readTimeoutMs: 1_000, mutationTimeoutMs: 2_000 }, tokens, fetchImpl);
    await client.request({ path: '/api/v1/iam/instances' });
    expect(tokens.getToken.mock.calls.map((call) => call[0])).toEqual([false, true]);
  });

  it('redacts structured error payloads', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'denied', clientSecret: 'leak' }), { status: 403 }));
    const client = createStudioApiClient(
      { baseUrl: 'https://studio.example', readTimeoutMs: 1_000, mutationTimeoutMs: 2_000 },
      { getToken: vi.fn().mockResolvedValue('token') }, fetchImpl
    );
    const error = await client.request({ path: '/failure' }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StudioApiError);
    expect((error as StudioApiError).payload).toEqual({ code: 'denied', clientSecret: '[REDACTED]' });
  });

  it('redacts successful payloads and uses separate read and mutation budgets', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetchImpl = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ data: { accessToken: 'leak' } }), { status: 200 }));
    const client = createStudioApiClient(
      { baseUrl: 'https://studio.example', readTimeoutMs: 111, mutationTimeoutMs: 222 },
      { getToken: vi.fn().mockResolvedValue('token') }, fetchImpl
    );
    await expect(client.request({ path: '/read' })).resolves.toEqual({ data: { accessToken: '[REDACTED]' } });
    await client.request({ method: 'POST', path: '/write', body: {} });
    expect(timeout).toHaveBeenCalledWith(111);
    expect(timeout).toHaveBeenCalledWith(222);
    timeout.mockRestore();
  });

  it('rejects malformed successful JSON as an upstream schema error', async () => {
    const client = createStudioApiClient(
      { baseUrl: 'https://studio.example', readTimeoutMs: 1_000, mutationTimeoutMs: 2_000 },
      { getToken: vi.fn().mockResolvedValue('token') },
      vi.fn().mockResolvedValue(new Response('{not-json', { status: 200 }))
    );
    await expect(client.request({ path: '/read' })).rejects.toBeInstanceOf(UpstreamSchemaError);
  });

  it('can reject redirects without following them for personal-context calls', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://other.example/collect' },
    }));
    const client = createStudioApiClient(
      { baseUrl: 'https://studio.example', readTimeoutMs: 1_000, mutationTimeoutMs: 2_000 },
      { getToken: vi.fn().mockResolvedValue('personal-token') },
      fetchImpl,
      { retryUnauthorized: false, rejectRedirects: true }
    );
    await expect(client.request({ method: 'POST', path: 'api/v1/iam/users', body: {} })).rejects.toBeInstanceOf(StudioApiRedirectError);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  it('does not retry personal writes after an unauthorized response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"error":{"code":"unauthorized"}}', { status: 401 }));
    const tokens = { getToken: vi.fn().mockResolvedValue('personal-token') };
    const client = createStudioApiClient(
      { baseUrl: 'https://studio.example', readTimeoutMs: 1_000, mutationTimeoutMs: 2_000 },
      tokens,
      fetchImpl,
      { retryUnauthorized: false, rejectRedirects: true }
    );
    await expect(client.request({ method: 'POST', path: 'api/v1/iam/users', body: {} })).rejects.toBeInstanceOf(StudioApiError);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(tokens.getToken).toHaveBeenCalledOnce();
  });
});
