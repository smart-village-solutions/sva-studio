#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${POSTGRES_DB:-sva_studio}"
POSTGRES_USER="${POSTGRES_USER:-sva}"
POSTGRES_READY_DB="${POSTGRES_READY_DB:-postgres}"
POSTGRES_WAIT_TIMEOUT_SECONDS="${POSTGRES_WAIT_TIMEOUT_SECONDS:-120}"
POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-5432}"
POSTGRES_PORT="${POSTGRES_PORT:-${POSTGRES_HOST_PORT}}"
PROTECTED_DB_NAMES_REGEX="${PROTECTED_DB_NAMES_REGEX:-^(sva_studio|postgres)$}"

export POSTGRES_HOST_PORT
export POSTGRES_PORT

if ! docker compose config --services >/tmp/data-compose-services.txt 2>/tmp/data-compose-services.err; then
  echo "Failed to read docker compose services:"
  cat /tmp/data-compose-services.err
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  service_exists_cmd=(rg -qx 'postgres' /tmp/data-compose-services.txt)
else
  service_exists_cmd=(grep -qx 'postgres' /tmp/data-compose-services.txt)
fi

if ! "${service_exists_cmd[@]}"; then
  echo "Postgres service not found in docker compose configuration."
  exit 1
fi

if [ -z "$(docker compose ps -q postgres)" ]; then
  echo "Postgres container is not running. Starting it via docker compose..."
else
  echo "Ensuring Postgres service is running and healthy..."
fi

if docker compose up --help | grep -q -- '--wait'; then
  docker compose up -d --wait --wait-timeout "${POSTGRES_WAIT_TIMEOUT_SECONDS}" postgres
else
  echo "docker compose --wait is not available. Falling back to pg_isready polling..."
  docker compose up -d postgres
fi

echo "Wait for Postgres readiness..."
attempt=0
max_attempts="${POSTGRES_WAIT_TIMEOUT_SECONDS}"
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_READY_DB}" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "${attempt}" -ge "${max_attempts}" ]; then
    break
  fi
  sleep 1
done

if ! docker compose exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_READY_DB}" >/dev/null 2>&1; then
  echo "Postgres did not become ready in time."
  docker compose logs postgres --tail=200 || true
  exit 1
fi

timestamp="$(date +%s)"
raw_db_name="${POSTGRES_DB}_seed_test_${timestamp}_$$"
sanitized_db_name="$(printf '%s' "${raw_db_name}" | tr -c '[:alnum:]_' '_')"
TEST_DB_NAME="${TEST_DB_NAME:-${sanitized_db_name:0:63}}"

if [[ "${TEST_DB_NAME}" =~ ${PROTECTED_DB_NAMES_REGEX} ]]; then
  echo "Refusing to run seed integration test against protected database '${TEST_DB_NAME}'."
  echo "Use TEST_DB_NAME for a dedicated temporary database name."
  exit 1
fi

cleanup() {
  local exit_code="$1"

  echo "Dropping temporary seed test database: ${TEST_DB_NAME}"
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_READY_DB}" <<SQL >/dev/null || true
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${TEST_DB_NAME}'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS "${TEST_DB_NAME}";
SQL

  exit "${exit_code}"
}

trap 'cleanup $?' EXIT

echo "Ensure target database exists..."
db_exists=$(
  docker compose exec -T postgres psql -tA -U "${POSTGRES_USER}" -d "${POSTGRES_READY_DB}" -v db_name="${TEST_DB_NAME}" <<'SQL'
SELECT 1 FROM pg_database WHERE datname = :'db_name';
SQL
)
if [ "${db_exists}" != "1" ]; then
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_READY_DB}" \
    -c "CREATE DATABASE \"${TEST_DB_NAME}\";"
fi

echo "Recreate target database for a clean seed integration run..."
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_READY_DB}" -v db_name="${TEST_DB_NAME}" <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'db_name'
  AND pid <> pg_backend_pid();
SELECT format('DROP DATABASE IF EXISTS %I;', :'db_name');
\gexec
SELECT format('CREATE DATABASE %I;', :'db_name');
\gexec
SQL

