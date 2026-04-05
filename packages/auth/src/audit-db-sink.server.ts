import { Pool, type PoolClient } from 'pg';
import {
  encryptFieldValue,
  parseFieldEncryptionConfigFromEnv,
  type FieldEncryptionConfig,
} from '@sva/core/security';

import type { AuthAuditEvent, AuthAuditEventType } from './audit-events.types.js';
import { getIamDatabaseUrl } from './runtime-secrets.server.js';
import { getRuntimeScopeRef } from './scope.js';
import type { RuntimeScopeRef } from './types.js';

export type PersistAuthAuditResult = {
  persisted: boolean;
  reason?:
    | 'missing_database_url'
    | 'invalid_scope'
    | 'invalid_instance_id'
    | 'platform_audit_unavailable'
    | 'tenant_audit_unavailable';
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

const insertPlatformActivityLog = async (
  client: AuditSqlClient,
  input: {
    eventType: AuthAuditEventType;
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
INSERT INTO iam.platform_activity_logs (
  scope_kind,
  account_id,
  event_type,
  actor_user_id,
  payload,
  request_id,
  trace_id
)
VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7);
`,
    [
      'platform',
      input.accountId ?? null,
      input.eventType,
      input.actorUserId ?? null,
      JSON.stringify(payload),
      input.requestId ?? null,
      input.traceId ?? null,
    ]
  );
};

const resolveAuditAccountContext = async (
  client: AuditSqlClient,
  scope: RuntimeScopeRef,
  event: Required<Pick<AuthAuditEvent, 'workspaceId'>> & AuthAuditEvent
) => {
  if (scope.kind !== 'instance' || !event.actorUserId) {
    return {
      accountId: undefined,
      writtenEventTypes: [] as AuthAuditEventType[],
    };
  }

  if (event.eventType !== 'login' || event.outcome !== 'success') {
    return {
      accountId: await resolveAccountId(client, {
        keycloakSubject: event.actorUserId,
        instanceId: scope.instanceId,
      }),
      writtenEventTypes: [] as AuthAuditEventType[],
    };
  }

  const encryptedEmailCiphertext = encryptOptionalPii(
    event.actorEmail,
    `iam.accounts.email:${event.actorUserId}`
  );
  const encryptedDisplayNameCiphertext = encryptOptionalPii(
    event.actorDisplayName,
    `iam.accounts.display_name:${event.actorUserId}`
  );

  const ensured = await ensureAccount(client, {
    instanceId: scope.instanceId,
    keycloakSubject: event.actorUserId,
    encryptedEmailCiphertext,
    encryptedDisplayNameCiphertext,
  });
  const writtenEventTypes: AuthAuditEventType[] = [];

  if (ensured.created) {
    await insertActivityLog(client, {
      eventType: 'account_created',
      instanceId: scope.instanceId,
      accountId: ensured.accountId,
      actorUserId: event.actorUserId,
      outcome: 'success',
      requestId: event.requestId,
      traceId: event.traceId,
    });
    writtenEventTypes.push('account_created');
  }

  return {
    accountId: ensured.accountId,
    writtenEventTypes,
  };
};

const writeScopedAuditEvent = async (
  client: AuditSqlClient,
  scope: RuntimeScopeRef,
  input: {
    eventType: AuthAuditEventType;
    accountId?: string;
    actorUserId?: string;
    outcome: AuthAuditEvent['outcome'];
    requestId?: string;
    traceId?: string;
  }
) => {
  if (scope.kind === 'platform') {
    await insertPlatformActivityLog(client, input);
    return;
  }

  await insertActivityLog(client, {
    ...input,
    instanceId: scope.instanceId,
  });
};

export const persistAuthAuditEventWithClient = async (
  client: AuditSqlClient,
  event: Required<Pick<AuthAuditEvent, 'workspaceId'>> & AuthAuditEvent & { scope?: RuntimeScopeRef }
): Promise<PersistAuthAuditResult> => {
  const scope =
    event.scope
    ?? getRuntimeScopeRef({ workspaceId: event.workspaceId });
  if (!scope) {
    return {
      persisted: false,
      reason: 'invalid_scope',
      writtenEventTypes: [],
    };
  }
  const { accountId, writtenEventTypes } = await resolveAuditAccountContext(client, scope, event);

  await writeScopedAuditEvent(client, scope, {
    eventType: event.eventType,
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

const resolveValidatedAuditScope = (
  event: Required<Pick<AuthAuditEvent, 'workspaceId'>> & AuthAuditEvent
): RuntimeScopeRef | PersistAuthAuditResult => {
  const scope =
    event.scope
    ?? getRuntimeScopeRef({ workspaceId: event.workspaceId });

  if (!scope) {
    return {
      persisted: false,
      reason: 'invalid_scope',
      writtenEventTypes: [],
    };
  }

  if (scope.kind === 'instance' && (!scope.instanceId || scope.instanceId.trim().length === 0)) {
    return {
      persisted: false,
      reason: 'invalid_instance_id',
      writtenEventTypes: [],
    };
  }

  return scope;
};

const withAuditTransaction = async <TResult>(
  client: PoolClient & AuditSqlClient,
  scope: RuntimeScopeRef,
  handler: () => Promise<TResult>
): Promise<TResult> => {
  try {
    await client.query('BEGIN');
    await assertIamAppRuntimeRole(client);
    await client.query(
      'SELECT set_config($1, $2, true);',
      ['app.instance_id', scope.kind === 'instance' ? scope.instanceId : '']
    );

    const result = await handler();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    const enrichedError = error instanceof Error ? error : new Error(String(error));
    (
      enrichedError as Error & {
        reasonCode?: PersistAuthAuditResult['reason'];
      }
    ).reasonCode = scope.kind === 'platform' ? 'platform_audit_unavailable' : 'tenant_audit_unavailable';
    throw enrichedError;
  }
};

export const persistAuthAuditEventToDb = async (
  event: Required<Pick<AuthAuditEvent, 'workspaceId'>> & AuthAuditEvent
): Promise<PersistAuthAuditResult> => {
  const resolvedScope = resolveValidatedAuditScope(event);
  if ('persisted' in resolvedScope) {
    return resolvedScope;
  }
  const scope = resolvedScope;

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
    return await withAuditTransaction(client, scope, () =>
      persistAuthAuditEventWithClient(client, {
        ...event,
        scope,
      })
    );
  } finally {
    client.release();
  }
};
