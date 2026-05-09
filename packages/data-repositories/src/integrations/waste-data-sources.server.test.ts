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
});
