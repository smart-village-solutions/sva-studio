#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${POSTGRES_DB:-sva_studio}"
POSTGRES_USER="${POSTGRES_USER:-sva}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
SVA_LOCAL_POSTGRES_CONTAINER_NAME="${SVA_LOCAL_POSTGRES_CONTAINER_NAME:-}"
DIRECTION="${1:-up}"

if [ -n "${SVA_LOCAL_POSTGRES_CONTAINER_NAME}" ]; then
  if [ -z "$(docker ps -q -f "name=^/${SVA_LOCAL_POSTGRES_CONTAINER_NAME}$")" ]; then
    echo "Postgres container '${SVA_LOCAL_POSTGRES_CONTAINER_NAME}' is not running."
    exit 1
  fi
  postgres_exec=(docker exec -i "${SVA_LOCAL_POSTGRES_CONTAINER_NAME}" psql)
else
  if ! docker compose ps "${POSTGRES_SERVICE}" >/dev/null 2>&1; then
    echo "Postgres service '${POSTGRES_SERVICE}' not found in docker compose."
    exit 1
  fi

  if [ -z "$(docker compose ps -q "${POSTGRES_SERVICE}")" ]; then
    echo "Postgres service '${POSTGRES_SERVICE}' is not running. Start it with: pnpm nx run data:db:up"
    exit 1
  fi

  postgres_exec=(docker compose exec -T "${POSTGRES_SERVICE}" psql)
fi

if [[ "${DIRECTION}" != "up" && "${DIRECTION}" != "down" ]]; then
  echo "Invalid migration direction: '${DIRECTION}'. Use 'up' or 'down'."
  exit 1
fi

shopt -s nullglob
migrations=(packages/data/migrations/"${DIRECTION}"/*.sql)

if [ ${#migrations[@]} -eq 0 ]; then
  echo "No SQL migrations found in packages/data/migrations/${DIRECTION}"
  exit 0
fi

if [ "${DIRECTION}" = "down" ]; then
  for ((i=${#migrations[@]} - 1; i >= 0; i--)); do
    migration="${migrations[$i]}"
    echo "Applying ${DIRECTION} migration: ${migration}"
    "${postgres_exec[@]}" -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${migration}"
  done
  echo "All ${DIRECTION} migrations applied successfully."
  exit 0
fi

for migration in "${migrations[@]}"; do
  echo "Applying migration: ${migration}"
  "${postgres_exec[@]}" -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${migration}"
done

echo "All ${DIRECTION} migrations applied successfully."
