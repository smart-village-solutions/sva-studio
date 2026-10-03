import { Pool, type PoolClient } from 'pg';

import type { AuthAuditEvent, AuthAuditEventType } from './audit-events.types.js';
import { resolveAuditAccountContext } from './audit-account-context.js';
import { writeScopedAuditEvent } from './audit-event-writes.js';
import { getIamDatabaseUrl } from './runtime-secrets.js';
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
    throw new Error(
      'Unsafe runtime role for audit sink: current role must not be SUPERUSER or BYPASSRLS.'
    );
  }
};

export const persistAuthAuditEventWithClient = async (
  client: AuditSqlClient,
  event: Required<Pick<AuthAuditEvent, 'workspaceId'>> &
    AuthAuditEvent & { scope?: RuntimeScopeRef }
): Promise<PersistAuthAuditResult> => {
  const scope = event.scope ?? getRuntimeScopeRef({ workspaceId: event.workspaceId });
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
    pluginAction: event.pluginAction,
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
  const scope = event.scope ?? getRuntimeScopeRef({ workspaceId: event.workspaceId });

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
    await client.query('SELECT set_config($1, $2, true);', [
      'app.instance_id',
      scope.kind === 'instance' ? scope.instanceId : '',
    ]);

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
    ).reasonCode =
      scope.kind === 'platform' ? 'platform_audit_unavailable' : 'tenant_audit_unavailable';
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
