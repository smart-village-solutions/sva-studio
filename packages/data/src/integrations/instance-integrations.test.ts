import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createInstanceIntegrationRepository,
  instanceIntegrationStatements,
  type InstanceIntegrationRecord,
} from './instance-integrations';
import type { SqlStatement } from '../iam/repositories';

describe('instance integration statements', () => {
  it('builds select statements for an instance scoped provider', () => {
    const statement = instanceIntegrationStatements.select('de-musterhausen', 'sva_mainserver');

    assert.match(statement.text, /FROM iam\.instance_integrations/);
    assert.deepEqual(statement.values, ['de-musterhausen', 'sva_mainserver']);
  });

  it('builds upsert statements with verification metadata', () => {
    const record: InstanceIntegrationRecord = {
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
      lastVerifiedAt: '2026-03-14T10:00:00.000Z',
      lastVerifiedStatus: 'ok',
    };

    const statement = instanceIntegrationStatements.upsert(record);

    assert.match(statement.text, /ON CONFLICT \(instance_id, provider_key\) DO UPDATE/);
    assert.deepEqual(statement.values, [
      'de-musterhausen',
      'sva_mainserver',
      'https://mainserver.example.invalid/graphql',
      'https://mainserver.example.invalid/oauth/token',
      true,
      '2026-03-14T10:00:00.000Z',
      'ok',
    ]);
  });
});

describe('instance integration repository', () => {
  it('maps rows from the SQL executor', async () => {
    const repository = createInstanceIntegrationRepository({
      async execute<TRow>(_statement: SqlStatement) {
        return {
          rowCount: 1,
          rows: [
            {
              instance_id: 'de-musterhausen',
              provider_key: 'sva_mainserver',
              graphql_base_url: 'https://mainserver.example.invalid/graphql',
              oauth_token_url: 'https://mainserver.example.invalid/oauth/token',
              enabled: true,
              last_verified_at: '2026-03-14T10:00:00.000Z',
              last_verified_status: 'ok',
            },
          ] as unknown as readonly TRow[],
        };
      },
    });

    const record = await repository.getByInstanceId('de-musterhausen', 'sva_mainserver');

    assert.deepEqual(record, {
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
      lastVerifiedAt: '2026-03-14T10:00:00.000Z',
      lastVerifiedStatus: 'ok',
    });
  });

  it('delegates upserts to the SQL executor', async () => {
    const captured: SqlStatement[] = [];
    const repository = createInstanceIntegrationRepository({
      async execute(statement) {
        captured.push(statement);
        return { rowCount: 1, rows: [] };
      },
    });

    await repository.upsert({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: false,
    });

    assert.equal(captured.length, 1);
    assert.match(captured[0].text, /INSERT INTO iam\.instance_integrations/);
  });
});
