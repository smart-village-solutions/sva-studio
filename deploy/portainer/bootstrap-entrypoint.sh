#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  POSTGRES_DB
  POSTGRES_USER
  POSTGRES_PASSWORD
  APP_DB_PASSWORD
)

for key in "${required_vars[@]}"; do
  if [ -z "${!key:-}" ]; then
    echo "[bootstrap-entrypoint] missing required environment variable: ${key}" >&2
    exit 1
  fi
done

export POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export APP_DB_USER="${APP_DB_USER:-sva_app}"
export SVA_ALLOWED_INSTANCE_IDS="${SVA_ALLOWED_INSTANCE_IDS:-}"
export SVA_PARENT_DOMAIN="${SVA_PARENT_DOMAIN:-}"
export SVA_BOOTSTRAP_RECONCILE_APP_ROLE="${SVA_BOOTSTRAP_RECONCILE_APP_ROLE:-true}"
export SVA_BOOTSTRAP_ENABLE_SCHEMA_GUARD="${SVA_BOOTSTRAP_ENABLE_SCHEMA_GUARD:-true}"
export SVA_BOOTSTRAP_ENABLE_INSTANCE_RECONCILE="${SVA_BOOTSTRAP_ENABLE_INSTANCE_RECONCILE:-true}"
export SVA_BOOTSTRAP_ENABLE_HOSTNAME_GUARD="${SVA_BOOTSTRAP_ENABLE_HOSTNAME_GUARD:-true}"

tmp_sql="$(mktemp /tmp/sva-bootstrap.XXXXXX)"
cleanup() {
  rm -f "${tmp_sql}"
}
trap cleanup EXIT

node <<'NODE' >"${tmp_sql}"
const appDbPassword = process.env.APP_DB_PASSWORD?.trim() ?? '';
const appDbUser = process.env.APP_DB_USER?.trim() || 'sva_app';
const instanceIds = (process.env.SVA_ALLOWED_INSTANCE_IDS ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);
const parentDomain = process.env.SVA_PARENT_DOMAIN?.trim() ?? '';
const expectedHostnames = instanceIds.map((instanceId) => ({
  hostname: `${instanceId}.${parentDomain}`,
  instanceId,
}));

if (!appDbPassword) {
  throw new Error('APP_DB_PASSWORD fehlt fuer den Bootstrap-Job.');
}

const sqlLiteral = (value) => `'${String(value).replace(/'/gu, "''")}'`;
const sqlIdentifier = (value) => `"${String(value).replace(/"/gu, '""')}"`;

