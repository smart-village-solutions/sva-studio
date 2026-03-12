#!/bin/sh
set -eu

APP_DB_USER="${APP_DB_USER:-sva_app}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:-}"

case "${APP_DB_USER}" in
  ''|*[!A-Za-z0-9_]*)
    echo "APP_DB_USER must contain only letters, digits, and underscores."
    exit 1
    ;;
esac

if [ -z "${APP_DB_PASSWORD}" ]; then
  echo "APP_DB_PASSWORD must be set."
  exit 1
fi

APP_DB_PASSWORD_ESCAPED="$(printf "%s" "${APP_DB_PASSWORD}" | sed -e "s/'/''/g" -e 's/\\/\\\\/g')"

psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_DB_USER}') THEN
    EXECUTE 'CREATE ROLE ${APP_DB_USER} LOGIN PASSWORD ''${APP_DB_PASSWORD_ESCAPED}'' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT';
  ELSE
    EXECUTE 'ALTER ROLE ${APP_DB_USER} WITH LOGIN PASSWORD ''${APP_DB_PASSWORD_ESCAPED}'' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT';
  END IF;
END
\$\$;

GRANT iam_app TO ${APP_DB_USER};
SQL
