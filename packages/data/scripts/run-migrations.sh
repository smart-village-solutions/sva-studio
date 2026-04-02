#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${POSTGRES_DB:-sva_studio}"
POSTGRES_USER="${POSTGRES_USER:-sva}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-sva_local_dev_password}"
POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
SVA_LOCAL_POSTGRES_CONTAINER_NAME="${SVA_LOCAL_POSTGRES_CONTAINER_NAME:-}"
GOOSE_COMMAND="${1:-up}"
GOOSE_WRAPPER="${GOOSE_WRAPPER:-packages/data/scripts/goosew.sh}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-packages/data/migrations}"

case "${POSTGRES_SERVICE}" in
  postgres-hb)
    POSTGRES_PORT="${POSTGRES_PORT:-5433}"
    ;;
  *)
    POSTGRES_PORT="${POSTGRES_PORT:-5432}"
    ;;
esac

if [ -n "${SVA_LOCAL_POSTGRES_CONTAINER_NAME}" ]; then
  if [ -z "$(docker ps -q -f "name=^/${SVA_LOCAL_POSTGRES_CONTAINER_NAME}$")" ]; then
    echo "Postgres container '${SVA_LOCAL_POSTGRES_CONTAINER_NAME}' is not running."
    exit 1
  fi
else
  if ! docker compose ps "${POSTGRES_SERVICE}" >/dev/null 2>&1; then
    echo "Postgres service '${POSTGRES_SERVICE}' not found in docker compose."
    exit 1
  fi

  if [ -z "$(docker compose ps -q "${POSTGRES_SERVICE}")" ]; then
    echo "Postgres service '${POSTGRES_SERVICE}' is not running. Start it with: pnpm nx run data:db:up"
    exit 1
  fi
fi

if [[ ! "${GOOSE_COMMAND}" =~ ^(up|up-to|down|down-to|status|version)$ ]]; then
  echo "Invalid goose command: '${GOOSE_COMMAND}'. Use one of: up, up-to, down, down-to, status, version."
  exit 1
fi

if [ ! -d "${MIGRATIONS_DIR}" ]; then
  echo "Goose migrations directory '${MIGRATIONS_DIR}' not found."
  exit 1
fi

if ! find "${MIGRATIONS_DIR}" -maxdepth 1 -name '*.sql' -print -quit | grep -q .; then
  echo "No Goose SQL migrations found in ${MIGRATIONS_DIR}"
  exit 0
fi

db_string="postgres://${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable"

if [ "${GOOSE_COMMAND}" = "down" ]; then
  exec env PGPASSWORD="${POSTGRES_PASSWORD}" "${GOOSE_WRAPPER}" -dir "${MIGRATIONS_DIR}" postgres "${db_string}" down-to 0
fi

if [ "${GOOSE_COMMAND}" = "up-to" ] || [ "${GOOSE_COMMAND}" = "down-to" ]; then
  target_version="${2:-}"
  if [ -z "${target_version}" ]; then
    echo "${GOOSE_COMMAND} requires a target version."
    exit 1
  fi
  exec env PGPASSWORD="${POSTGRES_PASSWORD}" "${GOOSE_WRAPPER}" -dir "${MIGRATIONS_DIR}" postgres "${db_string}" "${GOOSE_COMMAND}" "${target_version}"
fi

exec env PGPASSWORD="${POSTGRES_PASSWORD}" "${GOOSE_WRAPPER}" -dir "${MIGRATIONS_DIR}" postgres "${db_string}" "${GOOSE_COMMAND}"
