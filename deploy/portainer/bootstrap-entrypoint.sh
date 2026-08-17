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
export SVA_BOOTSTRAP_TENANT_ADMIN_CLIENT_ID="${SVA_BOOTSTRAP_TENANT_ADMIN_CLIENT_ID:-sva-studio-admin}"

tmp_sql="$(mktemp /tmp/sva-bootstrap.XXXXXX)"
cleanup() {
  rm -f "${tmp_sql}"
}
trap cleanup EXIT

node --input-type=module <<'NODE' >"${tmp_sql}"
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const resolveWorkspacePackage = (packageName) => {
  const packagePath = packageName.replace('@sva/', '');
  const candidates = [
    resolve('node_modules/@sva', packagePath, 'dist/index.js'),
    resolve('apps/sva-studio-react/node_modules/@sva', packagePath, 'dist/index.js'),
  ];
  const entrypoint = candidates.find((candidate) => existsSync(candidate));
  if (!entrypoint) {
    throw new Error(`Bootstrap-Package nicht gefunden: ${packageName}`);
  }
  return import(pathToFileURL(entrypoint).href);
};

const [{ resolvesSystemAdminGrant }, { studioPermissionCatalog }] = await Promise.all([
  resolveWorkspacePackage('@sva/core'),
  resolveWorkspacePackage('@sva/studio-module-iam'),
]);

const appDbPassword = process.env.APP_DB_PASSWORD?.trim() ?? '';
const appDbUser = process.env.APP_DB_USER?.trim() || 'sva_app';
const instanceIds = (process.env.SVA_ALLOWED_INSTANCE_IDS ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);
const parentDomain = process.env.SVA_PARENT_DOMAIN?.trim() ?? '';
const tenantAdminClientId = process.env.SVA_BOOTSTRAP_TENANT_ADMIN_CLIENT_ID?.trim() || 'sva-studio-admin';
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
  `GRANT CONNECT ON DATABASE ${sqlIdentifier(process.env.POSTGRES_DB?.trim() || 'sva_studio')} TO ${sqlIdentifier(appDbUser)};`,
  `GRANT CREATE ON DATABASE ${sqlIdentifier(process.env.POSTGRES_DB?.trim() || 'sva_studio')} TO ${sqlIdentifier(appDbUser)};`,
  `GRANT USAGE, CREATE ON SCHEMA public TO ${sqlIdentifier(appDbUser)};`,
  `GRANT SELECT (version_id, is_applied) ON TABLE public.goose_db_version TO ${sqlIdentifier(appDbUser)};`,
  `GRANT USAGE ON SCHEMA iam TO ${sqlIdentifier(appDbUser)};`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO ${sqlIdentifier(appDbUser)};`,
  `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO ${sqlIdentifier(appDbUser)};`,
];

const statements = [];
if ((process.env.SVA_BOOTSTRAP_RECONCILE_APP_ROLE ?? 'true').trim().toLowerCase() !== 'false') {
  statements.push(...roleStatements);
}


if (
  (process.env.SVA_BOOTSTRAP_ENABLE_INSTANCE_RECONCILE ?? 'true').trim().toLowerCase() !== 'false' &&
  instanceIds.length > 0 &&
  parentDomain.length > 0
) {
  const instanceRows = instanceIds
    .map(
      (instanceId) =>
        `(${sqlLiteral(instanceId)}, ${sqlLiteral(instanceId)}, 'active', ${sqlLiteral(parentDomain)}, ${sqlLiteral(`${instanceId}.${parentDomain}`)}, ${sqlLiteral(instanceId)}, ${sqlLiteral('sva-studio')}, ${sqlLiteral(tenantAdminClientId)})`,
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
    `INSERT INTO iam.instances (id, display_name, status, parent_domain, primary_hostname, auth_realm, auth_client_id, tenant_admin_client_id)
VALUES
${instanceRows}
ON CONFLICT (id) DO UPDATE
SET
  status = EXCLUDED.status,
  parent_domain = EXCLUDED.parent_domain,
  primary_hostname = EXCLUDED.primary_hostname,
  auth_realm = EXCLUDED.auth_realm,
  auth_client_id = EXCLUDED.auth_client_id,
  tenant_admin_client_id = COALESCE(NULLIF(iam.instances.tenant_admin_client_id, ''), EXCLUDED.tenant_admin_client_id),
  updated_at = NOW();`,
  );
  const activePermissionCatalog = studioPermissionCatalog.filter(
    (definition) => definition.availability.kind !== 'root' && definition.lifecycle !== 'deprecated',
  );
  const permissionCatalogRows = activePermissionCatalog
    .map((definition) => {
      const moduleId = definition.availability.kind === 'module'
        ? sqlLiteral(definition.availability.moduleId)
        : 'NULL';
      return `(${sqlLiteral(definition.key)}, ${sqlLiteral(definition.description)}, ${sqlLiteral(definition.resourceType)}, ${moduleId}, ${resolvesSystemAdminGrant(definition) ? 'TRUE' : 'FALSE'})`;
    })
    .join(',\n        ');
  statements.push(
    `DO $permission_catalog_reconcile$
