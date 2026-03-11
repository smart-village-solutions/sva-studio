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
    cat "$_file"
  fi
}

val=$(load_secret sva_studio_app_auth_client_secret)
[ -n "$val" ] && export SVA_AUTH_CLIENT_SECRET="$val"

val=$(load_secret sva_studio_app_auth_state_secret)
[ -n "$val" ] && export SVA_AUTH_STATE_SECRET="$val"

val=$(load_secret sva_studio_app_encryption_key)
[ -n "$val" ] && export ENCRYPTION_KEY="$val"

val=$(load_secret sva_studio_app_pii_keyring_json)
[ -n "$val" ] && export IAM_PII_KEYRING_JSON="$val"

val=$(load_secret sva_studio_app_db_password)
[ -n "$val" ] && export APP_DB_PASSWORD="$val"

val=$(load_secret sva_studio_keycloak_admin_client_secret)
[ -n "$val" ] && export KEYCLOAK_ADMIN_CLIENT_SECRET="$val"

# IAM_DATABASE_URL aus Einzelkomponenten zusammenbauen,
# falls noch nicht explizit gesetzt.
if [ -z "${IAM_DATABASE_URL:-}" ] && [ -n "${APP_DB_PASSWORD:-}" ]; then
  export IAM_DATABASE_URL="postgres://${APP_DB_USER:-sva_app}:${APP_DB_PASSWORD}@postgres:5432/${POSTGRES_DB:-sva_studio}"
fi

exec "$@"