echo "Apply migrations..."
POSTGRES_DB="${TEST_DB_NAME}" bash packages/data/scripts/run-migrations.sh up

echo "Reset IAM tables for seed integration test..."
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${TEST_DB_NAME}" <<'SQL'
TRUNCATE iam.activity_logs, iam.role_permissions, iam.account_roles, iam.account_organizations,
  iam.account_deletion_content_preferences, iam.instance_memberships, iam.permissions, iam.roles,
  iam.organizations, iam.instance_deletion_rules, iam.accounts, iam.instances
  RESTART IDENTITY CASCADE;
SQL

echo "Run seeds twice..."
POSTGRES_DB="${TEST_DB_NAME}" bash packages/data/scripts/run-seeds.sh
POSTGRES_DB="${TEST_DB_NAME}" bash packages/data/scripts/run-seeds.sh

echo "Validate seed idempotency counts..."
assert_count() {
  local sql="$1"
  local expected="$2"
  local label="$3"

  local actual
  actual=$(docker compose exec -T postgres psql -tA -U "${POSTGRES_USER}" -d "${TEST_DB_NAME}" -c "$sql")

  if [ "${actual}" != "${expected}" ]; then
    echo "[FAIL] ${label}: expected ${expected}, got ${actual}"
    exit 1
  fi

  echo "[OK] ${label}: ${actual}"
}

