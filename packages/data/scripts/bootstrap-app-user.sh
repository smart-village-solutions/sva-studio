#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${POSTGRES_DB:-sva_studio}"
POSTGRES_USER="${POSTGRES_USER:-sva}"
IAM_DATABASE_URL="${IAM_DATABASE_URL:-}"

if [ -z "${IAM_DATABASE_URL}" ]; then
  echo "IAM_DATABASE_URL is required."
  exit 1
fi

if [ -z "$(docker compose ps -q postgres)" ]; then
  echo "Postgres container is not running. Start it with: pnpm nx run data:db:up"
  exit 1
fi

app_user="$(node -e "const url = new URL(process.argv[1]); process.stdout.write(decodeURIComponent(url.username));" "${IAM_DATABASE_URL}")"
app_password="$(node -e "const url = new URL(process.argv[1]); process.stdout.write(decodeURIComponent(url.password));" "${IAM_DATABASE_URL}")"

if [ -z "${app_user}" ] || [ -z "${app_password}" ]; then
  echo "IAM_DATABASE_URL must include username and password."
  exit 1
fi

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${app_user}') THEN
    EXECUTE format(
      'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT',
      '${app_user}',
      '${app_password}'
    );
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN INHERIT PASSWORD %L', '${app_user}', '${app_password}');
  END IF;
END
\$\$;

GRANT iam_app TO "${app_user}";
GRANT USAGE ON SCHEMA iam TO "${app_user}";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO "${app_user}";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO "${app_user}";
SQL

echo "Bootstrap for app DB user '${app_user}' completed."
