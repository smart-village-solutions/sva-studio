#!/usr/bin/env bash
set -euo pipefail

POSTGRES_USER="${POSTGRES_USER:-sva}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-sva_local_dev_password}"
POSTGRES_READY_DB="${POSTGRES_READY_DB:-postgres}"
POSTGRES_WAIT_TIMEOUT_SECONDS="${POSTGRES_WAIT_TIMEOUT_SECONDS:-120}"
POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-5432}"
PROTECTED_DB_NAMES_REGEX="${PROTECTED_DB_NAMES_REGEX:-^(sva_studio|postgres|template0|template1)$}"

export POSTGRES_HOST_PORT

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "${workspace_root}"

if ! docker compose config --services >/tmp/waste-date-shift-compose-services.txt 2>/tmp/waste-date-shift-compose-services.err; then
  echo "Failed to read docker compose services:"
  sed -n '1,120p' /tmp/waste-date-shift-compose-services.err
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  service_exists_cmd=(rg -qx 'postgres' /tmp/waste-date-shift-compose-services.txt)
else
  service_exists_cmd=(grep -qx 'postgres' /tmp/waste-date-shift-compose-services.txt)
fi

if ! "${service_exists_cmd[@]}"; then
  echo "Postgres service not found in docker compose configuration."
  exit 1
fi

docker compose up -d postgres

echo "Waiting for Postgres readiness..."
attempt=0
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_READY_DB}" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "${attempt}" -ge "${POSTGRES_WAIT_TIMEOUT_SECONDS}" ]; then
    echo "Postgres did not become ready in time."
    docker compose logs postgres --tail=200 || true
    exit 1
  fi
  sleep 1
done

raw_db_name="sva_waste_date_shift_test_$(date +%s)_$$"
sanitized_db_name="$(printf '%s' "${raw_db_name}" | tr -c '[:alnum:]_' '_')"
TEST_DB_NAME="${TEST_DB_NAME:-${sanitized_db_name:0:63}}"

if [[ "${TEST_DB_NAME}" =~ ${PROTECTED_DB_NAMES_REGEX} ]]; then
  echo "Refusing to run integration tests against protected database '${TEST_DB_NAME}'."
  exit 1
fi

cleanup() {
  local exit_code="$1"
  echo "Dropping temporary Waste date-shift database: ${TEST_DB_NAME}"
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_READY_DB}" -v db_name="${TEST_DB_NAME}" <<'SQL' >/dev/null || true
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'db_name'
  AND pid <> pg_backend_pid();
SELECT format('DROP DATABASE IF EXISTS %I;', :'db_name');
\gexec
SQL
  exit "${exit_code}"
}

trap 'cleanup $?' EXIT

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_READY_DB}" -v db_name="${TEST_DB_NAME}" <<'SQL' >/dev/null
SELECT format('CREATE DATABASE %I;', :'db_name');
\gexec
SQL

export WASTE_DATE_SHIFT_TEST_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_HOST_PORT}/${TEST_DB_NAME}"

pnpm --dir apps/sva-studio-react exec vitest run --config vitest.integration.config.ts
