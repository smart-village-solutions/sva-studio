#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[migrate-entrypoint] %s\n' "$*"
}

require_env() {
  local key="$1"
  if [ -z "${!key:-}" ]; then
    log "Pflichtvariable fehlt: ${key}"
    exit 1
  fi
}

require_env POSTGRES_DB
require_env POSTGRES_USER
require_env POSTGRES_PASSWORD

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
GOOSE_WRAPPER="${GOOSE_WRAPPER:-packages/data/scripts/goosew.sh}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-packages/data/migrations}"
GOOSE_CONFIG_PATH="${GOOSE_CONFIG_PATH:-packages/data/goose.config.json}"

if [ ! -x "${GOOSE_WRAPPER}" ]; then
  log "Goose-Wrapper nicht gefunden oder nicht ausführbar: ${GOOSE_WRAPPER}"
  exit 1
fi

if [ ! -d "${MIGRATIONS_DIR}" ]; then
  log "Migrationsverzeichnis fehlt: ${MIGRATIONS_DIR}"
  exit 1
fi

mkdir -p artifacts/tools/goose

db_string="postgres://${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable"
export PGPASSWORD="${POSTGRES_PASSWORD}"

goose_version="$(node -e "const fs=require('fs'); const cfg=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(cfg.version);" "${GOOSE_CONFIG_PATH}")"
log "Starte Goose-Migrationsjob mit ${goose_version} gegen ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

log "Wende Migrationen an"
"${GOOSE_WRAPPER}" -dir "${MIGRATIONS_DIR}" postgres "${db_string}" up

log "Lese finalen Goose-Status"
"${GOOSE_WRAPPER}" -dir "${MIGRATIONS_DIR}" postgres "${db_string}" status

log "Pruefe Migrationsstand und kritische IAM-Schemaobjekte"
node ./verify-iam-schema.mjs

case "${WASTE_TENANT_MIGRATIONS_ENABLED:-false}" in
  true)
    WASTE_TENANT_MIGRATOR="${WASTE_TENANT_MIGRATOR:-./migrate-waste-tenants.mjs}"
    if [ ! -f "${WASTE_TENANT_MIGRATOR}" ]; then
      log "Waste-Tenant-Migrator fehlt: ${WASTE_TENANT_MIGRATOR}"
      exit 1
    fi
    log "Wende ausstehende versionierte Waste-Tenant-Migrationen an"
    node "${WASTE_TENANT_MIGRATOR}"
    ;;
  false|'')
    log "Waste-Tenant-Migrationen sind für dieses Laufzeitprofil deaktiviert"
    ;;
  *)
    log "Ungültiger Wert für WASTE_TENANT_MIGRATIONS_ENABLED"
    exit 1
    ;;
esac

log "Migrationsjob erfolgreich abgeschlossen"
