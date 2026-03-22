#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${POSTGRES_DB:-sva_studio}"
POSTGRES_USER="${POSTGRES_USER:-sva}"
IAM_DATABASE_URL="${IAM_DATABASE_URL:-}"
SVA_LOCAL_POSTGRES_CONTAINER_NAME="${SVA_LOCAL_POSTGRES_CONTAINER_NAME:-}"

if [ -z "${IAM_DATABASE_URL}" ]; then
  echo "IAM_DATABASE_URL is required."
  exit 1
fi

if [ -n "${SVA_LOCAL_POSTGRES_CONTAINER_NAME}" ]; then
  if [ -z "$(docker ps -q -f "name=^/${SVA_LOCAL_POSTGRES_CONTAINER_NAME}$")" ]; then
    echo "Postgres container '${SVA_LOCAL_POSTGRES_CONTAINER_NAME}' is not running."
    exit 1
  fi
  postgres_exec=(docker exec -i "${SVA_LOCAL_POSTGRES_CONTAINER_NAME}" psql)
else
  if [ -z "$(docker compose ps -q postgres)" ]; then
    echo "Postgres container is not running. Start it with: pnpm nx run data:db:up"
    exit 1
  fi
  postgres_exec=(docker compose exec -T postgres psql)
fi

app_user="$(node -e "const url = new URL(process.argv[1]); process.stdout.write(decodeURIComponent(url.username));" "${IAM_DATABASE_URL}")"
app_password="$(node -e "const url = new URL(process.argv[1]); process.stdout.write(decodeURIComponent(url.password));" "${IAM_DATABASE_URL}")"

if [ -z "${app_user}" ] || [ -z "${app_password}" ]; then
  echo "IAM_DATABASE_URL must include username and password."
  exit 1
fi

if ! [[ "${app_user}" =~ ^[a-zA-Z0-9_]{1,63}$ ]]; then
  echo "IAM_DATABASE_URL username must match ^[a-zA-Z0-9_]{1,63}$."
  exit 1
fi

"${postgres_exec[@]}" -v ON_ERROR_STOP=1 -v app_user="${app_user}" -v app_password="${app_password}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') AS role_exists \gset
\if :role_exists
ALTER ROLE :"app_user" WITH LOGIN INHERIT PASSWORD :'app_password';
\else
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;
\endif

GRANT iam_app TO :"app_user";
GRANT USAGE ON SCHEMA iam TO :"app_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO :"app_user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO :"app_user";
SQL

echo "Bootstrap for app DB user '${app_user}' completed."
