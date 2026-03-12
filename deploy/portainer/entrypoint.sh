#!/bin/sh
set -eu

# ---------------------------------------------------------------------------
# Swarm-Secrets in Umgebungsvariablen laden.
#
# Im Swarm-Modus liegen Secrets als Dateien unter /run/secrets/.
# Dieser Entrypoint liest sie vor dem App-Start in Env-Variablen ein.
# Ohne /run/secrets (z. B. lokaler Docker-Build) bleibt das Skript ein No-Op,
# da die Variablen dann bereits über die environment-Sektion gesetzt sind.
# ---------------------------------------------------------------------------

load_secret() {
  _file="/run/secrets/$1"
  if [ -f "$_file" ]; then
    # Command substitution entfernt finale Newlines; optionales CR aus CRLF wird danach entfernt.
    _value=$(cat "$_file")
    _cr=$(printf '\r')
    case "$_value" in
      *"$_cr") _value=${_value%"$_cr"} ;;
    esac
    printf '%s' "$_value"
  fi
}

require_env() {
  _name="$1"
  eval "_value=\${$_name:-}"
  if [ -z "$_value" ]; then
    echo "Required secret $_name is not set." >&2
    exit 1
  fi
}

urlencode() {
  node -e 'process.stdout.write(encodeURIComponent(process.argv[1] ?? ""))' "$1"
}

val=$(load_secret sva_studio_app_auth_client_secret)
[ -n "$val" ] && export SVA_AUTH_CLIENT_SECRET="$val"

val=$(load_secret sva_studio_app_auth_state_secret)
[ -n "$val" ] && export SVA_AUTH_STATE_SECRET="$val"

val=$(load_secret sva_studio_app_encryption_key)
[ -n "$val" ] && export ENCRYPTION_KEY="$val"

val=$(load_secret sva_studio_app_pii_keyring_json-k1)
[ -n "$val" ] && export IAM_PII_KEYRING_JSON=$(printf '{"k1":"%s"}' "$val")

val=$(load_secret sva_studio_app_db_password)
[ -n "$val" ] && export APP_DB_PASSWORD="$val"

val=$(load_secret sva_studio_redis_password)
[ -n "$val" ] && export REDIS_PASSWORD="$val"

val=$(load_secret sva_studio_keycloak_admin_client_secret)
[ -n "$val" ] && export KEYCLOAK_ADMIN_CLIENT_SECRET="$val"

has_expected_swarm_secret_file() {
  for _secret_name in \
    sva_studio_app_auth_client_secret \
    sva_studio_app_auth_state_secret \
    sva_studio_app_encryption_key \
    sva_studio_app_pii_keyring_json-k1 \
    sva_studio_app_db_password \
    sva_studio_redis_password
  do
    if [ -f "/run/secrets/${_secret_name}" ]; then
      return 0
    fi
  done
  return 1
}

if has_expected_swarm_secret_file; then
  require_env SVA_AUTH_CLIENT_SECRET
  require_env SVA_AUTH_STATE_SECRET
  require_env ENCRYPTION_KEY
  require_env IAM_PII_KEYRING_JSON
  require_env APP_DB_PASSWORD
  require_env REDIS_PASSWORD
fi

# IAM_DATABASE_URL aus Einzelkomponenten zusammenbauen,
# falls noch nicht explizit gesetzt.
if [ -z "${IAM_DATABASE_URL:-}" ] && [ -n "${APP_DB_PASSWORD:-}" ]; then
  db_password_encoded=$(urlencode "${APP_DB_PASSWORD}")
  export IAM_DATABASE_URL="postgres://${APP_DB_USER:-sva_app}:${db_password_encoded}@postgres:5432/${POSTGRES_DB:-sva_studio}"
fi

if [ -z "${REDIS_URL:-}" ]; then
  if [ -n "${REDIS_PASSWORD:-}" ]; then
    redis_password_encoded=$(urlencode "${REDIS_PASSWORD}")
    export REDIS_URL="redis://:${redis_password_encoded}@redis:6379"
  else
    export REDIS_URL="redis://redis:6379"
  fi
fi

exec "$@"
