#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${POSTGRES_DB:-sva_studio}"
POSTGRES_USER="${POSTGRES_USER:-sva}"
POSTGRES_READY_DB="${POSTGRES_READY_DB:-postgres}"
POSTGRES_WAIT_TIMEOUT_SECONDS="${POSTGRES_WAIT_TIMEOUT_SECONDS:-120}"

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
raw_db_name="${POSTGRES_DB}_validate_${timestamp}_$$"
sanitized_db_name="$(printf '%s' "${raw_db_name}" | tr -c '[:alnum:]_' '_')"
VALIDATION_DB_NAME="${VALIDATION_DB_NAME:-${sanitized_db_name:0:63}}"

cleanup() {
  local exit_code="$1"

  echo "Dropping temporary validation database: ${VALIDATION_DB_NAME}"
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_READY_DB}" <<SQL >/dev/null
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${VALIDATION_DB_NAME}'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS "${VALIDATION_DB_NAME}";
SQL

  exit "${exit_code}"
}

trap 'cleanup $?' EXIT

echo "Creating temporary validation database: ${VALIDATION_DB_NAME}"
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_READY_DB}" <<SQL >/dev/null
DROP DATABASE IF EXISTS "${VALIDATION_DB_NAME}";
CREATE DATABASE "${VALIDATION_DB_NAME}";
SQL

echo "Validating migrations against temporary database..."
POSTGRES_DB="${VALIDATION_DB_NAME}" bash packages/data/scripts/run-migrations.sh down-to 0 || true
POSTGRES_DB="${VALIDATION_DB_NAME}" bash packages/data/scripts/run-migrations.sh up
POSTGRES_DB="${VALIDATION_DB_NAME}" bash packages/data/scripts/run-migrations.sh down-to 0
POSTGRES_DB="${VALIDATION_DB_NAME}" bash packages/data/scripts/run-migrations.sh up

echo "Migration validation successful (up -> down -> up) on temporary database ${VALIDATION_DB_NAME}."
