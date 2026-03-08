#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${POSTGRES_DB:-sva_studio}"
POSTGRES_USER="${POSTGRES_USER:-sva}"
DIRECTION="${1:-up}"

if ! docker compose ps postgres >/dev/null 2>&1; then
  echo "Postgres service not found in docker compose."
  exit 1
fi

if [ -z "$(docker compose ps -q postgres)" ]; then
  echo "Postgres container is not running. Start it with: pnpm nx run data:db:up"
  exit 1
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
    docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${migration}"
  done
  echo "All ${DIRECTION} migrations applied successfully."
  exit 0
fi

for migration in "${migrations[@]}"; do
  echo "Applying migration: ${migration}"
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${migration}"
done

echo "All ${DIRECTION} migrations applied successfully."
