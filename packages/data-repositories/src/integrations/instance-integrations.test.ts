import { describe, expect, it } from 'vitest';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import {
  createCachedInstanceIntegrationLoader,
  createInstanceIntegrationRepository,
  instanceIntegrationStatements,
  type InstanceIntegrationRecord,
} from './instance-integrations.js';

const record: InstanceIntegrationRecord = {
  instanceId: 'tenant-a',
  providerKey: 'sva_mainserver',
  graphqlBaseUrl: 'https://main.example.test/graphql',
  oauthTokenUrl: 'https://main.example.test/oauth/token',
  enabled: true,
  lastVerifiedAt: '2026-01-01T00:00:00.000Z',
  lastVerifiedStatus: 'ok',
};

const createExecutor = (rows: readonly Record<string, unknown>[] = []) => {
  const statements: SqlStatement[] = [];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
      statements.push(statement);
      return {
        rowCount: rows.length,
        rows: rows as readonly TRow[],
      };
    },
  };

  return { executor, statements };
};

describe('instance integration repository', () => {
  it('maps selected rows and returns null when no integration exists', async () => {
    const { executor, statements } = createExecutor([
      {
        instance_id: record.instanceId,
        provider_key: record.providerKey,
        graphql_base_url: record.graphqlBaseUrl,
        oauth_token_url: record.oauthTokenUrl,
        enabled: record.enabled,
        last_verified_at: record.lastVerifiedAt,
        last_verified_status: record.lastVerifiedStatus,
      },
    ]);

    await expect(createInstanceIntegrationRepository(executor).getByInstanceId('tenant-a', 'sva_mainserver')).resolves.toEqual(
      record
    );
    expect(statements[0]?.values).toEqual(['tenant-a', 'sva_mainserver']);

    const empty = createExecutor();
    await expect(
      createInstanceIntegrationRepository(empty.executor).getByInstanceId('tenant-a', 'sva_mainserver')
    ).resolves.toBeNull();
  });

  it('builds upsert statements with nullable verification fields', async () => {
    const { executor, statements } = createExecutor();
    const input = {
      ...record,
      lastVerifiedAt: undefined,
      lastVerifiedStatus: undefined,
    };

    await createInstanceIntegrationRepository(executor).upsert(input);

    expect(statements[0]?.text).toContain('ON CONFLICT (instance_id, provider_key) DO UPDATE');
    expect(statements[0]?.values).toEqual([
      'tenant-a',
      'sva_mainserver',
      'https://main.example.test/graphql',
      'https://main.example.test/oauth/token',
      true,
      null,
      null,
    ]);
    expect(instanceIntegrationStatements.upsert(record).values.at(-1)).toBe('ok');
  });
});

describe('cached instance integration loader', () => {
  it('caches successful loads until ttl expiry and deduplicates inflight requests', async () => {
    let now = 1_000;
    let calls = 0;
    const loader = createCachedInstanceIntegrationLoader(
      async () => {
        calls += 1;
        return record;
      },
      {
        cacheTtlMs: 100,
        now: () => now,
      }
    );

    const [first, second] = await Promise.all([
      loader.load('tenant-a', 'sva_mainserver'),
      loader.load('tenant-a', 'sva_mainserver'),
    ]);
    expect(first).toEqual(record);
    expect(second).toEqual(record);
    expect(calls).toBe(1);

    now = 1_050;
    await expect(loader.load('tenant-a', 'sva_mainserver')).resolves.toEqual(record);
    expect(calls).toBe(1);

    now = 1_101;
    await loader.load('tenant-a', 'sva_mainserver');
    expect(calls).toBe(2);

    loader.clear();
    await loader.load('tenant-a', 'sva_mainserver');
    expect(calls).toBe(3);
  });

  it('does not cache missing integrations', async () => {
    let calls = 0;
    const loader = createCachedInstanceIntegrationLoader(async () => {
      calls += 1;
      return null;
    });

    await expect(loader.load('tenant-a', 'sva_mainserver')).resolves.toBeNull();
    await expect(loader.load('tenant-a', 'sva_mainserver')).resolves.toBeNull();
    expect(calls).toBe(2);
  });
});
