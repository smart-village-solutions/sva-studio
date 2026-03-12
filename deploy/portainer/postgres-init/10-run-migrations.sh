#!/bin/sh
set -eu

# Historisches Hilfsskript. Im Swarm-Referenzprofil wird dieses Skript
# nicht automatisch verwendet; Migrationen erfolgen bewusst manuell
# gemäß docs/guides/swarm-deployment-runbook.md.

if [ ! -d /opt/sva/migrations ]; then
  echo "Migration directory /opt/sva/migrations is missing."
  exit 1
fi

for migration in /opt/sva/migrations/*.sql; do
  if [ ! -e "${migration}" ]; then
    continue
  fi

  echo "Applying migration ${migration}"
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f "${migration}"
done
