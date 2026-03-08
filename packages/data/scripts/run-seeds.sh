#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${POSTGRES_DB:-sva_studio}"
POSTGRES_USER="${POSTGRES_USER:-sva}"

if ! docker compose ps postgres >/dev/null 2>&1; then
  echo "Postgres service not found in docker compose."
  exit 1
fi

if [ -z "$(docker compose ps -q postgres)" ]; then
  echo "Postgres container is not running. Start it with: pnpm nx run data:db:up"
  exit 1
fi

shopt -s nullglob
seeds=(packages/data/seeds/*.sql)

if [ ${#seeds[@]} -eq 0 ]; then
  echo "No SQL seeds found in packages/data/seeds"
  exit 0
fi

for seed in "${seeds[@]}"; do
  echo "Applying seed: ${seed}"
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${seed}"
done

echo "All seeds applied successfully."
