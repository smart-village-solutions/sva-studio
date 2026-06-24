import { describe, expect, it, vi } from 'vitest';

import { buildDeletedRolePayloadFromRole, failLocalRoleDeleteDatabaseWrite } from './role-delete-support.js';

describe('role-delete-support', () => {
  it('builds the deleted role payload from the canonical role metadata', () => {
    expect(
      buildDeletedRolePayloadFromRole('role-1', {
        role_key: 'editor',
        role_name: 'editor',
        display_name: 'Editor',
        external_role_name: 'editor',
        description: 'Can edit content',
        is_system_role: false,
        managed_by: 'studio',
        role_level: 25,
      })
    ).toEqual({
      id: 'role-1',
      roleKey: 'editor',
      roleName: 'Editor',
      externalRoleName: 'editor',
      syncState: 'synced',
    });
  });

  it('logs deterministic db write failures for local role deletion', async () => {
    const logger = { error: vi.fn() };
    const createApiError = vi.fn((status, code, message, requestId, details) =>
      new Response(JSON.stringify({ error: { code, message, details }, requestId }), { status })
    );

    const response = failLocalRoleDeleteDatabaseWrite(
      {
        logger,
        sanitizeRoleErrorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
        createApiError,
      } as never,
      {
        actor: {
          instanceId: 'de-musterhausen',
          requestId: 'req-delete-role',
          traceId: 'trace-delete-role',
        },
        roleId: 'role-1',
        existing: {
          role_key: 'editor',
          role_name: 'editor',
          display_name: 'Editor',
          external_role_name: 'editor',
          description: 'Can edit content',
          is_system_role: false,
          managed_by: 'studio',
          role_level: 25,
        },
        externalRoleName: 'editor',
        error: new Error('db write failed'),
      }
    );

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      'Role delete database write failed',
      expect.objectContaining({
        role_id: 'role-1',
        role_key: 'editor',
        error_code: 'DB_WRITE_FAILED',
        error: 'db write failed',
      })
    );
  });
});
