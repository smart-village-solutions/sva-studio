import { beforeEach, describe, expect, it, vi } from 'vitest';

const { randomUuidMock, sanitizeRoleAuditDetailsMock } = vi.hoisted(() => ({
  randomUuidMock: vi.fn(() => 'event-1'),
  sanitizeRoleAuditDetailsMock: vi.fn((details) => details),
}));

vi.mock('node:crypto', () => ({
  randomUUID: randomUuidMock,
}));

vi.mock('./role-audit.js', () => ({
  sanitizeRoleAuditDetails: sanitizeRoleAuditDetailsMock,
}));

import {
  emitActivityLog,
  emitRoleAuditEvent,
  notifyPermissionInvalidation,
  setRoleSyncState,
} from './shared-activity.js';

describe('shared activity helpers', () => {
  beforeEach(() => {
    randomUuidMock.mockClear();
    sanitizeRoleAuditDetailsMock.mockClear();
  });

  it('writes activity logs with nullable optional identifiers and payload defaults', async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [] }));

    await emitActivityLog({ query } as never, {
      instanceId: 'tenant-a',
      eventType: 'organization.updated',
      result: 'success',
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO iam.activity_logs'), [
      'tenant-a',
      null,
      null,
      'organization.updated',
      'success',
      JSON.stringify({}),
      null,
      null,
    ]);
  });

  it('emits role audit events with sanitized details and optional role metadata', async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [] }));
    sanitizeRoleAuditDetailsMock.mockReturnValueOnce({
      safe: 'value',
      nested: { token: '[REDACTED]' },
    });

    await emitRoleAuditEvent({ query } as never, {
      instanceId: 'tenant-a',
      accountId: 'account-1',
      roleId: 'role-1',
      eventType: 'role.reconciled',
      operation: 'reconcile_update',
      result: 'failure',
      roleKey: 'news.editor',
      externalRoleName: 'news_editor',
      errorCode: 'IDP_TIMEOUT',
      details: {
        token: 'secret',
      },
      requestId: 'req-1',
      traceId: 'trace-1',
    });

    expect(sanitizeRoleAuditDetailsMock).toHaveBeenCalledWith({ token: 'secret' });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO iam.activity_logs'), [
      'tenant-a',
      'account-1',
      null,
      'role.reconciled',
      'failure',
      JSON.stringify({
        workspace_id: 'tenant-a',
        operation: 'reconcile_update',
        result: 'failure',
        role_id: 'role-1',
        role_key: 'news.editor',
        external_role_name: 'news_editor',
        error_code: 'IDP_TIMEOUT',
        request_id: 'req-1',
        trace_id: 'trace-1',
        safe: 'value',
        nested: { token: '[REDACTED]' },
      }),
      'req-1',
      'trace-1',
    ]);
  });

  it('updates role sync state and publishes invalidation payloads with optional subjects', async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [] }));

    await setRoleSyncState({ query } as never, {
      instanceId: 'tenant-a',
      roleId: 'role-1',
      syncState: 'synced',
      errorCode: null,
      syncedAt: true,
    });
    await notifyPermissionInvalidation({ query } as never, {
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-1',
      trigger: 'role_membership_changed',
    });
    await notifyPermissionInvalidation({ query } as never, {
      instanceId: 'tenant-a',
      trigger: 'role_membership_changed',
    });

    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('UPDATE iam.roles'), [
      'tenant-a',
      'role-1',
      'synced',
      null,
      true,
    ]);
    expect(query).toHaveBeenNthCalledWith(2, 'SELECT pg_notify($1, $2);', [
      'iam_permission_snapshot_invalidation',
      JSON.stringify({
        eventId: 'event-1',
        instanceId: 'tenant-a',
        keycloakSubject: 'kc-1',
        trigger: 'pg_notify',
        reason: 'role_membership_changed',
      }),
    ]);
    expect(query).toHaveBeenNthCalledWith(3, 'SELECT pg_notify($1, $2);', [
      'iam_permission_snapshot_invalidation',
      JSON.stringify({
        eventId: 'event-1',
        instanceId: 'tenant-a',
        trigger: 'pg_notify',
        reason: 'role_membership_changed',
      }),
    ]);
  });
});
