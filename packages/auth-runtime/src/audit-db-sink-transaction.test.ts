import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
}));

vi.mock('pg', () => ({
  Pool: class {
    async connect() {
      return { query: mocks.query, release: mocks.release };
    }
  },
}));

import { persistAuthAuditEventToDb } from './audit-db-sink.js';

const originalDatabaseUrl = process.env.IAM_DATABASE_URL;

beforeEach(() => {
  process.env.IAM_DATABASE_URL = 'postgres://example.invalid/sva';
  mocks.query.mockReset();
  mocks.release.mockReset();
  mocks.query.mockImplementation(async (text: string) => {
    if (text.includes('FROM pg_roles')) {
      return { rowCount: 1, rows: [{ rolsuper: false, rolbypassrls: false }] };
    }
    return { rowCount: 1, rows: [] };
  });
});

afterEach(() => {
  process.env.IAM_DATABASE_URL = originalDatabaseUrl;
});

describe('audit database transaction', () => {
  it('binds the tenant and commits only after the audit event', async () => {
    const result = await persistAuthAuditEventToDb({
      eventType: 'logout',
      workspaceId: 'de-musterhausen',
      outcome: 'success',
    });

    expect(result).toEqual({ persisted: true, writtenEventTypes: ['logout'] });
    expect(mocks.query.mock.calls.map(([text]: [string]) => text.trim())).toEqual([
      'BEGIN',
      'SET LOCAL ROLE iam_app;',
      expect.stringContaining('FROM pg_roles'),
      'SELECT set_config($1, $2, true);',
      expect.stringContaining('INSERT INTO iam.activity_logs'),
      'COMMIT',
    ]);
    expect(mocks.query.mock.calls[3]?.[1]).toEqual(['app.instance_id', 'de-musterhausen']);
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('rolls back a failed platform write and retains the scope-specific reason code', async () => {
    mocks.query.mockImplementation(async (text: string) => {
      if (text.includes('FROM pg_roles')) {
        return { rowCount: 1, rows: [{ rolsuper: false, rolbypassrls: false }] };
      }
      if (text.includes('INSERT INTO iam.platform_activity_logs')) {
        throw new Error('database unavailable');
      }
      return { rowCount: 1, rows: [] };
    });

    await expect(
      persistAuthAuditEventToDb({
        eventType: 'silent_reauth_failed',
        workspaceId: 'platform',
        scope: { kind: 'platform' },
        outcome: 'failure',
      })
    ).rejects.toMatchObject({ reasonCode: 'platform_audit_unavailable' });

    expect(mocks.query.mock.calls.map(([text]: [string]) => text.trim())).toEqual([
      'BEGIN',
      'SET LOCAL ROLE iam_app;',
      expect.stringContaining('FROM pg_roles'),
      'SELECT set_config($1, $2, true);',
      expect.stringContaining('INSERT INTO iam.platform_activity_logs'),
      'ROLLBACK',
    ]);
    expect(mocks.query.mock.calls[3]?.[1]).toEqual(['app.instance_id', '']);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
