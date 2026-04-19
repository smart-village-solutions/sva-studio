import { describe, expect, it } from 'vitest';

import { createUserMutationErrorResponse } from './user-mutation-errors.js';

const readErrorResponse = async (response: Response) => ({
  status: response.status,
  body: await response.json(),
});

describe('iam-account-management/user-mutation-errors', () => {
  it('maps forbidden mutation errors with detail text', async () => {
    const response = createUserMutationErrorResponse({
      error: new Error('forbidden:Target user cannot be modified.'),
      requestId: 'req-1',
      forbiddenFallbackMessage: 'unused',
    });

    expect(response).not.toBeNull();
    await expect(readErrorResponse(response!)).resolves.toEqual({
      status: 403,
      body: {
        error: expect.objectContaining({
          code: 'forbidden',
          message: 'Target user cannot be modified.',
          classification: 'unknown',
          recommendedAction: 'erneut_versuchen',
          status: 'manuelle_pruefung_erforderlich',
        }),
        requestId: 'req-1',
      },
    });
  });

  it('maps self protection errors to conflict responses', async () => {
    const response = createUserMutationErrorResponse({
      error: new Error('self_protection:blocked'),
      requestId: 'req-2',
      forbiddenFallbackMessage: 'unused',
    });

    expect(response).not.toBeNull();
    await expect(readErrorResponse(response!)).resolves.toEqual({
      status: 409,
      body: {
        error: expect.objectContaining({
          code: 'self_protection',
          message: 'Eigener Nutzer kann nicht deaktiviert werden.',
          classification: 'unknown',
          recommendedAction: 'erneut_versuchen',
          status: 'degradiert',
        }),
        requestId: 'req-2',
      },
    });
  });

  it('returns null for unknown errors', () => {
    expect(
      createUserMutationErrorResponse({
        error: new Error('unexpected'),
        requestId: 'req-3',
        forbiddenFallbackMessage: 'unused',
      })
    ).toBeNull();
  });
});
