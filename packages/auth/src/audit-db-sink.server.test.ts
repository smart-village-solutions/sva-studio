import { afterEach, describe, expect, it } from 'vitest';

import { persistAuthAuditEventToDb, persistAuthAuditEventWithClient, type AuditSqlClient } from './audit-db-sink.server';

type LoggedQuery = {
  text: string;
  values: readonly unknown[] | undefined;
};

const createMockClient = () => {
  const queries: LoggedQuery[] = [];
  let accountInserted = false;
  let existingAccountId: string | null = null;

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

      if (text.includes('FROM iam.accounts') && text.includes('WHERE keycloak_subject = $1')) {
        if (!existingAccountId) {
          return { rowCount: 0, rows: [] as TRow[] };
        }
        return { rowCount: 1, rows: [{ id: existingAccountId }] as TRow[] };
      }

      return { rowCount: 1, rows: [] as TRow[] };
    },
  };

  return {
    client,
    queries,
    setExistingAccountId(value: string | null) {
      existingAccountId = value;
    },
  };
};

const originalEnv = {
  IAM_DATABASE_URL: process.env.IAM_DATABASE_URL,
  IAM_PII_ACTIVE_KEY_ID: process.env.IAM_PII_ACTIVE_KEY_ID,
  IAM_PII_KEYRING_JSON: process.env.IAM_PII_KEYRING_JSON,
  APP_DB_PASSWORD: process.env.APP_DB_PASSWORD,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
};

afterEach(() => {
  process.env.IAM_DATABASE_URL = originalEnv.IAM_DATABASE_URL;
  process.env.IAM_PII_ACTIVE_KEY_ID = originalEnv.IAM_PII_ACTIVE_KEY_ID;
  process.env.IAM_PII_KEYRING_JSON = originalEnv.IAM_PII_KEYRING_JSON;
  process.env.APP_DB_PASSWORD = originalEnv.APP_DB_PASSWORD;
  process.env.POSTGRES_PASSWORD = originalEnv.POSTGRES_PASSWORD;
});

