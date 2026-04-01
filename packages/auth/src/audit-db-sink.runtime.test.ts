import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  connect: vi.fn(),
  release: vi.fn(),
  query: vi.fn(),
}));

vi.mock('@sva/core/security', () => ({
  encryptFieldValue: vi.fn((value: string) => `enc:${value}`),
  parseFieldEncryptionConfigFromEnv: vi.fn(() => null),
}));

vi.mock('pg', () => ({
  Pool: class MockPool {
    connect = state.connect;
  },
}));

const originalEnv = { ...process.env };

describe('audit-db-sink runtime transaction handling', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv, IAM_DATABASE_URL: 'postgres://iam-test' };
    state.release.mockReset();
    state.query.mockImplementation(async (text: string) => {
      if (text.includes('FROM pg_roles')) {
        return { rowCount: 1, rows: [{ rolsuper: false, rolbypassrls: false }] };
      }
      if (text.includes('FROM iam.accounts') && text.includes('WHERE keycloak_subject = $1')) {
        return { rowCount: 1, rows: [{ id: 'account-1' }] };
      }
      return { rowCount: 1, rows: [] };
    });
    state.connect.mockResolvedValue({
      query: state.query,
      release: state.release,
    });
  });

  it('wraps persistence in a transaction and commits on success', async () => {
    const { persistAuthAuditEventToDb } = await import('./audit-db-sink.server.js');

    const result = await persistAuthAuditEventToDb({
      eventType: 'logout',
      actorUserId: 'keycloak-sub-1',
      workspaceId: 'de-musterhausen',
      outcome: 'success',
    });

    expect(result).toEqual({
      persisted: true,
      writtenEventTypes: ['logout'],
    });
    expect(state.query).toHaveBeenCalledWith('BEGIN');
    expect(state.query).toHaveBeenCalledWith('SET LOCAL ROLE iam_app;');
    expect(state.query).toHaveBeenCalledWith('SELECT set_config($1, $2, true);', [
      'app.instance_id',
      'de-musterhausen',
    ]);
    expect(state.query).toHaveBeenCalledWith('COMMIT');
    expect(state.release).toHaveBeenCalledOnce();
  });

  it('rolls back when the runtime role is unsafe', async () => {
    state.query.mockImplementation(async (text: string) => {
      if (text.includes('FROM pg_roles')) {
        return { rowCount: 1, rows: [{ rolsuper: true, rolbypassrls: false }] };
      }
      return { rowCount: 1, rows: [] };
    });

    const { persistAuthAuditEventToDb } = await import('./audit-db-sink.server.js');

    await expect(
      persistAuthAuditEventToDb({
        eventType: 'logout',
        actorUserId: 'keycloak-sub-2',
        workspaceId: 'de-musterhausen',
        outcome: 'success',
      })
    ).rejects.toThrow('Unsafe runtime role');

    expect(state.query).toHaveBeenCalledWith('ROLLBACK');
    expect(state.release).toHaveBeenCalledOnce();
  });
});