assert_count "SELECT COUNT(*) FROM iam.instances WHERE id = 'de-musterhausen';" "1" "instance count"
assert_count "SELECT COUNT(*) FROM iam.instance_deletion_rules WHERE instance_id = 'de-musterhausen';" "1" "deletion rule count"
assert_count "SELECT COUNT(*) FROM iam.account_deletion_content_preferences;" "0" "content preference count"
assert_count "SELECT COUNT(*) FROM iam.organizations WHERE instance_id = 'de-musterhausen';" "3" "organization count"
assert_count "SELECT COUNT(*) FROM iam.roles WHERE instance_id = 'de-musterhausen';" "9" "role count"
assert_count "SELECT COUNT(*) FROM iam.roles WHERE instance_id = 'de-musterhausen' AND managed_by = 'studio';" "9" "studio role count"
assert_count "SELECT COUNT(*) FROM iam.roles WHERE instance_id = 'de-musterhausen' AND role_key = 'instance_registry_admin';" "0" "tenant instance registry admin role"
assert_count "SELECT COUNT(*) FROM iam.roles WHERE instance_id = 'de-musterhausen' AND managed_by = 'external';" "0" "external role count"
assert_count "SELECT COUNT(*) FROM iam.permissions WHERE instance_id = 'de-musterhausen';" "61" "permission count"
assert_count "SELECT COUNT(*) FROM iam.permissions WHERE instance_id = 'de-musterhausen' AND action = permission_key;" "61" "permission actions"
assert_count "SELECT COUNT(*) FROM iam.permissions WHERE instance_id = 'de-musterhausen' AND scope = '{}'::jsonb;" "61" "permission scopes"
assert_count "SELECT COUNT(*) FROM iam.accounts WHERE keycloak_subject LIKE 'seed:%';" "1" "account count"
assert_count "SELECT COUNT(*) FROM iam.accounts WHERE instance_id = 'de-musterhausen' AND keycloak_subject = 'seed:instance_registry_admin';" "0" "tenant instance registry admin account"
assert_count "SELECT COUNT(*) FROM iam.instance_memberships WHERE instance_id = 'de-musterhausen';" "1" "instance memberships"
assert_count "SELECT COUNT(*) FROM iam.instance_memberships WHERE instance_id = 'de-musterhausen' AND account_id = '50888888-8888-8888-8888-888888888888';" "0" "tenant instance registry admin membership"
assert_count "SELECT COUNT(*) FROM iam.account_roles WHERE instance_id = 'de-musterhausen';" "1" "account roles"
assert_count "SELECT COUNT(*) FROM iam.account_roles WHERE instance_id = 'de-musterhausen' AND account_id = '50888888-8888-8888-8888-888888888888';" "0" "tenant instance registry admin account role"
assert_count "SELECT COUNT(*) FROM iam.account_organizations WHERE instance_id = 'de-musterhausen';" "2" "account organizations"
assert_count "SELECT COUNT(*) FROM iam.account_organizations WHERE instance_id = 'de-musterhausen' AND is_default_context = true;" "1" "default organization contexts"
assert_count "SELECT COUNT(*) FROM iam.role_permissions WHERE instance_id = 'de-musterhausen';" "60" "role permissions"
assert_count "SELECT COUNT(*) FROM iam.role_permissions WHERE instance_id = 'de-musterhausen' AND grant_origin_kind = 'manual';" "60" "manual role permissions"
assert_count "SELECT COUNT(*) FROM iam.role_permissions rp JOIN iam.roles r ON r.id = rp.role_id AND r.instance_id = rp.instance_id JOIN iam.permissions p ON p.id = rp.permission_id AND p.instance_id = rp.instance_id WHERE rp.instance_id = 'de-musterhausen' AND r.role_key = 'system_admin' AND p.permission_key = 'modules.read';" "1" "system admin modules read permission"
assert_count "SELECT COUNT(*) FROM iam.role_permissions rp JOIN iam.roles r ON r.id = rp.role_id AND r.instance_id = rp.instance_id JOIN iam.permissions p ON p.id = rp.permission_id AND p.instance_id = rp.instance_id WHERE rp.instance_id = 'de-musterhausen' AND r.role_key = 'system_admin' AND p.permission_key = 'news.pushNotification';" "1" "system admin news push permission"
assert_count "SELECT COUNT(*) FROM iam.role_permissions rp JOIN iam.roles r ON r.id = rp.role_id AND r.instance_id = rp.instance_id JOIN iam.permissions p ON p.id = rp.permission_id AND p.instance_id = rp.instance_id WHERE rp.instance_id = 'de-musterhausen' AND r.role_key <> 'system_admin' AND p.permission_key = 'news.pushNotification';" "0" "non-system-admin news push permissions"
assert_count "SELECT COUNT(*) FROM iam.role_permissions rp JOIN iam.roles r ON r.id = rp.role_id AND r.instance_id = rp.instance_id JOIN iam.permissions p ON p.id = rp.permission_id AND p.instance_id = rp.instance_id WHERE rp.instance_id = 'de-musterhausen' AND r.role_key <> 'system_admin' AND p.permission_key = 'modules.read';" "0" "non-system-admin modules read permissions"
assert_count "SELECT COUNT(*) FROM iam.role_permissions rp JOIN iam.roles r ON r.id = rp.role_id AND r.instance_id = rp.instance_id WHERE rp.instance_id = 'de-musterhausen' AND r.role_key = 'instance_registry_admin';" "0" "tenant instance registry admin role permissions"
assert_count "SELECT COUNT(*) FROM iam.role_permissions WHERE instance_id = 'de-musterhausen' AND grant_origin_module_id IS NOT NULL;" "0" "module-owned role permissions in seeds"

echo "Reproduce and verify the primary-hostname switch contract..."
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${TEST_DB_NAME}" <<'SQL'
INSERT INTO iam.instances (
  id,
  display_name,
  status,
  parent_domain,
  primary_hostname,
  auth_realm,
  auth_client_id,
  tenant_admin_client_id,
  feature_flags
)
VALUES (
  'integration-hostname-switch',
  'Hostname Switch Integration',
  'active',
  'example.test',
  'old.example.test',
  'integration-hostname-switch',
  'sva-studio',
  'sva-studio-realm-admin',
  '{}'::jsonb
);

INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
VALUES ('old.example.test', 'integration-hostname-switch', true, 'integration-test');

DO $$
DECLARE
  violated_constraint text;
BEGIN
  BEGIN
    INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
    VALUES ('new.example.test', 'integration-hostname-switch', true, 'integration-test');
    RAISE EXCEPTION 'expected primary-hostname unique violation';
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
      IF violated_constraint <> 'uq_instance_hostnames_primary_per_instance' THEN
        RAISE EXCEPTION 'unexpected unique constraint: %', violated_constraint;
      END IF;
  END;
