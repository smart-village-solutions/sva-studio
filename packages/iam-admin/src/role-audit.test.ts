import { describe, expect, it } from 'vitest';

import {
  buildRoleSyncFailure,
  mapRoleListItem,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
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

    expect(
      mapRoleSyncErrorCode(
        new MockKeycloakAdminRequestError({
          message: 'missing',
          statusCode: 404,
          code: 'not_found',
        })
      )
    ).toBe('IDP_NOT_FOUND');

    expect(
      mapRoleSyncErrorCode(
        new MockKeycloakAdminRequestError({
          message: 'conflict',
          statusCode: 409,
          code: 'conflict',
        })
      )
    ).toBe('IDP_CONFLICT');

    expect(
      mapRoleSyncErrorCode(
        new MockKeycloakAdminRequestError({
          message: 'busy',
          statusCode: 429,
          code: 'rate_limited',
        })
      )
    ).toBe('IDP_UNAVAILABLE');
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

  it('maps conflict and unknown role sync failures to stable API responses', async () => {
    const conflictResponse = buildRoleSyncFailure({
      error: new MockKeycloakAdminRequestError({
        message: 'duplicate',
        statusCode: 409,
        code: 'conflict',
      }),
      fallbackMessage: 'Konflikt beim Rollenabgleich.',
      requestId: 'req-conflict',
    });
    const unknownResponse = buildRoleSyncFailure({
      error: new Error('boom'),
      fallbackMessage: 'Unbekannter Rollenfehler.',
      requestId: 'req-unknown',
    });

    expect(conflictResponse.status).toBe(409);
    await expect(conflictResponse.json()).resolves.toMatchObject({
      error: {
        code: 'conflict',
        details: { syncError: { code: 'IDP_CONFLICT' } },
      },
      requestId: 'req-conflict',
    });
    expect(unknownResponse.status).toBe(500);
    await expect(unknownResponse.json()).resolves.toMatchObject({
      error: {
        code: 'internal_error',
        details: { syncError: { code: 'IDP_UNKNOWN' } },
      },
      requestId: 'req-unknown',
    });
  });

  it('projects role list items with diagnostics, editability and managed permission fallbacks', () => {
    expect(
      mapRoleListItem({
        id: 'role-system',
        role_key: 'system_admin',
        role_name: 'system_admin',
        display_name: null,
        external_role_name: 'system_admin',
        managed_by: 'studio',
        description: null,
        is_system_role: true,
        role_level: 100,
        member_count: 1,
        sync_state: 'ready',
        last_synced_at: null,
        last_error_code: null,
        permission_rows: null,
      })
    ).toMatchObject({
      roleName: 'system_admin',
      externalRoleName: 'system_admin',
      editability: 'read_only',
      diagnostics: [{ code: 'system_role' }],
      permissions: [],
    });

    expect(
      mapRoleListItem({
        id: 'role-builtin',
        role_key: 'builtin.role',
        role_name: 'builtin.role',
        display_name: 'Builtin',
        external_role_name: 'kc-builtin',
        managed_by: 'keycloak_builtin',
        description: 'Managed',
        is_system_role: false,
        role_level: 10,
        member_count: 2,
        sync_state: 'failed',
        last_synced_at: '2026-01-01T00:00:00.000Z',
        last_error_code: 'IDP_FORBIDDEN',
        permission_rows: [
          {
            id: 'perm-1',
            permission_key: 'waste-management.read',
            description: null,
          },
        ],
      })
    ).toMatchObject({
      roleName: 'Builtin',
      externalRoleName: 'kc-builtin',
      editability: 'read_only',
      diagnostics: [{ code: 'built_in_role' }],
      syncError: { code: 'IDP_FORBIDDEN' },
      permissions: [{ permissionKey: 'waste-management.read', description: expect.any(String), runtimeScope: 'instance' }],
    });

    expect(
      mapRoleListItem({
        id: 'role-external',
        role_key: 'external.role',
        role_name: 'external.role',
        display_name: 'External',
        external_role_name: 'external-name',
        managed_by: 'external',
        description: null,
        is_system_role: false,
        role_level: 5,
        member_count: 0,
        sync_state: 'ready',
        last_synced_at: null,
        last_error_code: null,
        permission_rows: [],
      })
    ).toMatchObject({
      editability: 'read_only',
      diagnostics: [{ code: 'external_managed' }],
    });

    expect(
      mapRoleListItem({
        id: 'role-app-manager',
        role_key: 'app_manager',
        role_name: 'app_manager',
        display_name: 'App Manager',
        external_role_name: 'app_manager',
        managed_by: 'studio',
        description: 'Legacy bootstrap role',
        is_system_role: true,
        role_level: 80,
        member_count: 2,
        sync_state: 'ready',
        last_synced_at: null,
        last_error_code: null,
        permission_rows: [],
      })
    ).toMatchObject({
      roleName: 'App Manager',
      isSystemRole: false,
      editability: 'editable',
      diagnostics: undefined,
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

  it('sanitizes error messages from strings and Error instances', () => {
    expect(sanitizeRoleErrorMessage(new Error('authorization=Bearer abc.def session=secret'))).toContain('[REDACTED]');
    expect(sanitizeRoleErrorMessage('token=abc client_secret=def')).toBe('token=[REDACTED] client_secret=[REDACTED]');
  });
});
