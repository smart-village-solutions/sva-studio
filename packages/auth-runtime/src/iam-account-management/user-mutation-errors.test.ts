import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createApiError: vi.fn((status: number, code: string, message: string, requestId?: string) =>
    new Response(
      JSON.stringify({
        error: { code, message },
        ...(requestId ? { requestId } : {}),
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  ),
}));

vi.mock('./api-helpers.js', () => ({
  createApiError: state.createApiError,
}));

describe('user mutation error helpers', () => {
  it('maps known mutation error codes to user-facing API responses', async () => {
    const { createUserMutationErrorResponse } = await import('./user-mutation-errors.js');

    const notFound = createUserMutationErrorResponse({
      error: new Error('not_found:missing'),
      requestId: 'req-1',
      forbiddenFallbackMessage: 'Verboten',
    });
    const selfProtection = createUserMutationErrorResponse({
      error: new Error('self_protection:nope'),
      requestId: 'req-2',
      forbiddenFallbackMessage: 'Verboten',
    });
    const lastAdmin = createUserMutationErrorResponse({
      error: new Error('last_admin_protection:nope'),
      requestId: 'req-3',
      forbiddenFallbackMessage: 'Verboten',
    });

    expect(notFound?.status).toBe(404);
    await expect(notFound?.json()).resolves.toEqual({
      error: { code: 'not_found', message: 'Nutzer nicht gefunden.' },
      requestId: 'req-1',
    });
    expect(selfProtection?.status).toBe(409);
    expect(lastAdmin?.status).toBe(409);
  });

  it('uses detail or fallback messages for forbidden/invalid/pii errors and returns null for unknown errors', async () => {
    const {
      createUnexpectedMutationErrorResponse,
      createUserMutationErrorResponse,
    } = await import('./user-mutation-errors.js');

    const forbidden = createUserMutationErrorResponse({
      error: new Error('forbidden:Eigene Berechtigung fehlt'),
      requestId: 'req-4',
      forbiddenFallbackMessage: 'Fallback verboten',
    });
    const forbiddenFallback = createUserMutationErrorResponse({
      error: new Error('forbidden'),
      requestId: 'req-5',
      forbiddenFallbackMessage: 'Fallback verboten',
    });
    const invalid = createUserMutationErrorResponse({
      error: new Error('invalid_request'),
      requestId: 'req-6',
      forbiddenFallbackMessage: 'unused',
    });
    const pii = createUserMutationErrorResponse({
      error: new Error('pii_encryption_required:missing'),
      requestId: 'req-7',
      forbiddenFallbackMessage: 'unused',
    });

    await expect(forbidden?.json()).resolves.toEqual({
      error: { code: 'forbidden', message: 'Eigene Berechtigung fehlt' },
      requestId: 'req-4',
    });
    await expect(forbiddenFallback?.json()).resolves.toEqual({
      error: { code: 'forbidden', message: 'Fallback verboten' },
      requestId: 'req-5',
    });
    await expect(invalid?.json()).resolves.toEqual({
      error: { code: 'invalid_request', message: 'Ungültiger Payload.' },
      requestId: 'req-6',
    });
    await expect(pii?.json()).resolves.toEqual({
      error: { code: 'internal_error', message: 'PII-Verschlüsselung ist nicht konfiguriert.' },
      requestId: 'req-7',
    });
    expect(
      createUserMutationErrorResponse({
        error: new Error('boom'),
        requestId: 'req-8',
        forbiddenFallbackMessage: 'unused',
      })
    ).toBeNull();

    const unexpected = createUnexpectedMutationErrorResponse({
      requestId: 'req-9',
      message: 'Unerwartet',
      code: 'conflict',
      status: 409,
    });
    expect(unexpected.status).toBe(409);
    await expect(unexpected.json()).resolves.toEqual({
      error: { code: 'conflict', message: 'Unerwartet' },
      requestId: 'req-9',
    });
  });
});
