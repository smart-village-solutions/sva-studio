import { Pool, type PoolClient } from 'pg';
import {
  encryptFieldValue,
  parseFieldEncryptionConfigFromEnv,
  type FieldEncryptionConfig,
} from '@sva/core/security';

import type { AuthAuditEvent, AuthAuditEventType } from './audit-events.types.js';
import { getIamDatabaseUrl } from './runtime-secrets.server.js';

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
let cachedEncryptionConfig: FieldEncryptionConfig | null = null;
let cachedEncryptionConfigSignature: string | null = null;

const resolveAuditPool = (): Pool | null => {
  const databaseUrl = getIamDatabaseUrl();
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

const resolveEncryptionConfig = (): FieldEncryptionConfig | null => {
  const activeKeyId = process.env.IAM_PII_ACTIVE_KEY_ID ?? '';
  const keyringJson = process.env.IAM_PII_KEYRING_JSON ?? '';
  const signature = `${activeKeyId}::${keyringJson}`;

  if (signature === cachedEncryptionConfigSignature) {
    return cachedEncryptionConfig;
  }

  cachedEncryptionConfig = parseFieldEncryptionConfigFromEnv(process.env);
  cachedEncryptionConfigSignature = signature;
  return cachedEncryptionConfig;
};

const resolveAccountId = async (
  client: AuditSqlClient,
  input: { keycloakSubject: string; instanceId: string }
) => {
  const lookup = await client.query<{ id: string }>(
    `
SELECT id
FROM iam.accounts
WHERE keycloak_subject = $1
  AND instance_id = $2
LIMIT 1;
`,
    [input.keycloakSubject, input.instanceId]
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

  const config = resolveEncryptionConfig();
  if (!config) {
    return null;
  }

  return encryptFieldValue(plaintext, config, aad);
};

const assertIamAppRuntimeRole = async (client: AuditSqlClient) => {
  await client.query('SET LOCAL ROLE iam_app;');
  const result = await client.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
    `
SELECT rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname = current_user;
`
  );
  const role = result.rows[0];
  if (!role || role.rolsuper || role.rolbypassrls) {
    throw new Error('Unsafe runtime role for audit sink: current role must not be SUPERUSER or BYPASSRLS.');
  }
};

const ensureAccount = async (
  client: AuditSqlClient,
  input: {
    instanceId: string;
    keycloakSubject: string;
    encryptedEmailCiphertext: string | null;
    encryptedDisplayNameCiphertext: string | null;
  }
): Promise<{ accountId?: string; created: boolean }> => {
  const existingAccountId = await resolveAccountId(client, {
    keycloakSubject: input.keycloakSubject,
    instanceId: input.instanceId,
  });

  if (existingAccountId) {
    if (input.encryptedEmailCiphertext || input.encryptedDisplayNameCiphertext) {
      await client.query(
        `
UPDATE iam.accounts
SET
  email_ciphertext = COALESCE($3, email_ciphertext),
  display_name_ciphertext = COALESCE($4, display_name_ciphertext),
  updated_at = NOW()
WHERE keycloak_subject = $1
  AND instance_id = $2;
`,
        [input.keycloakSubject, input.instanceId, input.encryptedEmailCiphertext, input.encryptedDisplayNameCiphertext]
      );
    }

    return {
      accountId: existingAccountId,
      created: false,
    };
  }

  const inserted = await client.query<{ id: string }>(
    `
INSERT INTO iam.accounts (instance_id, keycloak_subject, email_ciphertext, display_name_ciphertext)
VALUES ($1, $2, $3, $4)
ON CONFLICT (keycloak_subject, instance_id) WHERE instance_id IS NOT NULL DO NOTHING
RETURNING id;
`,
    [input.instanceId, input.keycloakSubject, input.encryptedEmailCiphertext, input.encryptedDisplayNameCiphertext]
  );

  if (inserted.rowCount > 0) {
    return {
      accountId: inserted.rows[0]?.id,
      created: true,
    };
  }

  const accountId = await resolveAccountId(client, {
    keycloakSubject: input.keycloakSubject,
    instanceId: input.instanceId,
  });

  if (accountId && (input.encryptedEmailCiphertext || input.encryptedDisplayNameCiphertext)) {
    await client.query(
      `
UPDATE iam.accounts
SET
  email_ciphertext = COALESCE($3, email_ciphertext),
  display_name_ciphertext = COALESCE($4, display_name_ciphertext),
  updated_at = NOW()
WHERE keycloak_subject = $1
  AND instance_id = $2;
`,
      [input.keycloakSubject, input.instanceId, input.encryptedEmailCiphertext, input.encryptedDisplayNameCiphertext]
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
        instanceId: event.workspaceId,
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
      accountId = await resolveAccountId(client, {
        keycloakSubject: event.actorUserId,
        instanceId: event.workspaceId,
      });
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
  if (!event.workspaceId || event.workspaceId.trim().length === 0) {
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
    await assertIamAppRuntimeRole(client);
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
