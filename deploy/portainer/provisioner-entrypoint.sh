#!/usr/bin/env sh
set -eu

require_env() {
  key="$1"
  eval "value=\${$key:-}"
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

if [ "$#" -eq 0 ]; then
  set -- node --import ./otel-bootstrap.mjs node_modules/@sva/auth/dist/iam-instance-registry/worker.js
fi

exec "$@"