DECLARE
  target_instance_id text;
  permissions_changed integer;
  grants_inserted integer;
BEGIN
  FOR target_instance_id IN
    SELECT id FROM iam.instances WHERE id IN (${instanceIdList}) ORDER BY id
  LOOP
    WITH catalog(permission_key, description, resource_type, module_id, system_admin_grant) AS (
      VALUES
        ${permissionCatalogRows}
    )
    INSERT INTO iam.permissions (
      id, instance_id, permission_key, action, resource_type, resource_id, scope, description
    )
    SELECT
      gen_random_uuid(), target_instance_id, catalog.permission_key, catalog.permission_key,
      catalog.resource_type, NULL, '{}'::jsonb, catalog.description
    FROM catalog
    WHERE catalog.module_id IS NULL
       OR EXISTS (
         SELECT 1
         FROM iam.instance_modules instance_module
         WHERE instance_module.instance_id = target_instance_id
           AND instance_module.module_id = catalog.module_id
       )
    ON CONFLICT (instance_id, permission_key) DO UPDATE
    SET
      action = EXCLUDED.action,
      resource_type = EXCLUDED.resource_type,
      resource_id = EXCLUDED.resource_id,
      scope = EXCLUDED.scope,
      description = EXCLUDED.description,
      updated_at = NOW()
    WHERE (iam.permissions.action, iam.permissions.resource_type, iam.permissions.resource_id, iam.permissions.scope, iam.permissions.description)
      IS DISTINCT FROM (EXCLUDED.action, EXCLUDED.resource_type, EXCLUDED.resource_id, EXCLUDED.scope, EXCLUDED.description);
    GET DIAGNOSTICS permissions_changed = ROW_COUNT;

    INSERT INTO iam.roles (
      id, instance_id, role_key, role_name, display_name, external_role_name, description,
      is_system_role, role_level, managed_by, sync_state, last_synced_at, last_error_code
    )
    VALUES (
      gen_random_uuid(), target_instance_id, 'system_admin', 'system_admin', 'System Administrator',
      'system_admin', 'Geschützte Systemrolle System Administrator', TRUE, 100, 'studio', 'pending', NOW(), NULL
    )
    ON CONFLICT (instance_id, role_key) DO UPDATE
    SET
      role_name = EXCLUDED.role_name,
      display_name = EXCLUDED.display_name,
      external_role_name = EXCLUDED.external_role_name,
      description = EXCLUDED.description,
      is_system_role = TRUE,
      role_level = EXCLUDED.role_level,
      updated_at = NOW();

    WITH catalog(permission_key, description, resource_type, module_id, system_admin_grant) AS (
      VALUES
        ${permissionCatalogRows}
    )
    INSERT INTO iam.role_permissions (
      instance_id, role_id, permission_id, grant_origin_kind, grant_origin_module_id
    )
    SELECT
      target_instance_id,
      role.id,
      permission.id,
      CASE WHEN catalog.module_id IS NULL THEN 'bootstrap' ELSE 'module_sync' END,
      catalog.module_id
    FROM catalog
    JOIN iam.roles role
      ON role.instance_id = target_instance_id
     AND role.role_key = 'system_admin'
    JOIN iam.permissions permission
      ON permission.instance_id = target_instance_id
     AND permission.permission_key = catalog.permission_key
    WHERE catalog.system_admin_grant = TRUE
      AND (
        catalog.module_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM iam.instance_modules instance_module
          WHERE instance_module.instance_id = target_instance_id
            AND instance_module.module_id = catalog.module_id
        )
      )
    ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
    GET DIAGNOSTICS grants_inserted = ROW_COUNT;

    INSERT INTO iam.instance_audit_events (instance_id, event_type, actor_id, request_id, details)
    VALUES (
      target_instance_id,
      'instance_permission_catalog_reconciled',
      'runtime-bootstrap',
      NULL,
      jsonb_build_object(
        'permissionsChanged', permissions_changed,
        'grantsInserted', grants_inserted,
        'outcome', 'reconciled'
      )
    );
  END LOOP;
END
$permission_catalog_reconcile$;`,
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

case "${SVA_BOOTSTRAP_ENABLE_SCHEMA_GUARD}" in
  true)
    echo "[bootstrap-entrypoint] verifying IAM database readiness"
    node ./verify-iam-schema.mjs
    ;;
  false)
    ;;
  *)
    echo "[bootstrap-entrypoint] invalid SVA_BOOTSTRAP_ENABLE_SCHEMA_GUARD value" >&2
    exit 1
    ;;
esac

echo "[bootstrap-entrypoint] bootstrap completed"