const roleStatements = [
  `DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(appDbUser)}) THEN
    EXECUTE format(
      'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
      ${sqlLiteral(appDbUser)},
      ${sqlLiteral(appDbPassword)}
    );
  ELSE
    EXECUTE format(
      'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
      ${sqlLiteral(appDbUser)},
      ${sqlLiteral(appDbPassword)}
    );
  END IF;
END
$bootstrap$;`,
  `GRANT iam_app TO ${sqlIdentifier(appDbUser)};`,
  `GRANT USAGE ON SCHEMA iam TO ${sqlIdentifier(appDbUser)};`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO ${sqlIdentifier(appDbUser)};`,
  `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO ${sqlIdentifier(appDbUser)};`,
];

const statements = [];
if ((process.env.SVA_BOOTSTRAP_RECONCILE_APP_ROLE ?? 'true').trim().toLowerCase() !== 'false') {
  statements.push(...roleStatements);
}

if ((process.env.SVA_BOOTSTRAP_ENABLE_SCHEMA_GUARD ?? 'true').trim().toLowerCase() !== 'false') {
  statements.push(`DO $schema_guard$
DECLARE
  failures text[];
BEGIN
  SELECT ARRAY_REMOVE(ARRAY[
    CASE WHEN checks.groups_exists THEN NULL ELSE 'groups_exists' END,
    CASE WHEN checks.group_roles_exists THEN NULL ELSE 'group_roles_exists' END,
    CASE WHEN checks.account_groups_exists THEN NULL ELSE 'account_groups_exists' END,
    CASE WHEN checks.activity_logs_exists THEN NULL ELSE 'activity_logs_exists' END,
    CASE WHEN checks.platform_activity_logs_exists THEN NULL ELSE 'platform_activity_logs_exists' END,
    CASE WHEN checks.accounts_instance_id_column_exists THEN NULL ELSE 'accounts_instance_id_column_exists' END,
    CASE WHEN checks.accounts_username_ciphertext_column_exists THEN NULL ELSE 'accounts_username_ciphertext_column_exists' END,
    CASE WHEN checks.accounts_avatar_url_column_exists THEN NULL ELSE 'accounts_avatar_url_column_exists' END,
    CASE WHEN checks.accounts_preferred_language_column_exists THEN NULL ELSE 'accounts_preferred_language_column_exists' END,
    CASE WHEN checks.accounts_timezone_column_exists THEN NULL ELSE 'accounts_timezone_column_exists' END,
    CASE WHEN checks.accounts_notes_column_exists THEN NULL ELSE 'accounts_notes_column_exists' END,
    CASE WHEN checks.account_groups_origin_column_exists THEN NULL ELSE 'account_groups_origin_column_exists' END,
    CASE WHEN checks.instance_hostnames_exists THEN NULL ELSE 'instance_hostnames_exists' END,
    CASE WHEN checks.instance_hostnames_rls_disabled THEN NULL ELSE 'instance_hostnames_rls_disabled' END,
    CASE WHEN checks.instances_primary_hostname_column_exists THEN NULL ELSE 'instances_primary_hostname_column_exists' END,
    CASE WHEN checks.instances_rls_disabled THEN NULL ELSE 'instances_rls_disabled' END,
    CASE WHEN checks.instances_auth_realm_column_exists THEN NULL ELSE 'instances_auth_realm_column_exists' END,
    CASE WHEN checks.instances_auth_client_id_column_exists THEN NULL ELSE 'instances_auth_client_id_column_exists' END,
    CASE WHEN checks.instances_auth_issuer_url_column_exists THEN NULL ELSE 'instances_auth_issuer_url_column_exists' END,
    CASE WHEN checks.instances_auth_client_secret_ciphertext_column_exists THEN NULL ELSE 'instances_auth_client_secret_ciphertext_column_exists' END,
    CASE WHEN checks.instances_tenant_admin_username_column_exists THEN NULL ELSE 'instances_tenant_admin_username_column_exists' END,
    CASE WHEN checks.instances_tenant_admin_email_column_exists THEN NULL ELSE 'instances_tenant_admin_email_column_exists' END,
    CASE WHEN checks.instances_tenant_admin_first_name_column_exists THEN NULL ELSE 'instances_tenant_admin_first_name_column_exists' END,
    CASE WHEN checks.instances_tenant_admin_last_name_column_exists THEN NULL ELSE 'instances_tenant_admin_last_name_column_exists' END,
    CASE WHEN checks.idx_accounts_kc_subject_instance_exists THEN NULL ELSE 'idx_accounts_kc_subject_instance_exists' END,
    CASE WHEN checks.accounts_isolation_policy_matches THEN NULL ELSE 'accounts_isolation_policy_matches' END,
    CASE WHEN checks.instance_memberships_isolation_policy_matches THEN NULL ELSE 'instance_memberships_isolation_policy_matches' END
  ], NULL)
  INTO failures
  FROM (
    SELECT
      to_regclass('iam.groups') IS NOT NULL AS groups_exists,
      to_regclass('iam.group_roles') IS NOT NULL AS group_roles_exists,
      to_regclass('iam.account_groups') IS NOT NULL AS account_groups_exists,
      to_regclass('iam.activity_logs') IS NOT NULL AS activity_logs_exists,
      to_regclass('iam.platform_activity_logs') IS NOT NULL AS platform_activity_logs_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'accounts' AND column_name = 'instance_id'
      ) AS accounts_instance_id_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'accounts' AND column_name = 'username_ciphertext'
      ) AS accounts_username_ciphertext_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'accounts' AND column_name = 'avatar_url'
      ) AS accounts_avatar_url_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'accounts' AND column_name = 'preferred_language'
      ) AS accounts_preferred_language_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'accounts' AND column_name = 'timezone'
      ) AS accounts_timezone_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'accounts' AND column_name = 'notes'
      ) AS accounts_notes_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'account_groups' AND column_name = 'origin'
      ) AS account_groups_origin_column_exists,
      to_regclass('iam.instance_hostnames') IS NOT NULL AS instance_hostnames_exists,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'iam'
          AND c.relname = 'instance_hostnames'
          AND c.relrowsecurity = false
          AND c.relforcerowsecurity = false
      ) AS instance_hostnames_rls_disabled,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'instances' AND column_name = 'primary_hostname'
      ) AS instances_primary_hostname_column_exists,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'iam'
          AND c.relname = 'instances'
          AND c.relrowsecurity = false
          AND c.relforcerowsecurity = false
      ) AS instances_rls_disabled,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'instances' AND column_name = 'auth_realm'
      ) AS instances_auth_realm_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'instances' AND column_name = 'auth_client_id'
      ) AS instances_auth_client_id_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'instances' AND column_name = 'auth_issuer_url'
      ) AS instances_auth_issuer_url_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'instances' AND column_name = 'auth_client_secret_ciphertext'
      ) AS instances_auth_client_secret_ciphertext_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'instances' AND column_name = 'tenant_admin_username'
      ) AS instances_tenant_admin_username_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'instances' AND column_name = 'tenant_admin_email'
      ) AS instances_tenant_admin_email_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'instances' AND column_name = 'tenant_admin_first_name'
      ) AS instances_tenant_admin_first_name_column_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'iam' AND table_name = 'instances' AND column_name = 'tenant_admin_last_name'
      ) AS instances_tenant_admin_last_name_column_exists,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'iam' AND tablename = 'accounts' AND indexname = 'idx_accounts_kc_subject_instance'
      ) AS idx_accounts_kc_subject_instance_exists,
      EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'iam'
          AND tablename = 'accounts'
          AND policyname = 'accounts_isolation_policy'
          AND COALESCE(qual, '') LIKE '%instance_id = iam.current_instance_id()%'
          AND COALESCE(with_check, '') LIKE '%instance_id = iam.current_instance_id()%'
      ) AS accounts_isolation_policy_matches,
      EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'iam'
          AND tablename = 'instance_memberships'
          AND policyname = 'instance_memberships_isolation_policy'
          AND COALESCE(qual, '') LIKE '%instance_id = iam.current_instance_id()%'
          AND COALESCE(with_check, '') LIKE '%instance_id = iam.current_instance_id()%'
      ) AS instance_memberships_isolation_policy_matches
  ) checks;

  IF COALESCE(array_length(failures, 1), 0) > 0 THEN
    RAISE EXCEPTION 'schema_guard_failed:%', array_to_string(failures, ',');
  END IF;
