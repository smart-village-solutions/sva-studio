import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  poolFactory: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => mocks.logger,
}));

vi.mock('pg', () => ({
  Pool: function MockPool(config: unknown) {
    return mocks.poolFactory(config);
  },
}));

const record = {
  instanceId: 'tenant-a',
  provider: 'supabase' as const,
  projectUrl: 'https://tenant-a.supabase.co',
  schemaName: 'public',
  enabled: true,
  databaseUrlConfigured: true,
  serviceRoleKeyConfigured: true,
  databaseUrlCiphertext: 'db-cipher',
  serviceRoleKeyCiphertext: 'service-cipher',
  visibleStatus: 'ok' as const,
  lastCheckedAt: '2026-05-09T09:00:00.000Z',
  lastCheckStatus: 'succeeded' as const,
};

describe('data server re-export waste data sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.IAM_DATABASE_URL;
  });

  it('covers transactional read, write and rollback branches through the public server entrypoint', async () => {
    const { loadWasteDataSourceRecord, saveWasteConnectionCheck, saveWasteDataSourceRecord } = await import('../server.js');

    const queries: string[] = [];
    const release = vi.fn();
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query: vi.fn(async (text: string) => {
          queries.push(text);
          if (text.includes('SELECT')) {
            return {
              rowCount: 1,
              rows: [
                {
                  instance_id: 'tenant-a',
                  provider_key: 'supabase',
                  project_url: 'https://tenant-a.supabase.co',
                  schema_name: 'public',
                  enabled: true,
                  database_url_ciphertext: 'db-cipher',
                  service_role_key_ciphertext: 'service-cipher',
                  visible_status: 'ok',
                  last_checked_at: '2026-05-09T09:00:00.000Z',
                  last_check_status: 'succeeded',
                  last_check_error_code: null,
                  last_check_error_message: null,
                  updated_at: '2026-05-09T09:00:00.000Z',
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        }),
        release,
      })),
    });

    await saveWasteDataSourceRecord(record, {
      getDatabaseUrl: () => 'postgres://db.example/sva',
    });
    await saveWasteConnectionCheck(
      {
        instanceId: 'tenant-a',
        checkedAt: '2026-05-09T10:00:00.000Z',
        checkStatus: 'failed',
        visibleStatus: 'error',
        errorCode: 'connection_refused',
        errorMessage: 'Host unreachable',
      },
      {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      }
    );

    await expect(
      loadWasteDataSourceRecord('tenant-a', {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      })
    ).resolves.toEqual({
      ...record,
      lastCheckErrorCode: undefined,
      lastCheckErrorMessage: undefined,
      updatedAt: '2026-05-09T09:00:00.000Z',
    });

    expect(queries).toContain('BEGIN');
    expect(queries).toContain('COMMIT');
    expect(release).toHaveBeenCalledTimes(3);
  });

  it('covers missing-db, connect-failure, rollback, reset and env-fallback branches through the public server entrypoint', async () => {
    const {
      loadWasteDataSourceRecord,
      resetWasteDataSourceServerState,
      saveWasteConnectionCheck,
      saveWasteDataSourceRecord,
    } = await import('../server.js');

    await expect(
      loadWasteDataSourceRecord('tenant-a', {
        getDatabaseUrl: () => undefined,
      })
    ).rejects.toThrow('IAM database not configured');

    mocks.poolFactory.mockReturnValueOnce({
      connect: vi.fn(async () => {
        throw new Error('connect failed');
      }),
      end: vi.fn(async () => undefined),
    });
    await expect(
      loadWasteDataSourceRecord('tenant-a', {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      })
    ).rejects.toThrow('connect failed');
    await resetWasteDataSourceServerState();

    const release = vi.fn();
    const query = vi.fn(async (text: string) => {
      if (text === 'ROLLBACK') {
        throw new Error('rollback failed');
      }
      if (text.includes('INSERT INTO iam.instance_waste_data_sources')) {
        throw new Error('write failed');
      }
      return { rowCount: 0, rows: [] };
    });
    const end = vi.fn(async () => undefined);
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query,
        release,
      })),
      end,
    });

    await expect(
      saveWasteDataSourceRecord(record, {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      })
    ).rejects.toThrow('write failed');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'waste_data_source_db_tx_failed',
      expect.objectContaining({
        instance_id: 'tenant-a',
        error: 'write failed',
      })
    );

    await saveWasteConnectionCheck(
      {
        instanceId: 'tenant-a',
        checkedAt: '2026-05-09T10:00:00.000Z',
        checkStatus: 'succeeded',
        visibleStatus: 'ok',
      },
      {
        getDatabaseUrl: () => 'postgres://db.example/sva-shared',
      }
    );

    await resetWasteDataSourceServerState();
    expect(end).toHaveBeenCalledTimes(2);

    process.env.IAM_DATABASE_URL = 'postgres://db.example/from-env';
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
        release: vi.fn(),
      })),
    });

    await expect(loadWasteDataSourceRecord('tenant-a')).resolves.toBeNull();
    expect(mocks.poolFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: 'postgres://db.example/from-env',
      })
    );
  });
});
