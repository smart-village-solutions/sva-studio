import { Pool, type PoolClient } from 'pg';
import { encryptFieldValue, parseFieldEncryptionConfigFromEnv } from '@sva/core/security';

import type { AuthAuditEvent, AuthAuditEventType } from './audit-events.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PersistAuthAuditResult = {
  persisted: boolean;
  reason?: 'missing_database_url' | 'invalid_instance_id';
  writtenEventTypes: readonly AuthAuditEventType[];
};

type QueryResult<TRow> = {
  rowCount: number;
  rows: TRow[];
};

export type AuditSqlClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
};

let auditPool: Pool | null = null;

const resolveAuditPool = (): Pool | null => {
  const databaseUrl = process.env.IAM_DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  if (!auditPool) {
    auditPool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }

  return auditPool;
};

const resolveAccountId = async (client: AuditSqlClient, keycloakSubject: string) => {
  const lookup = await client.query<{ id: string }>(
    `
SELECT id
FROM iam.accounts
WHERE keycloak_subject = $1
LIMIT 1;
`,
    [keycloakSubject]
  );

  if (lookup.rowCount <= 0) {
    return undefined;
  }

  return lookup.rows[0]?.id;
};

const encryptOptionalPii = (plaintext: string | undefined, aad: string): string | null => {
  if (!plaintext) {
    return null;
  }

  const config = parseFieldEncryptionConfigFromEnv(process.env);
  if (!config) {
    return null;
  }

  return encryptFieldValue(plaintext, config, aad);
};

const ensureAccount = async (
  client: AuditSqlClient,
  input: {
    keycloakSubject: string;
    encryptedEmailCiphertext: string | null;
    encryptedDisplayNameCiphertext: string | null;
  }
): Promise<{ accountId?: string; created: boolean }> => {
  const inserted = await client.query<{ id: string }>(
    `
INSERT INTO iam.accounts (keycloak_subject, email_ciphertext, display_name_ciphertext)
VALUES ($1, $2, $3)
ON CONFLICT (keycloak_subject) DO NOTHING
RETURNING id;
`,
    [input.keycloakSubject, input.encryptedEmailCiphertext, input.encryptedDisplayNameCiphertext]
  );

  if (inserted.rowCount > 0) {
    return {
      accountId: inserted.rows[0]?.id,
      created: true,
    };
  }

  const accountId = await resolveAccountId(client, input.keycloakSubject);

  if (accountId && (input.encryptedEmailCiphertext || input.encryptedDisplayNameCiphertext)) {
    await client.query(
      `
UPDATE iam.accounts
SET
  email_ciphertext = COALESCE($2, email_ciphertext),
  display_name_ciphertext = COALESCE($3, display_name_ciphertext),
  updated_at = NOW()
WHERE keycloak_subject = $1;
`,
      [input.keycloakSubject, input.encryptedEmailCiphertext, input.encryptedDisplayNameCiphertext]
    );
  }

  return {
    accountId,
    created: false,
  };
};

const insertActivityLog = async (
  client: AuditSqlClient,
  input: {
    eventType: AuthAuditEventType;
    instanceId: string;
    accountId?: string;
    actorUserId?: string;
    outcome: AuthAuditEvent['outcome'];
    requestId?: string;
    traceId?: string;
  }
) => {
  const payload = {
    outcome: input.outcome,
    actor_user_id: input.actorUserId ?? null,
  };

  await client.query(
    `
INSERT INTO iam.activity_logs (
  instance_id,
  account_id,
  event_type,
  payload,
  request_id,
  trace_id
)
VALUES ($1, $2, $3, $4::jsonb, $5, $6);
`,
    [
      input.instanceId,
      input.accountId ?? null,
      input.eventType,
      JSON.stringify(payload),
      input.requestId ?? null,
      input.traceId ?? null,
    ]
  );
};

export const persistAuthAuditEventWithClient = async (
  client: AuditSqlClient,
  event: Required<Pick<AuthAuditEvent, 'workspaceId'>> & AuthAuditEvent
): Promise<PersistAuthAuditResult> => {
  const writtenEventTypes: AuthAuditEventType[] = [];
  const isLoginSuccess = event.eventType === 'login' && event.outcome === 'success';
  let accountId: string | undefined;

  if (event.actorUserId) {
    if (isLoginSuccess) {
      const encryptedEmailCiphertext = encryptOptionalPii(
        event.actorEmail,
        `iam.accounts.email:${event.actorUserId}`
      );
      const encryptedDisplayNameCiphertext = encryptOptionalPii(
        event.actorDisplayName,
        `iam.accounts.display_name:${event.actorUserId}`
      );

      const ensured = await ensureAccount(client, {
        keycloakSubject: event.actorUserId,
        encryptedEmailCiphertext,
        encryptedDisplayNameCiphertext,
      });
      accountId = ensured.accountId;

      if (ensured.created) {
        await insertActivityLog(client, {
          eventType: 'account_created',
          instanceId: event.workspaceId,
          accountId,
          actorUserId: event.actorUserId,
          outcome: 'success',
          requestId: event.requestId,
          traceId: event.traceId,
        });
        writtenEventTypes.push('account_created');
      }
    } else {
      accountId = await resolveAccountId(client, event.actorUserId);
    }
  }

  await insertActivityLog(client, {
    eventType: event.eventType,
    instanceId: event.workspaceId,
    accountId,
    actorUserId: event.actorUserId,
    outcome: event.outcome,
    requestId: event.requestId,
    traceId: event.traceId,
  });
  writtenEventTypes.push(event.eventType);

  return {
    persisted: true,
    writtenEventTypes,
  };
};

export const persistAuthAuditEventToDb = async (
  event: Required<Pick<AuthAuditEvent, 'workspaceId'>> & AuthAuditEvent
): Promise<PersistAuthAuditResult> => {
  if (!UUID_PATTERN.test(event.workspaceId)) {
    return {
      persisted: false,
      reason: 'invalid_instance_id',
      writtenEventTypes: [],
    };
  }

  const pool = resolveAuditPool();
  if (!pool) {
    return {
      persisted: false,
      reason: 'missing_database_url',
      writtenEventTypes: [],
    };
  }

  const client = (await pool.connect()) as PoolClient & AuditSqlClient;
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true);', ['app.instance_id', event.workspaceId]);

    const result = await persistAuthAuditEventWithClient(client, event);
    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
