#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="sva_studio"
POSTGRES_USER="sva"
POSTGRES_PASSWORD="sva_migration_validation_password"
POSTGRES_WAIT_TIMEOUT_SECONDS="${POSTGRES_WAIT_TIMEOUT_SECONDS:-120}"
POSTGRES_IMAGE="postgres:16-alpine"
VALIDATION_CONTAINER_NAME="sva-migration-validation-$(date +%s)-$$"

cleanup() {
  local exit_code="$1"

  trap - EXIT
  echo "Removing temporary validation container: ${VALIDATION_CONTAINER_NAME}"
  docker rm --force "${VALIDATION_CONTAINER_NAME}" >/dev/null 2>&1 || true
  exit "${exit_code}"
}

trap 'cleanup $?' EXIT

echo "Starting isolated Postgres validation container: ${VALIDATION_CONTAINER_NAME}"
docker run \
  --detach \
  --rm \
  --name "${VALIDATION_CONTAINER_NAME}" \
  --env "POSTGRES_DB=${POSTGRES_DB}" \
  --env "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
  --env "POSTGRES_USER=${POSTGRES_USER}" \
  --publish '127.0.0.1::5432' \
  "${POSTGRES_IMAGE}" >/dev/null

echo "Wait for isolated Postgres readiness..."
attempt=0
until docker exec "${VALIDATION_CONTAINER_NAME}" \
  pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "${attempt}" -ge "${POSTGRES_WAIT_TIMEOUT_SECONDS}" ]; then
    echo "Isolated Postgres did not become ready in time."
    docker logs "${VALIDATION_CONTAINER_NAME}" --tail=200 || true
    exit 1
  fi
  sleep 1
done

POSTGRES_PORT="$(docker port "${VALIDATION_CONTAINER_NAME}" 5432/tcp | sed -E 's/^.*:([0-9]+)$/\1/')"
if ! [[ "${POSTGRES_PORT}" =~ ^[0-9]+$ ]]; then
  echo "Could not determine the isolated Postgres port."
  exit 1
fi

export POSTGRES_DB
export POSTGRES_HOST="127.0.0.1"
export POSTGRES_PASSWORD
export POSTGRES_PORT
export POSTGRES_USER
export SVA_LOCAL_POSTGRES_CONTAINER_NAME="${VALIDATION_CONTAINER_NAME}"

echo "Validating migrations in isolated Postgres..."
bash packages/data/scripts/run-migrations.sh up
bash packages/data/scripts/run-migrations.sh down-to 0
bash packages/data/scripts/run-migrations.sh up

echo "Migration validation successful (up -> down -> up) in isolated Postgres."
