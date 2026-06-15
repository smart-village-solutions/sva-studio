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
  providerKey: 'sva_mainserver' as const,
  graphqlBaseUrl: 'https://main.example.test/graphql',
  oauthTokenUrl: 'https://main.example.test/oauth/token',
  enabled: true,
  lastVerifiedAt: '2026-01-01T00:00:00.000Z',
  lastVerifiedStatus: 'ok',
};

describe('data server re-export instance integrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('covers caching, writes and invalidation through the public server entrypoint', async () => {
    const { loadInstanceIntegrationRecord, resetInstanceIntegrationServerState, saveInstanceIntegrationRecord } =
      await import('../server.js');

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

    const loadRecord = vi.fn(async () => record);
    const options = {
      cacheTtlMs: 100,
      now: () => 1_000,
      getDatabaseUrl: () => 'postgres://db.example/sva',
      loadRecord,
    };

    await expect(loadInstanceIntegrationRecord('tenant-a', 'sva_mainserver', options)).resolves.toEqual(record);
    await expect(loadInstanceIntegrationRecord('tenant-a', 'sva_mainserver', options)).resolves.toEqual(record);
    expect(loadRecord).toHaveBeenCalledTimes(1);

    await saveInstanceIntegrationRecord(record, {
      getDatabaseUrl: () => 'postgres://db.example/sva',
    });

    await expect(loadInstanceIntegrationRecord('tenant-a', 'sva_mainserver', options)).resolves.toEqual(record);
    expect(loadRecord).toHaveBeenCalledTimes(2);
    expect(queries).toContain('BEGIN');
    expect(queries).toContain('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('covers missing-db, connect-failure and rollback branches through the public server entrypoint', async () => {
    const { loadInstanceIntegrationRecord, resetInstanceIntegrationServerState, saveInstanceIntegrationRecord } =
      await import('../server.js');

    await expect(
      saveInstanceIntegrationRecord(record, {
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
      loadInstanceIntegrationRecord('tenant-a', 'sva_mainserver', {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      })
    ).rejects.toThrow('connect failed');
    await resetInstanceIntegrationServerState();

    const release = vi.fn();
    const query = vi.fn(async (text: string) => {
      if (text.includes('INSERT INTO iam.instance_integrations')) {
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
      saveInstanceIntegrationRecord(record, {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      })
    ).rejects.toThrow('write failed');

    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'instance_integration_db_tx_failed',
      expect.objectContaining({
        instance_id: 'tenant-a',
        error: 'write failed',
      })
    );
  });
});
