import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const queries: Array<{ text: string; values?: readonly unknown[] }> = [];
  const clients: Array<{ query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }> = [];
  let failSelect = false;
  let failRollback = false;

  const reset = () => {
    queries.length = 0;
    clients.length = 0;
    failSelect = false;
    failRollback = false;
  };

  const setFailSelect = (value: boolean) => {
    failSelect = value;
  };

  const shouldFailSelect = () => failSelect;

  const setFailRollback = (value: boolean) => {
    failRollback = value;
  };

  const shouldFailRollback = () => failRollback;

  return {
    queries,
    clients,
    reset,
    setFailSelect,
    setFailRollback,
    shouldFailSelect,
    shouldFailRollback,
  };
});

const endMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('pg', () => {
  class Pool {
    readonly connect = vi.fn(async () => {
      const query = vi.fn(async (text: string, values?: readonly unknown[]) => {
        state.queries.push({ text, values });

        if (text === 'ROLLBACK' && state.shouldFailRollback()) {
          throw new Error('rollback failed');
        }

        if (text.includes('FROM iam.instance_integrations')) {
          if (state.shouldFailSelect()) {
            throw new Error('boom');
          }

          return {
            rowCount: 1,
            rows: [
              {
                instance_id: 'de-musterhausen',
                provider_key: 'sva_mainserver',
                graphql_base_url: 'https://mainserver.example.invalid/graphql',
                oauth_token_url: 'https://mainserver.example.invalid/oauth/token',
                enabled: true,
                last_verified_at: null,
                last_verified_status: null,
              },
            ],
          };
        }

        return { rowCount: 0, rows: [] };
      });
      const release = vi.fn();
      state.clients.push({ query, release });
      return { query, release };
    });

    readonly end = endMock;
  }

  return { Pool };
});

describe('loadInstanceIntegrationRecord (server)', () => {
  beforeEach(async () => {
    state.reset();
    process.env.IAM_DATABASE_URL = 'postgres://local/test';
    const mod = await import('./instance-integrations.server');
    await mod.resetInstanceIntegrationServerState();
    endMock.mockClear();
  });

  it('throws when IAM database URL is not configured', async () => {
    const mod = await import('./instance-integrations.server');

    await expect(
      mod.loadInstanceIntegrationRecord('de-musterhausen', 'sva_mainserver', {
        getDatabaseUrl: () => undefined,
      })
    ).rejects.toThrow('IAM database not configured');
  });

  it('loads and maps records via transactional DB access', async () => {
    const mod = await import('./instance-integrations.server');

    const record = await mod.loadInstanceIntegrationRecord('de-musterhausen', 'sva_mainserver', {
      cacheTtlMs: 0,
      getDatabaseUrl: () => 'postgres://local/test',
    });

    expect(record).toEqual({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
      lastVerifiedAt: undefined,
      lastVerifiedStatus: undefined,
    });

    expect(state.queries.some((entry) => entry.text === 'BEGIN')).toBe(true);
    expect(
      state.queries.some(
        (entry) =>
          entry.text === 'SELECT set_config($1, $2, true);' &&
          entry.values?.[0] === 'app.instance_id' &&
          entry.values?.[1] === 'de-musterhausen'
      )
    ).toBe(true);
    expect(state.queries.some((entry) => entry.text === 'COMMIT')).toBe(true);
    expect(state.clients[0]?.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back transaction when repository execution fails', async () => {
    const mod = await import('./instance-integrations.server');
    state.setFailSelect(true);

    await expect(
      mod.loadInstanceIntegrationRecord('de-musterhausen', 'sva_mainserver', {
        cacheTtlMs: 0,
        getDatabaseUrl: () => 'postgres://local/test',
      })
    ).rejects.toThrow('boom');

    expect(state.queries.some((entry) => entry.text === 'ROLLBACK')).toBe(true);
  });

  it('preserves original error when rollback itself fails', async () => {
    const mod = await import('./instance-integrations.server');
    state.setFailSelect(true);
    state.setFailRollback(true);

    await expect(
      mod.loadInstanceIntegrationRecord('de-musterhausen', 'sva_mainserver', {
        cacheTtlMs: 0,
        getDatabaseUrl: () => 'postgres://local/test',
      })
    ).rejects.toThrow('boom');

    expect(state.queries.some((entry) => entry.text === 'ROLLBACK')).toBe(true);
  });

  it('uses a custom loader when cacheTtlMs is explicitly set to 0', async () => {
    const mod = await import('./instance-integrations.server');
    const loadRecord = vi.fn(async () => null);

    await mod.loadInstanceIntegrationRecord('de-musterhausen', 'sva_mainserver', {
      cacheTtlMs: 0,
      loadRecord,
    });

    expect(loadRecord).toHaveBeenCalledTimes(1);
  });

  it('cleans up shared pool state on reset', async () => {
    const mod = await import('./instance-integrations.server');

    await mod.loadInstanceIntegrationRecord('de-musterhausen', 'sva_mainserver', {
      cacheTtlMs: 0,
      getDatabaseUrl: () => 'postgres://local/test',
    });

    await mod.resetInstanceIntegrationServerState();

    expect(endMock).toHaveBeenCalledTimes(1);
  });
});
