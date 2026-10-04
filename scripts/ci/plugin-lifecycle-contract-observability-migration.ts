import { migrationEnvironment, run } from './plugin-lifecycle-contract-database.js';
import { assert, scalar } from './plugin-lifecycle-contract-base.js';
import type { MatrixContext } from './plugin-lifecycle-contract-runtime.js';
import { reportCase } from './plugin-lifecycle-contract-worker.js';

export const runObservabilityMigration = async (context: MatrixContext): Promise<void> => {
  const { adminPool, port } = context;
  await reportCase('OBS-01-positive-migration-down-up-cleanup', async () => {
    const observabilityRoleOid = await scalar(
      adminPool,
      "SELECT oid::text AS value FROM pg_roles WHERE rolname = 'iam_observability'"
    );
    assert(observabilityRoleOid, 'obs01_definer_role_oid_available_before_down');

    try {
      run(
        'bash',
        ['packages/data/scripts/run-migrations.sh', 'down-to', '90'],
        migrationEnvironment(port)
      );
      assert(
        (await scalar(
          adminPool,
          "SELECT (to_regprocedure('iam.plugin_tenant_lifecycle_observability_snapshot()') IS NULL)::text AS value"
        )) === 'true',
        'obs01_down_removes_function'
      );
      assert(
        (await scalar(
          adminPool,
          "SELECT (NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iam_observability'))::text AS value"
        )) === 'true',
        'obs01_down_removes_definer_role'
      );
      assert(
        (await scalar(
          adminPool,
          `SELECT (count(*) = 0)::text AS value
           FROM pg_policies
           WHERE schemaname = 'iam'
             AND policyname IN (
               'instance_plugin_lifecycle_observability_policy',
               'studio_jobs_observability_policy'
             )`
        )) === 'true',
        'obs01_down_removes_select_policies'
      );
      assert(
        (await scalar(
          adminPool,
          `SELECT (count(*) = 0)::text AS value
           FROM pg_attribute AS attribute
           JOIN pg_class AS relation ON relation.oid = attribute.attrelid
           JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           CROSS JOIN LATERAL aclexplode(attribute.attacl) AS privilege
           WHERE namespace.nspname = 'iam'
             AND relation.relname IN ('instance_plugin_lifecycle', 'studio_jobs')
             AND privilege.grantee = $1::oid`,
          [observabilityRoleOid]
        )) === 'true',
        'obs01_down_removes_column_acl'
      );
      await adminPool.query('CREATE ROLE iam_observability NOLOGIN NOSUPERUSER NOBYPASSRLS');
      let conflictingRoleRejected = false;
      try {
        run(
          'bash',
          ['packages/data/scripts/run-migrations.sh', 'up-to', '91'],
          migrationEnvironment(port)
        );
      } catch {
        conflictingRoleRejected = true;
      }
      assert(conflictingRoleRejected, 'obs01_up_rejects_preexisting_definer_role');
      assert(
        (await scalar(
          adminPool,
          'SELECT (max(version_id) = 90)::text AS value FROM public.goose_db_version WHERE is_applied'
        )) === 'true',
        'obs01_role_conflict_rolls_back_migration'
      );
    } finally {
      run(
        'bash',
        ['packages/data/scripts/run-migrations.sh', 'down-to', '90'],
        migrationEnvironment(port)
      );
      await adminPool.query('DROP ROLE IF EXISTS iam_observability');
      run(
        'bash',
        ['packages/data/scripts/run-migrations.sh', 'up-to', '91'],
        migrationEnvironment(port)
      );
    }

    assert(
      (await scalar(
        adminPool,
        `SELECT (
           to_regprocedure('iam.plugin_tenant_lifecycle_observability_snapshot()') IS NOT NULL
           AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iam_observability')
           AND NOT EXISTS (
             SELECT 1
             FROM pg_auth_members
             WHERE roleid = (SELECT oid FROM pg_roles WHERE rolname = 'iam_observability')
           )
           AND (
             SELECT count(*) = 2
             FROM pg_policies
             WHERE schemaname = 'iam'
               AND policyname IN (
                 'instance_plugin_lifecycle_observability_policy',
                 'studio_jobs_observability_policy'
               )
           )
         )::text AS value`
      )) === 'true',
      'obs01_up_reinstalls_function_role_and_policies'
    );
  });
};