END $$;

BEGIN;
UPDATE iam.instances
SET primary_hostname = 'new.example.test'
WHERE id = 'integration-hostname-switch';

UPDATE iam.instance_hostnames
SET is_primary = false
WHERE instance_id = 'integration-hostname-switch'
  AND is_primary = true
  AND hostname <> 'new.example.test';

INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
VALUES ('new.example.test', 'integration-hostname-switch', true, 'integration-test')
ON CONFLICT (hostname) DO UPDATE
SET
  is_primary = EXCLUDED.is_primary
WHERE iam.instance_hostnames.instance_id = EXCLUDED.instance_id
RETURNING hostname;
COMMIT;

INSERT INTO iam.instances (
  id,
  display_name,
  status,
  parent_domain,
  primary_hostname,
  auth_realm,
  auth_client_id,
  tenant_admin_client_id,
  feature_flags
)
VALUES (
  'integration-hostname-owner',
  'Hostname Owner Integration',
  'active',
  'example.test',
  'owner.example.test',
  'integration-hostname-owner',
  'sva-studio',
  'sva-studio-realm-admin',
  '{}'::jsonb
);

INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
VALUES
  ('owner.example.test', 'integration-hostname-owner', true, 'integration-test'),
  ('owned.example.test', 'integration-hostname-owner', false, 'integration-test');

DO $$
DECLARE
  claimed_count integer;
BEGIN
  BEGIN
    UPDATE iam.instances
    SET primary_hostname = 'owned.example.test'
    WHERE id = 'integration-hostname-switch';

    UPDATE iam.instance_hostnames
    SET is_primary = false
    WHERE instance_id = 'integration-hostname-switch'
      AND is_primary = true
      AND hostname <> 'owned.example.test';

    WITH claimed AS (
      INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
      VALUES ('owned.example.test', 'integration-hostname-switch', true, 'integration-test')
      ON CONFLICT (hostname) DO UPDATE
      SET is_primary = EXCLUDED.is_primary
      WHERE iam.instance_hostnames.instance_id = EXCLUDED.instance_id
      RETURNING hostname
    )
    SELECT COUNT(*) INTO claimed_count FROM claimed;

    IF claimed_count = 0 THEN
      RAISE EXCEPTION 'tenant_hostname_conflict';
    END IF;
    RAISE EXCEPTION 'expected tenant_hostname_conflict';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'tenant_hostname_conflict' THEN
        RAISE;
      END IF;
  END;
END $$;
SQL

assert_count "SELECT COUNT(*) FROM iam.instance_hostnames WHERE instance_id = 'integration-hostname-switch' AND is_primary = true AND hostname = 'new.example.test';" "1" "new primary hostname"
assert_count "SELECT COUNT(*) FROM iam.instance_hostnames WHERE instance_id = 'integration-hostname-switch' AND is_primary = false AND hostname = 'old.example.test';" "1" "preserved previous hostname alias"
assert_count "SELECT COUNT(*) FROM iam.instance_hostnames WHERE instance_id = 'integration-hostname-switch' AND is_primary = true;" "1" "single primary hostname after switch"
assert_count "SELECT COUNT(*) FROM iam.instances WHERE id = 'integration-hostname-switch' AND primary_hostname = 'new.example.test';" "1" "hostname conflict rolls back instance update"
assert_count "SELECT COUNT(*) FROM iam.instance_hostnames WHERE hostname = 'owned.example.test' AND instance_id = 'integration-hostname-owner' AND is_primary = false;" "1" "foreign hostname ownership preserved"

echo "Verify persisted tenant provisioning recovery after accepted Keycloak realm creation..."
INSTANCE_PROVISIONING_INTEGRATION_DB="${TEST_DB_NAME}" \
  POSTGRES_HOST="127.0.0.1" \
  pnpm nx run instance-registry:test:unit \
    --testFiles=src/tenant-provisioning-recovery.integration.test.ts \
    --skip-nx-cache

echo "Seed idempotency integration test passed."
