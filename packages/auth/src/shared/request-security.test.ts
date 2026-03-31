import { describe, expect, it } from 'vitest';

import { isTrustedRequestOrigin, validateCsrf } from './request-security.js';

describe('shared/request-security', () => {
  it('accepts matching origin headers', () => {
    const request = new Request('https://studio.example.test/api', {
      headers: {
        origin: 'https://studio.example.test',
        'x-requested-with': 'XMLHttpRequest',
      },
    });

    expect(isTrustedRequestOrigin(request)).toBe(true);
    expect(validateCsrf(request)).toBeNull();
  });

  it('rejects foreign origins', async () => {
    const request = new Request('https://studio.example.test/api', {
      headers: {
        origin: 'https://evil.example.test',
        'x-requested-with': 'XMLHttpRequest',
      },
    });

    const response = validateCsrf(request);
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: 'csrf_validation_failed' },
    });
  });

  it('accepts allowed referer origins from configuration', () => {
    const request = new Request('https://studio.example.test/api', {
      headers: {
        referer: 'https://admin.example.test/users',
        'x-requested-with': 'XMLHttpRequest',
      },
    });

    expect(isTrustedRequestOrigin(request, 'https://admin.example.test')).toBe(true);
  });
});
