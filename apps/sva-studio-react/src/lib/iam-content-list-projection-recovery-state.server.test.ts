import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentCredentialRecovery } from './iam-api-content-types';
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock('@sva/auth-runtime/server', () => ({ withInstanceScopedDb: mocks.db }));
vi.mock('./iam-content-list-projection-repository-schema.server.js', () => ({
  buildMainserverSyncScopeKey: () => 'scope',
  buildProjectionTargetKey: () => 'scope',
  buildRefreshDeletionScopeKeys: () => [],
  loadProjectionSyncStateSchemaMode: async () => 'scoped',
  loadProjectionTableSchemaMode: async () => 'scoped',
  withProjectionSchemaModeRetry: async (
    _target: unknown,
    _mode: unknown,
    work: () => Promise<unknown>
  ) => work(),
}));
import {
  claimProjectionCredentialRecovery,
  finishProjectionCredentialRecovery,
  markProjectionSyncFailed,
} from './iam-content-list-projection-repository-sync-state.server';

const url = process.env.IAM_CREDENTIAL_RECOVERY_TEST_DATABASE_URL;
const pool = url ? new Pool({ connectionString: url, max: 3 }) : null;
const schema = `projection_recovery_${randomUUID().replaceAll('-', '')}`;
const target = {
  instanceId: 'tenant',
  contentType: 'news.article' as const,
  keycloakSubject: 'subject',
  actorAccountId: 'actor',
};
const runId = randomUUID();
const failureTime = '2026-10-20T10:00:00Z';
const checking: ContentCredentialRecovery = {
  instanceId: 'tenant',
  contentType: 'news.article',
  source: 'unknown',
  outcome: 'checking',
  reasonCode: 'checking',
  occurredAt: failureTime,
  requestId: 'recovery-request',
};
const db = () => {
  if (!pool) throw new Error('local test database missing');
  return pool;
};
const execute = (sql: string, params: readonly unknown[] = []) =>
  db().query(sql.replaceAll('iam.', `${schema}.`), [...params]);

describe.skipIf(!url)('durable recovery reservation against PostgreSQL', () => {
  beforeAll(async () => {
    await db().query(`CREATE SCHEMA ${schema}`);
    const snapshot = readFileSync(
      resolve(process.cwd(), '../../docs/development/studio-db-schema-final.sql'),
      'utf8'
    );
    const beginning = snapshot.indexOf('CREATE TABLE iam.content_list_projection_sync_state (');
    await execute(snapshot.slice(beginning, snapshot.indexOf('\n);', beginning) + 3));
    mocks.db.mockImplementation(async (_instance, work) => {
      const client = await db().connect();
      try {
        await client.query('BEGIN');
        const result = await work({
          query: (sql: string, values?: readonly unknown[]) =>
            client.query(sql.replaceAll('iam.', `${schema}.`), values ? [...values] : []),
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
  });
  beforeEach(async () => {
    await execute('TRUNCATE iam.content_list_projection_sync_state');
    await execute(
      `INSERT INTO iam.content_list_projection_sync_state (instance_id, source_system, content_type, sync_scope_key, last_failed_at, last_error_code, last_error_message, refresh_run_id)
VALUES ('tenant', 'mainserver', 'news.article', 'scope', $1::timestamptz, 'mainserver_credentials_missing', 'ordinary readiness error', $2::uuid)`,
      [failureTime, runId]
    );
  });
  afterAll(async () => {
    if (pool) {
      await db().query(`DROP SCHEMA ${schema} CASCADE`);
      await db().end();
    }
  });

  it('reserves the initial automatic attempt exactly once across concurrent processes', async () => {
    const result = await Promise.all([
      claimProjectionCredentialRecovery(target, failureTime, checking, false),
      claimProjectionCredentialRecovery(
        target,
        failureTime,
        { ...checking, requestId: 'other-request' },
        false
      ),
    ]);
    expect(result.sort()).toEqual([false, true]);
    expect(await claimProjectionCredentialRecovery(target, failureTime, checking, false)).toBe(
      false
    );
  });

  it('keeps the durable diagnostic marker after subsequent scheduler failures', async () => {
    expect(await claimProjectionCredentialRecovery(target, failureTime, checking, false)).toBe(
      true
    );
    const complete = {
      ...checking,
      source: 'user' as const,
      outcome: 'not_possible' as const,
      reasonCode: 'personal_credentials_missing',
    };
    await finishProjectionCredentialRecovery(target, complete, checking);
    await markProjectionSyncFailed(
      target,
      runId,
      'mainserver_credentials_missing',
      'later readiness error'
    );
    const row = (
      await execute(
        'SELECT last_failed_at::text, last_error_message FROM iam.content_list_projection_sync_state'
      )
    ).rows[0];
    expect(JSON.parse(row.last_error_message)).toEqual({ credentialRecovery: complete });
    expect(
      await claimProjectionCredentialRecovery(target, row.last_failed_at, checking, false)
    ).toBe(false);
    expect(
      await claimProjectionCredentialRecovery(target, row.last_failed_at, checking, true)
    ).toBe(true);
  });

  it('rejects a stale observed failure and cannot finish a newer attempt', async () => {
    expect(
      await claimProjectionCredentialRecovery(target, '2026-10-19T10:00:00Z', checking, false)
    ).toBe(false);
    await claimProjectionCredentialRecovery(target, failureTime, checking, false);
    const newer = { ...checking, requestId: 'newer-request' };
    await claimProjectionCredentialRecovery(target, failureTime, newer, true);
    await finishProjectionCredentialRecovery(target, { ...checking, outcome: 'failed' }, checking);
    expect(
      JSON.parse(
        (await execute('SELECT last_error_message FROM iam.content_list_projection_sync_state'))
          .rows[0].last_error_message
      )
    ).toEqual({ credentialRecovery: newer });
  });

  it('does not reserve a recovery while a newer refresh is running in another process', async () => {
    await execute(
      "UPDATE iam.content_list_projection_sync_state SET last_started_at = '2026-10-20T10:01:00Z'"
    );
    expect(await claimProjectionCredentialRecovery(target, failureTime, checking, false)).toBe(
      false
    );
  });

  it('does not evaluate normal provider text as JSON while completing an unrelated attempt', async () => {
    await finishProjectionCredentialRecovery(target, { ...checking, outcome: 'failed' }, checking);
    expect(
      (await execute('SELECT last_error_message FROM iam.content_list_projection_sync_state'))
        .rows[0].last_error_message
    ).toBe('ordinary readiness error');
  });
});
