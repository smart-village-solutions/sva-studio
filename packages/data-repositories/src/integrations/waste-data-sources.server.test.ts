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

describe('waste data sources server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.IAM_DATABASE_URL;
  });

  it('persists a waste data source configuration inside the IAM transaction boundary', async () => {
    const { saveWasteDataSourceRecord } = await import('./waste-data-sources.server.js');

    const queries: string[] = [];
    const release = vi.fn();
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query: vi.fn(async (text: string) => {
          queries.push(text);
          return { rowCount: 0, rows: [] };
        }),
        release,
      })),
    });

    await saveWasteDataSourceRecord(record, {
      getDatabaseUrl: () => 'postgres://db.example/sva',
    });

    expect(queries).toContain('BEGIN');
    expect(queries).toContain('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('persists explicit connection-check updates without requiring a full config rewrite', async () => {
    const { saveWasteConnectionCheck } = await import('./waste-data-sources.server.js');

    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query,
        release: vi.fn(),
      })),
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

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE iam.instance_waste_data_sources'),
      ['tenant-a', 'error', '2026-05-09T10:00:00.000Z', 'failed', 'connection_refused', 'Host unreachable']
    );
  });

  it('loads an existing waste data source record through the IAM transaction boundary', async () => {
    const { loadWasteDataSourceRecord } = await import('./waste-data-sources.server.js');

    const release = vi.fn();
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query: vi.fn(async (text: string) => {
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

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('fails fast when no IAM database url is configured', async () => {
    const { loadWasteDataSourceRecord } = await import('./waste-data-sources.server.js');

    await expect(
      loadWasteDataSourceRecord('tenant-a', {
        getDatabaseUrl: () => undefined,
      })
    ).rejects.toThrow('IAM database not configured');

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'database_not_configured',
      expect.objectContaining({
        operation: 'waste_data_source_db_tx',
        instance_id: 'tenant-a',
      })
    );
  });

  it('logs pool connection failures before rethrowing them', async () => {
    const { loadWasteDataSourceRecord } = await import('./waste-data-sources.server.js');

    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => {
        throw new Error('connect failed');
      }),
    });

    await expect(
      loadWasteDataSourceRecord('tenant-a', {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      })
    ).rejects.toThrow('connect failed');

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'pool_connect_failed',
      expect.objectContaining({
        operation: 'waste_data_source_db_tx',
        instance_id: 'tenant-a',
        error: 'connect failed',
      })
    );
  });

  it('rolls back and releases the client when the repository write fails', async () => {
    const { saveWasteDataSourceRecord } = await import('./waste-data-sources.server.js');

    const release = vi.fn();
    const query = vi.fn(async (text: string) => {
      if (text.includes('INSERT INTO iam.instance_waste_data_sources')) {
        throw new Error('write failed');
      }
      return { rowCount: 0, rows: [] };
    });
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query,
        release,
      })),
    });

    await expect(
      saveWasteDataSourceRecord(record, {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      })
    ).rejects.toThrow('write failed');

    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'waste_data_source_db_tx_rolled_back',
      expect.objectContaining({
        operation: 'waste_data_source_db_tx',
        instance_id: 'tenant-a',
        error: 'write failed',
      })
    );
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'waste_data_source_db_tx_failed',
      expect.objectContaining({
        operation: 'waste_data_source_db_tx',
        instance_id: 'tenant-a',
        error: 'write failed',
      })
    );
  });

  it('keeps the original repository error when rollback itself fails', async () => {
    const { saveWasteDataSourceRecord } = await import('./waste-data-sources.server.js');

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
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query,
        release,
      })),
    });

    await expect(
      saveWasteDataSourceRecord(record, {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      })
    ).rejects.toThrow('write failed');

    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
    expect(mocks.logger.warn).not.toHaveBeenCalledWith(
      'waste_data_source_db_tx_rolled_back',
      expect.anything()
    );
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'waste_data_source_db_tx_failed',
      expect.objectContaining({
        operation: 'waste_data_source_db_tx',
        instance_id: 'tenant-a',
        error: 'write failed',
      })
    );
  });

  it('reuses pools per database url and closes them during server-state reset', async () => {
    const {
      loadWasteDataSourceRecord,
      resetWasteDataSourceServerState,
      saveWasteConnectionCheck,
    } = await import('./waste-data-sources.server.js');

    const end = vi.fn(async () => undefined);
    const connect = vi.fn(async () => ({
      query: vi.fn(async (text: string) => {
        if (text.includes('SELECT')) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      }),
      release: vi.fn(),
    }));
    mocks.poolFactory.mockReturnValue({
      connect,
      end,
    });

    await loadWasteDataSourceRecord('tenant-a', {
      getDatabaseUrl: () => 'postgres://db.example/shared',
    });
    await saveWasteConnectionCheck(
      {
        instanceId: 'tenant-a',
        checkedAt: '2026-05-09T10:00:00.000Z',
        checkStatus: 'succeeded',
        visibleStatus: 'ok',
      },
      {
        getDatabaseUrl: () => 'postgres://db.example/shared',
      }
    );

    expect(mocks.poolFactory).toHaveBeenCalledTimes(1);

    await resetWasteDataSourceServerState();

    expect(end).toHaveBeenCalledTimes(1);
  });

  it('falls back to IAM_DATABASE_URL when no explicit loader option is provided', async () => {
    process.env.IAM_DATABASE_URL = 'postgres://db.example/from-env';
    const { loadWasteDataSourceRecord } = await import('./waste-data-sources.server.js');

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
