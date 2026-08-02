#!/usr/bin/env sh
set -eu

require_env() {
  key="$1"
  value="$(printenv "$key" 2>/dev/null || true)"
  if [ -z "$value" ]; then
    printf '[provisioner-entrypoint] missing required environment variable: %s\n' "$key" >&2
    exit 1
  fi
}

require_env APP_DB_PASSWORD
require_env POSTGRES_PASSWORD
require_env REDIS_PASSWORD
require_env KEYCLOAK_PROVISIONER_BASE_URL
require_env KEYCLOAK_PROVISIONER_REALM
require_env KEYCLOAK_PROVISIONER_CLIENT_ID
require_env KEYCLOAK_PROVISIONER_CLIENT_SECRET

if [ "${SVA_PLUGIN_OPERATION_WORKER_LANE:-default}" = "privileged" ]; then
  require_env WASTE_DATABASE_PROVISIONER_USER
  require_env WASTE_DATABASE_PROVISIONER_PASSWORD_FILE
  waste_database_provisioner_password="$(tr -d '\r\n' < "${WASTE_DATABASE_PROVISIONER_PASSWORD_FILE}")"
  if [ -z "${waste_database_provisioner_password}" ]; then
    echo '[provisioner-entrypoint] waste provisioner password file is empty' >&2
    exit 1
  fi
  case "${WASTE_DATABASE_PROVISIONER_USER}" in
    ''|[0-9]*|*[!A-Za-z0-9_]*) echo '[provisioner-entrypoint] invalid waste provisioner role name' >&2; exit 1 ;;
    *) ;;
  esac
  PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    --host "${WASTE_DATABASE_PROVISIONER_HOST:-postgres}" \
    --port "${WASTE_DATABASE_PROVISIONER_PORT:-5432}" \
    --username "${POSTGRES_USER:-sva}" \
    --dbname "${WASTE_DATABASE_PROVISIONER_DATABASE:-sva_studio}" \
    --no-psqlrc --set ON_ERROR_STOP=1 \
    --set "role_name=${WASTE_DATABASE_PROVISIONER_USER}" \
    --set "role_password=${waste_database_provisioner_password}" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER CREATEDB CREATEROLE NOREPLICATION NOINHERIT',
  :'role_name', :'role_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role_name')
\gexec
SELECT format(
  'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER CREATEDB CREATEROLE NOREPLICATION NOINHERIT',
  :'role_name', :'role_password'
)
\gexec
SQL
  waste_database_provisioner_password_encoded="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1] ?? ""))' "${waste_database_provisioner_password}")"
  export WASTE_DATABASE_PROVISIONER_URL="postgresql://${WASTE_DATABASE_PROVISIONER_USER}:${waste_database_provisioner_password_encoded}@${WASTE_DATABASE_PROVISIONER_HOST:-postgres}:${WASTE_DATABASE_PROVISIONER_PORT:-5432}/${WASTE_DATABASE_PROVISIONER_DATABASE:-sva_studio}"
  unset waste_database_provisioner_password waste_database_provisioner_password_encoded
fi

if [ "${SVA_PROVISIONER_COMBINED_WORKER:-false}" = "true" ] && [ "$#" -eq 0 ]; then
  set -- node --import ./otel-bootstrap.mjs .output/server/index.mjs
fi

if [ "${SVA_PROVISIONER_COMBINED_WORKER:-false}" = "true" ]; then
  node --import ./otel-bootstrap.mjs node_modules/@sva/auth-runtime/dist/iam-instance-registry/worker.js &
  keycloak_worker_pid=$!
  trap 'kill "${keycloak_worker_pid}" "${studio_worker_pid:-}" 2>/dev/null || true' INT TERM EXIT
  ./entrypoint.sh "$@" &
  studio_worker_pid=$!
  while kill -0 "${keycloak_worker_pid}" 2>/dev/null && kill -0 "${studio_worker_pid}" 2>/dev/null; do
    sleep 2
  done
  kill "${keycloak_worker_pid}" "${studio_worker_pid}" 2>/dev/null || true
  wait "${keycloak_worker_pid}" 2>/dev/null || true
  wait "${studio_worker_pid}" 2>/dev/null || true
  exit 1
elif [ "$#" -eq 0 ]; then
  set -- node --import ./otel-bootstrap.mjs node_modules/@sva/auth-runtime/dist/iam-instance-registry/worker.js
fi

exec "$@"
