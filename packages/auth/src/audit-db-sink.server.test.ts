import { afterEach, describe, expect, it } from 'vitest';

import { persistAuthAuditEventToDb, persistAuthAuditEventWithClient, type AuditSqlClient } from './audit-db-sink.server';

type LoggedQuery = {
  text: string;
  values: readonly unknown[] | undefined;
};

const createMockClient = () => {
  const queries: LoggedQuery[] = [];
  let accountInserted = false;

  const client: AuditSqlClient = {
    async query<TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) {
      queries.push({ text, values });

      if (text.includes('INSERT INTO iam.accounts')) {
        if (accountInserted) {
          return { rowCount: 0, rows: [] as TRow[] };
        }
        accountInserted = true;
        return { rowCount: 1, rows: [{ id: 'account-1' }] as TRow[] };
      }

      if (text.includes('SELECT id') && text.includes('FROM iam.accounts')) {
        return { rowCount: 1, rows: [{ id: 'account-1' }] as TRow[] };
      }

      return { rowCount: 1, rows: [] as TRow[] };
    },
  };

  return { client, queries };
};

const originalEnv = {
  IAM_PII_ACTIVE_KEY_ID: process.env.IAM_PII_ACTIVE_KEY_ID,
  IAM_PII_KEYRING_JSON: process.env.IAM_PII_KEYRING_JSON,
};

afterEach(() => {
  process.env.IAM_PII_ACTIVE_KEY_ID = originalEnv.IAM_PII_ACTIVE_KEY_ID;
  process.env.IAM_PII_KEYRING_JSON = originalEnv.IAM_PII_KEYRING_JSON;
});

describe('persistAuthAuditEventWithClient', () => {
  it('persists login and account_created on first login', async () => {
    const { client, queries } = createMockClient();

    const result = await persistAuthAuditEventWithClient(client, {
      eventType: 'login',
      actorUserId: 'keycloak-sub-1',
      workspaceId: '11111111-1111-1111-8111-111111111111',
      outcome: 'success',
      requestId: 'req-1',
      traceId: 'trace-1',
    });

    expect(result.persisted).toBe(true);
    expect(result.writtenEventTypes).toEqual(['account_created', 'login']);

    const inserts = queries.filter((entry) => entry.text.includes('INSERT INTO iam.activity_logs'));
    expect(inserts.length).toBe(2);
  });

  it('persists logout without auto account creation', async () => {
    const { client, queries } = createMockClient();

    const result = await persistAuthAuditEventWithClient(client, {
      eventType: 'logout',
      actorUserId: 'keycloak-sub-2',
      workspaceId: '11111111-1111-1111-8111-111111111111',
      outcome: 'success',
    });

    expect(result.persisted).toBe(true);
    expect(result.writtenEventTypes).toEqual(['logout']);

    const accountInserts = queries.filter((entry) => entry.text.includes('INSERT INTO iam.accounts'));
    expect(accountInserts.length).toBe(0);
  });

  it('encrypts pii fields on account creation when keyring is configured', async () => {
    process.env.IAM_PII_ACTIVE_KEY_ID = 'k1';
    process.env.IAM_PII_KEYRING_JSON = JSON.stringify({
      k1: 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=',
    });

    const { client, queries } = createMockClient();

    await persistAuthAuditEventWithClient(client, {
      eventType: 'login',
      actorUserId: 'keycloak-sub-3',
      actorEmail: 'user@example.org',
      actorDisplayName: 'Max Mustermann',
      workspaceId: '11111111-1111-1111-8111-111111111111',
      outcome: 'success',
    });

    const accountInsert = queries.find((entry) => entry.text.includes('INSERT INTO iam.accounts'));
    expect(accountInsert).toBeDefined();
    expect(typeof accountInsert?.values?.[2]).toBe('string');
    expect(typeof accountInsert?.values?.[3]).toBe('string');
    expect(String(accountInsert?.values?.[2])).toMatch(/^enc:v1:k1:/);
    expect(String(accountInsert?.values?.[3])).toMatch(/^enc:v1:k1:/);
    expect(String(accountInsert?.values?.[2])).not.toContain('user@example.org');
    expect(String(accountInsert?.values?.[3])).not.toContain('Max Mustermann');
  });
});

describe('persistAuthAuditEventToDb', () => {
  it('skips persist when instance id is not UUID', async () => {
    const result = await persistAuthAuditEventToDb({
      eventType: 'login',
      actorUserId: 'keycloak-sub-1',
      workspaceId: 'default',
      outcome: 'success',
    });

    expect(result.persisted).toBe(false);
    expect(result.reason).toBe('invalid_instance_id');
    expect(result.writtenEventTypes).toEqual([]);
  });
});
