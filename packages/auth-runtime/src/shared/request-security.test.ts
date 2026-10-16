import { describe, expect, it } from 'vitest';

import { isTrustedRequestOrigin, validateCsrf } from './request-security.js';

describe('shared request security', () => {
  it('accepts trusted origin and referer headers from the request origin or allow-list', () => {
    const requestWithOrigin = new Request('https://studio.example.test/api', {
      headers: { origin: 'https://admin.example.test' },
    });

    expect(isTrustedRequestOrigin(requestWithOrigin, 'https://admin.example.test')).toBe(true);

    const requestWithReferer = new Request('https://studio.example.test/api', {
      headers: { referer: 'https://portal.example.test/path?x=1' },
    });

    expect(isTrustedRequestOrigin(requestWithReferer, 'https://portal.example.test')).toBe(true);

    const sameOriginRequest = new Request('https://studio.example.test/api', {
      headers: { origin: 'https://studio.example.test' },
    });

    expect(isTrustedRequestOrigin(sameOriginRequest)).toBe(true);
  });

  it('rejects malformed or untrusted origins', () => {
    const malformedRequest = new Request('https://studio.example.test/api', {
      headers: { origin: 'not-a-valid-url' },
    });

    expect(isTrustedRequestOrigin(malformedRequest, 'https://admin.example.test')).toBe(false);

    const untrustedRequest = new Request('https://studio.example.test/api', {
      headers: { origin: 'https://evil.example.test' },
    });

    expect(isTrustedRequestOrigin(untrustedRequest, 'https://admin.example.test')).toBe(false);
  });

  it('returns csrf header errors before origin validation', async () => {
    const response = validateCsrf(
      new Request('https://studio.example.test/api', {
        headers: { origin: 'https://studio.example.test' },
      }),
      'request-1'
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: {
        code: 'csrf_validation_failed',
        message: expect.stringContaining('X-Requested-With'),
      },
      requestId: 'request-1',
    });
  });

  it('returns csrf origin errors for untrusted requests and null for trusted requests', async () => {
    process.env.IAM_CSRF_ALLOWED_ORIGINS = 'https://admin.example.test';

    const invalidOrigin = validateCsrf(
      new Request('https://studio.example.test/api', {
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'https://evil.example.test',
        },
      }),
      'request-2'
    );

    expect(invalidOrigin?.status).toBe(403);
    await expect(invalidOrigin?.json()).resolves.toMatchObject({
      error: {
        code: 'csrf_validation_failed',
        message: expect.stringContaining('Origin'),
      },
      requestId: 'request-2',
    });

    const trustedRequest = validateCsrf(
      new Request('https://studio.example.test/api', {
        headers: {
          'x-requested-with': 'xmlhttprequest',
          origin: 'https://admin.example.test',
        },
      }),
      'request-3'
    );

    expect(trustedRequest).toBeNull();
    delete process.env.IAM_CSRF_ALLOWED_ORIGINS;
  });

  it('accepts the TanStack server-function header only on an opted-in, trusted server-function request', () => {
    const request = (url: string, origin: string, header = 'true') =>
      new Request(url, {
        method: 'POST',
        headers: { origin, 'x-tsr-serverfn': header },
      });
    const trusted = request(
      'https://studio.example.test/_server/function-id',
      'https://studio.example.test'
    );

    expect(validateCsrf(trusted)).not.toBeNull();
    expect(validateCsrf(trusted, undefined, { allowServerFnHeader: true })).toBeNull();
    expect(
      validateCsrf(
        request('https://studio.example.test/_server/function-id', 'https://evil.example.test'),
        undefined,
        { allowServerFnHeader: true }
      )?.status
    ).toBe(403);
    expect(
      validateCsrf(
        request('https://studio.example.test/api/v1/interfaces', 'https://studio.example.test'),
        undefined,
        { allowServerFnHeader: true }
      )?.status
    ).toBe(403);
    expect(
      validateCsrf(
        request(
          'https://studio.example.test/_server/function-id',
          'https://studio.example.test',
          'false'
        ),
        undefined,
        { allowServerFnHeader: true }
      )?.status
    ).toBe(403);
  });
});
