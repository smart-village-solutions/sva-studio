import { Pool } from './plugin-lifecycle-contract-database.js';
import {
  appPassword,
  assert,
  database,
  instanceId,
  observabilityOtherInstanceId,
  scalar,
} from './plugin-lifecycle-contract-base.js';
import { configureObservabilityFixture } from './plugin-lifecycle-contract-fixture.js';
import type { MatrixContext } from './plugin-lifecycle-contract-runtime.js';
import { reportCase } from './plugin-lifecycle-contract-worker.js';

const runObservabilityPart1 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, port } = context;
  await reportCase('OBS-01-positive-aggregated-snapshot-through-app-role', async () => {
    await configureObservabilityFixture(adminPool);
    const appPool = new Pool({
      connectionString: `postgres://sva_app:${appPassword}@127.0.0.1:${port}/${database}`,
      max: 1,
      idleTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 10_000,
    });
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE iam_app');
      await client.query('SELECT set_config($1, $2, true)', ['app.instance_id', instanceId]);
      const directTenantRows = await scalar(
        client,
        'SELECT count(*)::text AS value FROM iam.instance_plugin_lifecycle'
      );
      const directForeignRows = await scalar(
        client,
        'SELECT count(*)::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1',
        [observabilityOtherInstanceId]
      );
      const snapshot = await client.query<{ reason_code: string; stall_count: string }>(
        'SELECT reason_code, stall_count::text FROM iam.plugin_tenant_lifecycle_observability_snapshot() ORDER BY reason_code'
      );
      await client.query('COMMIT');

      assert(directTenantRows === '5', 'obs01_direct_current_tenant_only');
      assert(directForeignRows === '0', 'obs01_direct_foreign_tenant_hidden');
      assert(snapshot.rows.length === 5, 'obs01_exact_bounded_rows');
      const counts = new Map(snapshot.rows.map((row) => [row.reason_code, row.stall_count]));
      assert(counts.get('stale_claim') === '1', 'obs01_stale_claim');
      assert(counts.get('queued_due') === '1', 'obs01_queued_due_across_tenants');
      assert(counts.get('retry_due') === '1', 'obs01_retry_due');
      assert(counts.get('pending_recheck_due') === '1', 'obs01_pending_recheck_due');
      assert(counts.get('generation_without_owner') === '2', 'obs01_generation_without_owner');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release?.();
      await appPool.end();
    }

    assert(
      (await scalar(
        adminPool,
        `SELECT (
           NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
           AND NOT EXISTS (
             SELECT 1
             FROM pg_auth_members
             WHERE roleid = pg_roles.oid
           )
         )::text AS value
         FROM pg_roles
         WHERE rolname = 'iam_observability'`
      )) === 'true',
      'obs01_definer_role_hardened'
    );
    assert(
      (await scalar(
        adminPool,
        `SELECT (
           has_any_column_privilege('iam_observability', 'iam.instance_plugin_lifecycle', 'SELECT')
           AND has_any_column_privilege('iam_observability', 'iam.studio_jobs', 'SELECT')
           AND ARRAY(
             SELECT column_name::text
             FROM information_schema.column_privileges
             WHERE grantee = 'iam_observability'
               AND table_schema = 'iam'
               AND table_name = 'instance_plugin_lifecycle'
               AND privilege_type = 'SELECT'
             ORDER BY column_name
           ) = ARRAY[
             'active_job_id', 'completed_generation', 'desired_generation',
             'next_recheck_at', 'readiness_status', 'retry_after', 'retry_kind',
             'started_at', 'updated_at'
           ]
           AND ARRAY(
             SELECT column_name::text
             FROM information_schema.column_privileges
             WHERE grantee = 'iam_observability'
               AND table_schema = 'iam'
               AND table_name = 'studio_jobs'
               AND privilege_type = 'SELECT'
             ORDER BY column_name
           ) = ARRAY['heartbeat_at', 'id', 'scheduled_at', 'started_at', 'status']
           AND NOT has_table_privilege('iam_observability', 'iam.instance_plugin_lifecycle', 'INSERT,UPDATE,DELETE')
           AND NOT has_table_privilege('iam_observability', 'iam.studio_jobs', 'INSERT,UPDATE,DELETE')
           AND NOT has_schema_privilege('iam_observability', 'iam', 'CREATE')
         )::text AS value`
      )) === 'true',
      'obs01_definer_read_only'
    );
    assert(
      (await scalar(
        adminPool,
        `SELECT (
           count(*) = 2
           AND bool_and(cmd = 'SELECT')
           AND bool_and(roles = ARRAY['iam_observability']::name[])
         )::text AS value
         FROM pg_policies
         WHERE schemaname = 'iam'
           AND policyname IN (
             'instance_plugin_lifecycle_observability_policy',
             'studio_jobs_observability_policy'
           )`
      )) === 'true',
      'obs01_select_policies_are_role_specific'
    );
  });
};

const runObservabilityPart2 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, port } = context;
  await reportCase('OBS-01-negative-no-raw-or-public-observability-access', async () => {
    assert(
      (await scalar(
        adminPool,
        `SELECT (count(*) = 0)::text AS value
         FROM pg_proc procedure
         JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
         CROSS JOIN LATERAL aclexplode(
           coalesce(procedure.proacl, acldefault('f', procedure.proowner))
         ) privilege
         WHERE namespace.nspname = 'iam'
           AND procedure.proname = 'plugin_tenant_lifecycle_observability_snapshot'
           AND privilege.grantee = 0
           AND privilege.privilege_type = 'EXECUTE'`
      )) === 'true',
      'obs01_public_execute_revoked'
    );
    assert(
      (await scalar(
        adminPool,
        `SELECT (
           pg_get_userbyid(proowner) = 'iam_observability'
           AND proretset
           AND proargtypes = ''::oidvector
         )::text AS value
         FROM pg_proc procedure
         JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
         WHERE namespace.nspname = 'iam'
           AND procedure.proname = 'plugin_tenant_lifecycle_observability_snapshot'`
      )) === 'true',
      'obs01_parameterless_owned_function'
    );

    const appPool = new Pool({
      connectionString: `postgres://sva_app:${appPassword}@127.0.0.1:${port}/${database}`,
      max: 1,
      idleTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 10_000,
    });
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE iam_app');
      let setRoleDenied = false;
      await client.query('SAVEPOINT observability_role_probe');
      try {
        await client.query('SET LOCAL ROLE iam_observability');
      } catch {
        setRoleDenied = true;
        await client.query('ROLLBACK TO SAVEPOINT observability_role_probe');
      }
      await client.query('ROLLBACK');
      assert(setRoleDenied, 'obs01_app_cannot_assume_definer_role');
    } finally {
      client.release?.();
      await appPool.end();
    }
  });
};

export const runObservability = async (context: MatrixContext): Promise<void> => {
  await runObservabilityPart1(context);
  await runObservabilityPart2(context);
};
