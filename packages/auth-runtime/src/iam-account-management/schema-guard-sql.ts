export const GRAPHILE_WORKER_READINESS_SQL = `
WITH principals AS (
  SELECT to_regrole($1) AS app_role_oid,
    to_regrole($2) AS app_login_oid,
    to_regrole($3) AS worker_role_oid
), graphile_objects AS (
  SELECT
    (
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'graphile_worker'
        AND p.proname = 'sva_enqueue_job'
        AND oidvectortypes(p.proargtypes) =
          'text, json, text, integer, text, timestamp with time zone'
    ) AS enqueue_function_oid,
    (
      SELECT c.oid
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'graphile_worker'
        AND c.relname = '_private_jobs'
        AND c.relkind IN ('r', 'p')
    ) AS jobs_table_oid
)
SELECT
  to_regnamespace('graphile_worker') IS NOT NULL AS graphile_schema_exists,
  principals.app_role_oid IS NOT NULL AS effective_app_role_exists,
  principals.worker_role_oid IS NOT NULL AS worker_role_exists,
  COALESCE(has_function_privilege(
    principals.app_role_oid,
    graphile_objects.enqueue_function_oid,
    'EXECUTE'
  ), false)
    AND COALESCE(has_schema_privilege(principals.app_role_oid, 'graphile_worker', 'USAGE'), false)
    AS effective_app_can_enqueue,
  NOT COALESCE(has_table_privilege(
    principals.app_role_oid,
    graphile_objects.jobs_table_oid,
    'SELECT,INSERT,UPDATE,DELETE'
  ), false) AS effective_app_cannot_process,
  NOT COALESCE(has_schema_privilege(principals.app_login_oid, 'graphile_worker', 'USAGE'), false)
    AND NOT COALESCE(has_function_privilege(
      principals.app_login_oid,
      graphile_objects.enqueue_function_oid,
      'EXECUTE'
    ), false) AS app_login_cannot_enqueue_directly,
  NOT has_database_privilege(principals.app_role_oid, current_database(), 'CREATE')
    AND NOT has_schema_privilege(principals.app_role_oid, 'public', 'CREATE') AS app_cannot_create,
  COALESCE(has_table_privilege(
    principals.worker_role_oid,
    graphile_objects.jobs_table_oid,
    'SELECT,INSERT,UPDATE,DELETE'
  ), false)
    AND COALESCE(
      has_schema_privilege(principals.worker_role_oid, 'graphile_worker', 'USAGE'),
      false
    ) AS worker_can_process,
  principals.worker_role_oid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'graphile_worker'
      AND NOT has_function_privilege(principals.worker_role_oid, p.oid, 'EXECUTE')
  ) AS worker_functions_complete,
  principals.worker_role_oid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_class sequence
    JOIN pg_namespace n ON n.oid = sequence.relnamespace
    WHERE n.nspname = 'graphile_worker'
      AND sequence.relkind = 'S'
      AND NOT has_sequence_privilege(
        principals.worker_role_oid,
        sequence.oid,
        'USAGE,SELECT,UPDATE'
      )
  ) AS worker_sequences_complete,
  principals.worker_role_oid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'graphile_worker'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity = true
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies policy
        WHERE policy.schemaname = 'graphile_worker'
          AND policy.tablename = c.relname
          AND policy.policyname = 'sva_job_worker_access'
          AND $3 = ANY(policy.roles)
          AND COALESCE(policy.qual, '') IN ('true', '(true)')
          AND COALESCE(policy.with_check, '') IN ('true', '(true)')
      )
  ) AS worker_policies_complete
FROM principals
CROSS JOIN graphile_objects;
`;

export const GRAPHILE_WORKER_READINESS_FIELDS = [
  'graphile_schema_exists',
  'worker_role_exists',
  'effective_app_role_exists',
  'effective_app_can_enqueue',
  'effective_app_cannot_process',
  'app_login_cannot_enqueue_directly',
  'app_cannot_create',
  'worker_can_process',
  'worker_functions_complete',
  'worker_sequences_complete',
  'worker_policies_complete',
] as const;

export const CRITICAL_IAM_SCHEMA_GUARD_SQL = `
SELECT
  to_regclass('iam.groups') IS NOT NULL AS groups_exists,
  to_regclass('iam.group_roles') IS NOT NULL AS group_roles_exists,
  to_regclass('iam.account_groups') IS NOT NULL AS account_groups_exists,
  to_regclass('iam.activity_logs') IS NOT NULL AS activity_logs_exists,
  to_regclass('iam.platform_activity_logs') IS NOT NULL AS platform_activity_logs_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'accounts'
      AND column_name = 'instance_id'
  ) AS accounts_instance_id_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'accounts'
      AND column_name = 'username_ciphertext'
  ) AS accounts_username_ciphertext_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'accounts'
      AND column_name = 'avatar_url'
  ) AS accounts_avatar_url_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'accounts'
      AND column_name = 'preferred_language'
  ) AS accounts_preferred_language_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'accounts'
      AND column_name = 'timezone'
  ) AS accounts_timezone_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'accounts'
      AND column_name = 'notes'
  ) AS accounts_notes_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'account_groups'
      AND column_name = 'origin'
  ) AS account_groups_origin_column_exists,
  to_regclass('iam.instance_hostnames') IS NOT NULL AS instance_hostnames_exists,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n
      ON n.oid = c.relnamespace
    WHERE n.nspname = 'iam'
      AND c.relname = 'instance_hostnames'
      AND c.relrowsecurity = false
      AND c.relforcerowsecurity = false
  ) AS instance_hostnames_rls_disabled,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'primary_hostname'
  ) AS instances_primary_hostname_column_exists,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n
      ON n.oid = c.relnamespace
    WHERE n.nspname = 'iam'
      AND c.relname = 'instances'
      AND c.relrowsecurity = false
      AND c.relforcerowsecurity = false
  ) AS instances_rls_disabled,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'auth_realm'
  ) AS instances_auth_realm_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'auth_client_id'
  ) AS instances_auth_client_id_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'auth_issuer_url'
  ) AS instances_auth_issuer_url_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'auth_client_secret_ciphertext'
  ) AS instances_auth_client_secret_ciphertext_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'tenant_admin_client_id'
  ) AS instances_tenant_admin_client_id_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'tenant_admin_client_secret_ciphertext'
  ) AS instances_tenant_admin_client_secret_ciphertext_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'tenant_admin_username'
  ) AS instances_tenant_admin_username_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'tenant_admin_email'
  ) AS instances_tenant_admin_email_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'tenant_admin_first_name'
  ) AS instances_tenant_admin_first_name_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'tenant_admin_last_name'
  ) AS instances_tenant_admin_last_name_column_exists,
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'iam'
      AND tablename = 'accounts'
      AND indexname = 'idx_accounts_kc_subject_instance'
  ) AS idx_accounts_kc_subject_instance_exists,
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'iam'
      AND tablename = 'accounts'
      AND policyname = 'accounts_isolation_policy'
      AND COALESCE(qual, '') LIKE '%instance_id = iam.current_instance_id()%'
      AND COALESCE(with_check, '') LIKE '%instance_id = iam.current_instance_id()%'
  ) AS accounts_isolation_policy_matches,
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'iam'
      AND tablename = 'instance_memberships'
      AND policyname = 'instance_memberships_isolation_policy'
      AND COALESCE(qual, '') LIKE '%instance_id = iam.current_instance_id()%'
      AND COALESCE(with_check, '') LIKE '%instance_id = iam.current_instance_id()%'
  ) AS instance_memberships_isolation_policy_matches;
`;