describe('persistAuthAuditEventWithClient', () => {
  it('persists login and account_created on first login', async () => {
    const { client, queries } = createMockClient();

    const result = await persistAuthAuditEventWithClient(client, {
      eventType: 'login',
      actorUserId: 'keycloak-sub-1',
      workspaceId: 'de-musterhausen',
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
      workspaceId: 'de-musterhausen',
      outcome: 'success',
    });

    expect(result.persisted).toBe(true);
    expect(result.writtenEventTypes).toEqual(['logout']);

    const accountInserts = queries.filter((entry) => entry.text.includes('INSERT INTO iam.accounts'));
    expect(accountInserts.length).toBe(0);
  });

  it('persists platform audit events without tenant activity log writes', async () => {
    const { client, queries } = createMockClient();

    const result = await persistAuthAuditEventWithClient(client, {
      eventType: 'silent_reauth_failed',
      workspaceId: 'platform',
      scope: { kind: 'platform' },
      outcome: 'failure',
      requestId: 'req-platform-1',
      traceId: 'trace-platform-1',
    });

    expect(result.persisted).toBe(true);
    expect(result.writtenEventTypes).toEqual(['silent_reauth_failed']);

    const platformInserts = queries.filter((entry) =>
      entry.text.includes('INSERT INTO iam.platform_activity_logs')
    );
    expect(platformInserts).toHaveLength(1);

    const tenantInserts = queries.filter((entry) => entry.text.includes('INSERT INTO iam.activity_logs'));
    expect(tenantInserts).toHaveLength(0);
  });

  it('updates an existing account instead of attempting a conflicting insert on login', async () => {
    delete process.env.IAM_PII_ACTIVE_KEY_ID;
    delete process.env.IAM_PII_KEYRING_JSON;

    const queries: LoggedQuery[] = [];
    const client: AuditSqlClient = {
      async query<TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) {
        queries.push({ text, values });

        if (text.includes('INSERT INTO iam.accounts')) {
          throw new Error('unexpected account insert');
        }

        if (text.includes('FROM iam.accounts') && text.includes('WHERE keycloak_subject = $1')) {
          return { rowCount: 1, rows: [{ id: 'account-existing' }] as TRow[] };
        }

        return { rowCount: 1, rows: [] as TRow[] };
      },
    };

    const result = await persistAuthAuditEventWithClient(client, {
      eventType: 'login',
      actorUserId: 'keycloak-existing-1',
      actorEmail: 'existing@example.org',
      actorDisplayName: 'Existing User',
      workspaceId: 'de-musterhausen',
      outcome: 'success',
    });

    expect(result.persisted).toBe(true);
    expect(result.writtenEventTypes).toEqual(['login']);

    const accountInserts = queries.filter((entry) => entry.text.includes('INSERT INTO iam.accounts'));
    expect(accountInserts.length).toBe(0);

    const accountUpdates = queries.filter((entry) => entry.text.includes('UPDATE iam.accounts'));
    expect(accountUpdates.length).toBe(0);
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
      workspaceId: 'de-musterhausen',
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

  it('updates encrypted pii fields for an existing account when keyring is configured', async () => {
    process.env.IAM_PII_ACTIVE_KEY_ID = 'k1';
    process.env.IAM_PII_KEYRING_JSON = JSON.stringify({
      k1: 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=',
    });

    const queries: LoggedQuery[] = [];
    const client: AuditSqlClient = {
      async query<TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) {
        queries.push({ text, values });

        if (text.includes('INSERT INTO iam.accounts')) {
          throw new Error('unexpected account insert');
        }

        if (text.includes('FROM iam.accounts') && text.includes('WHERE keycloak_subject = $1')) {
          return { rowCount: 1, rows: [{ id: 'account-existing' }] as TRow[] };
        }

        return { rowCount: 1, rows: [] as TRow[] };
      },
    };

    const result = await persistAuthAuditEventWithClient(client, {
      eventType: 'login',
      actorUserId: 'keycloak-existing-2',
      actorEmail: 'existing@example.org',
      actorDisplayName: 'Existing User',
      workspaceId: 'de-musterhausen',
      outcome: 'success',
    });

    expect(result.persisted).toBe(true);
    expect(result.writtenEventTypes).toEqual(['login']);

    const accountUpdates = queries.filter((entry) => entry.text.includes('UPDATE iam.accounts'));
    expect(accountUpdates).toHaveLength(1);
    expect(String(accountUpdates[0]?.values?.[2])).toMatch(/^enc:v1:k1:/);
    expect(String(accountUpdates[0]?.values?.[3])).toMatch(/^enc:v1:k1:/);
  });
});

describe('persistAuthAuditEventToDb', () => {
  it('skips persist when workspaceId is empty or whitespace', async () => {
    process.env.IAM_DATABASE_URL = 'postgres://example.invalid/sva';

    const result = await persistAuthAuditEventToDb({
      eventType: 'login',
      actorUserId: 'keycloak-sub-1',
      workspaceId: '   ',
      outcome: 'success',
    });

    expect(result.persisted).toBe(false);
    expect(result.reason).toBe('invalid_instance_id');
    expect(result.writtenEventTypes).toEqual([]);
  });

  it('skips persist when no IAM database url is configured', async () => {
    delete process.env.IAM_DATABASE_URL;
    delete process.env.APP_DB_PASSWORD;
    delete process.env.POSTGRES_PASSWORD;

    const result = await persistAuthAuditEventToDb({
      eventType: 'login',
      actorUserId: 'keycloak-sub-2',
      workspaceId: 'de-musterhausen',
      outcome: 'success',
    });

    expect(result.persisted).toBe(false);
    expect(result.reason).toBe('missing_database_url');
    expect(result.writtenEventTypes).toEqual([]);
  });

  it('skips persist when no valid scope can be resolved', async () => {
    process.env.IAM_DATABASE_URL = 'postgres://example.invalid/sva';

    const result = await persistAuthAuditEventToDb({
      eventType: 'login',
      actorUserId: 'keycloak-sub-3',
      workspaceId: 'default',
      outcome: 'success',
    });

    expect(result.persisted).toBe(false);
    expect(result.reason).toBe('invalid_scope');
    expect(result.writtenEventTypes).toEqual([]);
  });
});
