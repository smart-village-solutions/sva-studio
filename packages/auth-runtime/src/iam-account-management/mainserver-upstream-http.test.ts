import { describe, expect, it, vi } from 'vitest';

import { MainserverUserProvisioningError } from './mainserver-user-provisioning-error.js';
import {
  createProvisioningErrorFromResponse,
  fetchMainserverUpstream,
  parseMainserverJsonBody,
  readMainserverErrorPayload,
} from './mainserver-upstream-http.js';

describe('mainserver-upstream-http', () => {
  it('maps abort-like upstream failures to retryable timeout errors', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.name = 'TimeoutError';
    const fetchImpl = vi.fn().mockRejectedValueOnce(timeoutError);

    await expect(
      fetchMainserverUpstream({
        fetchImpl,
        url: 'https://example.com/token',
        init: { method: 'POST' },
        signal: AbortSignal.timeout(100),
        timeoutMessage: 'Zeitüberschreitung beim Laden des Mainserver-Provisioning-Tokens.',
      })
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'upstream_timeout',
      message: 'Zeitüberschreitung beim Laden des Mainserver-Provisioning-Tokens.',
      retryable: true,
      statusCode: 504,
    });
  });

  it('rethrows non-abort upstream failures unchanged', async () => {
    const upstreamError = new Error('boom');
    const fetchImpl = vi.fn().mockRejectedValueOnce(upstreamError);

    await expect(
      fetchMainserverUpstream({
        fetchImpl,
        url: 'https://example.com/token',
        init: { method: 'POST' },
        signal: AbortSignal.timeout(100),
        timeoutMessage: 'Zeitüberschreitung beim Laden des Mainserver-Provisioning-Tokens.',
      })
    ).rejects.toBe(upstreamError);
  });

  it('throws invalid_response when a json body cannot be parsed', async () => {
    const response = new Response('not-json', { status: 200 });

    await expect(
      parseMainserverJsonBody(response, 'Ungültige Antwort des SVA-Mainserver-Provisionings.')
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'invalid_response',
      message: 'Ungültige Antwort des SVA-Mainserver-Provisionings.',
      statusCode: 502,
    });
  });

  it('returns a sanitized error payload when the upstream body is malformed', async () => {
    const nonJsonResponse = new Response('not-json', { status: 409 });
    const scalarJsonResponse = new Response(JSON.stringify('conflict'), { status: 409 });

    await expect(
      readMainserverErrorPayload(nonJsonResponse, 'Ungültige Antwort des SVA-Mainserver-Provisionings.')
    ).resolves.toEqual({});
    await expect(
      readMainserverErrorPayload(scalarJsonResponse, 'Ungültige Antwort des SVA-Mainserver-Provisionings.')
    ).resolves.toEqual({});
  });

  it('keeps only typed error payload fields', async () => {
    const response = new Response(
      JSON.stringify({
        code: 'local_user_conflict',
        message: ['wrong'],
        retryable: 'false',
      }),
      { status: 409 }
    );

    await expect(
      readMainserverErrorPayload(response, 'Ungültige Antwort des SVA-Mainserver-Provisionings.')
    ).resolves.toEqual({
      code: 'local_user_conflict',
      message: undefined,
      retryable: undefined,
    });
  });

  it('maps provisioning error responses from payload fields with fallback defaults', async () => {
    const explicitPayloadResponse = new Response(
      JSON.stringify({
        code: 'local_user_conflict',
        message: 'conflict',
        retryable: false,
      }),
      { status: 409 }
    );
    const fallbackResponse = new Response('not-json', { status: 503 });

    await expect(createProvisioningErrorFromResponse(explicitPayloadResponse)).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'local_user_conflict',
      message: 'conflict',
      retryable: false,
      statusCode: 409,
    });
    await expect(createProvisioningErrorFromResponse(fallbackResponse)).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'mainserver_user_provisioning_failed',
      message: 'Mainserver-Benutzer-Provisioning fehlgeschlagen (503).',
      retryable: true,
      statusCode: 503,
    });
  });

  it('creates concrete MainserverUserProvisioningError instances', async () => {
    const response = new Response(JSON.stringify({ code: 'conflict', message: 'conflict' }), { status: 409 });

    await expect(createProvisioningErrorFromResponse(response)).rejects.toBeInstanceOf(
      MainserverUserProvisioningError
    );
  });
});
