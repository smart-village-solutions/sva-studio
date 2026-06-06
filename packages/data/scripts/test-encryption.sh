#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${POSTGRES_DB:-sva_studio}"
POSTGRES_USER="${POSTGRES_USER:-sva}"
POSTGRES_READY_DB="${POSTGRES_READY_DB:-postgres}"
PROTECTED_DB_NAMES_REGEX="${PROTECTED_DB_NAMES_REGEX:-^(sva_studio|postgres)$}"

if ! docker compose ps postgres >/dev/null 2>&1; then
  echo "Postgres service not found in docker compose."
  exit 1
fi

if [ -z "$(docker compose ps -q postgres)" ]; then
  echo "Postgres container is not running. Start it with: pnpm nx run data:db:up"
  exit 1
fi

timestamp="$(date +%s)"
raw_db_name="${POSTGRES_DB}_encryption_test_${timestamp}_$$"
sanitized_db_name="$(printf '%s' "${raw_db_name}" | tr -c '[:alnum:]_' '_')"
TEST_DB_NAME="${TEST_DB_NAME:-${sanitized_db_name:0:63}}"

if [[ "${TEST_DB_NAME}" =~ ${PROTECTED_DB_NAMES_REGEX} ]]; then
  echo "Refusing to run encryption integration test against protected database '${TEST_DB_NAME}'."
  echo "Use TEST_DB_NAME for a dedicated temporary database name."
  exit 1
fi

IAM_DATABASE_URL="${IAM_DATABASE_URL:-postgres://sva:sva_local_dev_password@localhost:5432/${TEST_DB_NAME}}"

cleanup() {
  local exit_code="$1"

  echo "Dropping temporary encryption test database: ${TEST_DB_NAME}"
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

echo "Recreate target database for an isolated encryption integration run..."
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

export IAM_PII_ACTIVE_KEY_ID="k1"
export IAM_PII_KEYRING_JSON='{"k1":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="}'
export IAM_DATABASE_URL

echo "Prepare schema and seed data..."
POSTGRES_DB="${TEST_DB_NAME}" bash packages/data/scripts/run-migrations.sh up
POSTGRES_DB="${TEST_DB_NAME}" bash packages/data/scripts/run-seeds.sh

echo "Emit auth event with PII to trigger encrypted account update..."
pnpm exec tsx -e "import { emitAuthAuditEvent } from './packages/auth-runtime/src/audit-events.ts'; (async () => { await emitAuthAuditEvent({ eventType:'login', actorUserId:'keycloak:test-encryption', actorEmail:'privacy@example.org', actorDisplayName:'Erika Musterfrau', workspaceId:'de-musterhausen', outcome:'success', requestId:'req-encryption-1', traceId:'trace-encryption-1' }); })().catch((err) => { console.error(err); process.exit(1); });"

echo "Validate ciphertext storage (no plaintext in direct SQL)..."
result=$(docker compose exec -T postgres psql -tA -U "${POSTGRES_USER}" -d "${TEST_DB_NAME}" <<'SQL'
SET app.instance_id = 'de-musterhausen';
SELECT
  CASE
    WHEN email_ciphertext IS NULL OR display_name_ciphertext IS NULL THEN 'missing'
    WHEN email_ciphertext LIKE '%@%' THEN 'plaintext_email'
    WHEN display_name_ciphertext LIKE '%Erika Musterfrau%' THEN 'plaintext_name'
    WHEN email_ciphertext NOT LIKE 'enc:v1:%' THEN 'bad_email_format'
    WHEN display_name_ciphertext NOT LIKE 'enc:v1:%' THEN 'bad_name_format'
    ELSE 'ok'
  END AS encryption_check
FROM iam.accounts
WHERE keycloak_subject = 'keycloak:test-encryption';
SQL
)

check=$(echo "${result}" | tail -n 1)

if [ "${check}" != "ok" ]; then
  echo "Encryption test failed: ${check}"
  exit 1
fi

echo "Encryption integration test passed."
