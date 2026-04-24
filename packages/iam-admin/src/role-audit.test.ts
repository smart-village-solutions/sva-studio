import { describe, expect, it } from 'vitest';

import {
  buildRoleSyncFailure,
  mapRoleSyncErrorCode,
  sanitizeRoleAuditDetails,
} from './role-audit.js';

class MockKeycloakAdminRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(input: { message: string; statusCode: number; code: string }) {
    super(input.message);
    this.statusCode = input.statusCode;
    this.code = input.code;
  }
}

describe('role-audit', () => {
  it('maps structural Keycloak request errors to stable role sync codes', () => {
    expect(
      mapRoleSyncErrorCode(
        new MockKeycloakAdminRequestError({
          message: 'timeout',
          statusCode: 504,
          code: 'read_timeout',
        })
      )
    ).toBe('IDP_TIMEOUT');

    expect(
      mapRoleSyncErrorCode(
        new MockKeycloakAdminRequestError({
          message: 'forbidden',
          statusCode: 403,
          code: 'forbidden',
        })
      )
    ).toBe('IDP_FORBIDDEN');
  });

  it('keeps the role sync failure response contract diagnostics', async () => {
    const response = buildRoleSyncFailure({
      error: new MockKeycloakAdminRequestError({
        message: 'timeout',
        statusCode: 504,
        code: 'read_timeout',
      }),
      requestId: 'req-role',
      fallbackMessage: 'Rollen konnten nicht synchronisiert werden.',
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'keycloak_unavailable',
        message: 'Rollen konnten nicht synchronisiert werden.',
        classification: 'keycloak_reconcile',
        recommendedAction: 'rollenabgleich_pruefen',
        status: 'manuelle_pruefung_erforderlich',
        safeDetails: {
          sync_error_code: 'IDP_TIMEOUT',
          sync_state: 'failed',
        },
        details: {
          syncState: 'failed',
          syncError: { code: 'IDP_TIMEOUT' },
        },
      },
      requestId: 'req-role',
    });
  });

  it('redacts nested role audit details', () => {
    expect(
      sanitizeRoleAuditDetails({
        actorEmail: 'user@example.org',
        nested: {
          client_secret: 'top-secret',
          token: 'Bearer abc.def.ghi',
        },
      })
    ).toEqual({
      actorEmail: 'u***@example.org',
      nested: {
        client_secret: '[REDACTED]',
        token: '[REDACTED]',
      },
    });
  });
});
