import { describe, expect, it, vi } from 'vitest';

import {
  createCachedInstanceIntegrationLoader,
  createInstanceIntegrationRepository,
  instanceIntegrationStatements,
  type InstanceIntegrationRecord,
} from './instance-integrations';
import type { SqlStatement } from '../iam/repositories';

describe('instanceIntegrationStatements (vitest)', () => {
  it('builds select and upsert statements with expected values', () => {
    const select = instanceIntegrationStatements.select('de-musterhausen', 'sva_mainserver');
    expect(select.text).toContain('FROM iam.instance_integrations');
    expect(select.values).toEqual(['de-musterhausen', 'sva_mainserver']);

    const upsert = instanceIntegrationStatements.upsert({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
    });
    expect(upsert.text).toContain('ON CONFLICT (instance_id, provider_key) DO UPDATE');
    expect(upsert.values).toEqual([
      'de-musterhausen',
      'sva_mainserver',
      'https://mainserver.example.invalid/graphql',
      'https://mainserver.example.invalid/oauth/token',
      true,
      null,
      null,
    ]);
  });
});

describe('createInstanceIntegrationRepository (vitest)', () => {
  it('maps row values and returns null when no rows are found', async () => {
    let call = 0;
    const repository = createInstanceIntegrationRepository({
      async execute<TRow>(_statement: SqlStatement) {
        call += 1;
        if (call === 1) {
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
            ] as unknown as readonly TRow[],
          };
        }
        return { rowCount: 0, rows: [] as readonly TRow[] };
      },
    });

    await expect(repository.getByInstanceId('de-musterhausen', 'sva_mainserver')).resolves.toEqual({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
      lastVerifiedAt: undefined,
      lastVerifiedStatus: undefined,
    });
    await expect(repository.getByInstanceId('de-musterhausen', 'sva_mainserver')).resolves.toBeNull();
  });

  it('delegates upsert to SQL executor', async () => {
    const execute = vi.fn(async () => ({ rowCount: 1, rows: [] }));
    const repository = createInstanceIntegrationRepository({ execute });

    const input: InstanceIntegrationRecord = {
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: false,
      lastVerifiedAt: '2026-03-14T10:00:00.000Z',
      lastVerifiedStatus: 'error',
    };

    await repository.upsert(input);

    expect(execute).toHaveBeenCalledTimes(1);
    const calls = execute.mock.calls as unknown[][];
    const statementCandidate = calls.length > 0 ? calls[0][0] : undefined;
    expect(statementCandidate).toBeDefined();
    const statement = statementCandidate as SqlStatement;
    expect(statement.text).toContain('INSERT INTO iam.instance_integrations');
    expect(statement.values).toEqual([
      'de-musterhausen',
      'sva_mainserver',
      'https://mainserver.example.invalid/graphql',
      'https://mainserver.example.invalid/oauth/token',
      false,
      '2026-03-14T10:00:00.000Z',
      'error',
    ]);
  });
});

describe('createCachedInstanceIntegrationLoader (vitest)', () => {
  it('returns cached values within ttl and reloads after expiry', async () => {
    let nowMs = 0;
    let calls = 0;
    const loader = createCachedInstanceIntegrationLoader(
      async () => {
        calls += 1;
        return {
          instanceId: 'de-musterhausen',
          providerKey: 'sva_mainserver',
          graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
          oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
          enabled: true,
        };
      },
      {
        cacheTtlMs: 100,
        now: () => nowMs,
      }
    );

    await loader.load('de-musterhausen', 'sva_mainserver');
    nowMs = 50;
    await loader.load('de-musterhausen', 'sva_mainserver');
    nowMs = 101;
    await loader.load('de-musterhausen', 'sva_mainserver');

    expect(calls).toBe(2);
  });

  it('deduplicates inflight calls, does not cache null, and can be cleared', async () => {
    let call = 0;
    let firstResult = true;
    const loader = createCachedInstanceIntegrationLoader(async () => {
      call += 1;
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (firstResult) {
        firstResult = false;
        return {
          instanceId: 'de-musterhausen',
          providerKey: 'sva_mainserver',
          graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
          oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
          enabled: true,
        };
      }
      return null;
    });

    await Promise.all([
      loader.load('de-musterhausen', 'sva_mainserver'),
      loader.load('de-musterhausen', 'sva_mainserver'),
    ]);
    expect(call).toBe(1);

    loader.clear();
    await loader.load('de-musterhausen', 'sva_mainserver');
    await loader.load('de-musterhausen', 'sva_mainserver');

    expect(call).toBe(3);
  });
});