END
$schema_guard$;`);
}

if (
  (process.env.SVA_BOOTSTRAP_ENABLE_INSTANCE_RECONCILE ?? 'true').trim().toLowerCase() !== 'false' &&
  instanceIds.length > 0 &&
  parentDomain.length > 0
) {
  const instanceRows = instanceIds
    .map(
      (instanceId) =>
        `(${sqlLiteral(instanceId)}, ${sqlLiteral(instanceId)}, 'active', ${sqlLiteral(parentDomain)}, ${sqlLiteral(`${instanceId}.${parentDomain}`)}, ${sqlLiteral(instanceId)}, ${sqlLiteral('sva-studio')})`,
    )
    .join(',\n');
  const hostnameRows = instanceIds
    .map(
      (instanceId) =>
        `(${sqlLiteral(`${instanceId}.${parentDomain}`)}, ${sqlLiteral(instanceId)}, true, 'runtime-bootstrap')`,
    )
    .join(',\n');
  const instanceIdList = instanceIds.map((instanceId) => sqlLiteral(instanceId)).join(', ');
  const primaryHostnameList = expectedHostnames.map(({ hostname }) => sqlLiteral(hostname)).join(', ');

  statements.push(
    `INSERT INTO iam.instances (id, display_name, status, parent_domain, primary_hostname, auth_realm, auth_client_id)
VALUES
${instanceRows}
ON CONFLICT (id) DO UPDATE
SET
  status = EXCLUDED.status,
  parent_domain = EXCLUDED.parent_domain,
  primary_hostname = EXCLUDED.primary_hostname,
  auth_realm = EXCLUDED.auth_realm,
  auth_client_id = EXCLUDED.auth_client_id,
  updated_at = NOW();`,
  );
  statements.push(
    `UPDATE iam.instance_hostnames
SET
  is_primary = false
WHERE instance_id IN (${instanceIdList})
  AND is_primary = true
  AND hostname NOT IN (${primaryHostnameList});`,
  );
  statements.push(
    `INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
VALUES
${hostnameRows}
ON CONFLICT (hostname) DO UPDATE
SET
  instance_id = EXCLUDED.instance_id,
  is_primary = EXCLUDED.is_primary;`,
  );
  if ((process.env.SVA_BOOTSTRAP_ENABLE_HOSTNAME_GUARD ?? 'true').trim().toLowerCase() !== 'false') {
    statements.push(
      `DO $hostname_guard$
DECLARE
  missing_hostnames text[];
BEGIN
  SELECT COALESCE(
    ARRAY(
      SELECT expected.hostname
      FROM (
        VALUES ${expectedHostnames
          .map(({ hostname, instanceId }) => `(${sqlLiteral(hostname)}, ${sqlLiteral(instanceId)})`)
          .join(',\n        ')}
      ) AS expected(hostname, instance_id)
      LEFT JOIN (
        SELECT hostname.hostname, instance.id AS instance_id
        FROM iam.instance_hostnames hostname
        JOIN iam.instances instance
          ON instance.id = hostname.instance_id
        WHERE hostname.is_primary = true
      ) actual
        ON actual.hostname = expected.hostname
       AND actual.instance_id = expected.instance_id
      WHERE actual.instance_id IS NULL
      ORDER BY expected.hostname
    ),
    ARRAY[]::text[]
  )
  INTO missing_hostnames;

  IF COALESCE(array_length(missing_hostnames, 1), 0) > 0 THEN
    RAISE EXCEPTION 'instance_hostname_missing:%', array_to_string(missing_hostnames, ',');
  END IF;
END
$hostname_guard$;`,
    );
  }
}

process.stdout.write(`${statements.join('\n\n')}\n`);
NODE

echo "[bootstrap-entrypoint] running bootstrap SQL against ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -X \
  -v ON_ERROR_STOP=1 \
  -P pager=off \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -f "${tmp_sql}"

echo "[bootstrap-entrypoint] bootstrap completed"
