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
DO \$\$
DECLARE
  v_app_user text := :'app_user';
  v_app_password text := :'app_password';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_app_user) THEN
    EXECUTE format(
      'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT',
      v_app_user,
      v_app_password
    );
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN INHERIT PASSWORD %L', v_app_user, v_app_password);
  END IF;

  EXECUTE format('GRANT iam_app TO %I', v_app_user);
  EXECUTE format('GRANT USAGE ON SCHEMA iam TO %I', v_app_user);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO %I', v_app_user);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO %I', v_app_user);
END
\$\$;
SQL

echo "Bootstrap for app DB user '${app_user}' completed."
