#!/usr/bin/env bash
#
# Backup Script für Monitoring Stack (Lokal)
# Erstellt Snapshots von Prometheus, Loki und AlertManager Daten
#
# TODO: Für Staging/Production:
# - S3/MinIO Integration hinzufügen
# - Automatisierte Rotation (> 30 Tage löschen)
# - Monitoring via Prometheus Metric (sva_backup_duration_seconds)
# - Email-Notification bei Backup-Fehlern
#

set -euo pipefail

# Kompatibilität: macOS verwendet 'shasum -a 256' statt 'sha256sum'
if ! command -v sha256sum &> /dev/null; then
    sha256sum() {
        shasum -a 256 "$@"
    }
fi

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Konfiguration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="monitoring-backup-${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Docker Container Namen
PROMETHEUS_CONTAINER="sva-studio-prometheus"
LOKI_CONTAINER="sva-studio-loki"
ALERTMANAGER_CONTAINER="sva-studio-alertmanager"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Backup-Verzeichnis erstellen
mkdir -p "${BACKUP_PATH}"
log "Erstelle Backup in: ${BACKUP_PATH}"

# 1. Prometheus Snapshot erstellen
log "Erstelle Prometheus Snapshot..."
if docker exec "${PROMETHEUS_CONTAINER}" wget -qO- --post-data='' http://localhost:9090/api/v1/admin/tsdb/snapshot > /tmp/prom-snapshot.json; then
    SNAPSHOT_NAME=$(cat /tmp/prom-snapshot.json | sed -n 's/.*"name":"\([^"]*\)".*/\1/p')
    log "Snapshot erstellt: ${SNAPSHOT_NAME}"

    # Snapshot kopieren
    docker cp "${PROMETHEUS_CONTAINER}:/prometheus/snapshots/${SNAPSHOT_NAME}" "${BACKUP_PATH}/prometheus-snapshot"

    # Checksum erstellen
    tar -czf "${BACKUP_PATH}/prometheus-snapshot.tar.gz" -C "${BACKUP_PATH}" prometheus-snapshot
    rm -rf "${BACKUP_PATH}/prometheus-snapshot"

    sha256sum "${BACKUP_PATH}/prometheus-snapshot.tar.gz" > "${BACKUP_PATH}/prometheus-snapshot.tar.gz.sha256"
    log "✓ Prometheus Backup erfolgreich ($(du -sh "${BACKUP_PATH}/prometheus-snapshot.tar.gz" | cut -f1))"
else
    error "Prometheus Snapshot fehlgeschlagen"
    exit 1
fi

# 2. Loki Daten kopieren
log "Kopiere Loki Daten..."
if docker cp "${LOKI_CONTAINER}:/loki" "${BACKUP_PATH}/loki-data"; then
    tar -czf "${BACKUP_PATH}/loki-data.tar.gz" -C "${BACKUP_PATH}" loki-data
    rm -rf "${BACKUP_PATH}/loki-data"

    sha256sum "${BACKUP_PATH}/loki-data.tar.gz" > "${BACKUP_PATH}/loki-data.tar.gz.sha256"
    log "✓ Loki Backup erfolgreich ($(du -sh "${BACKUP_PATH}/loki-data.tar.gz" | cut -f1))"
else
    warn "Loki Backup fehlgeschlagen (Container läuft möglicherweise nicht)"
fi

# 3. AlertManager Daten kopieren
log "Kopiere AlertManager Daten..."
if docker cp "${ALERTMANAGER_CONTAINER}:/alertmanager" "${BACKUP_PATH}/alertmanager-data"; then
    tar -czf "${BACKUP_PATH}/alertmanager-data.tar.gz" -C "${BACKUP_PATH}" alertmanager-data
    rm -rf "${BACKUP_PATH}/alertmanager-data"

    sha256sum "${BACKUP_PATH}/alertmanager-data.tar.gz" > "${BACKUP_PATH}/alertmanager-data.tar.gz.sha256"
    log "✓ AlertManager Backup erfolgreich ($(du -sh "${BACKUP_PATH}/alertmanager-data.tar.gz" | cut -f1))"
else
    warn "AlertManager Backup fehlgeschlagen (Container läuft möglicherweise nicht)"
fi

# Backup-Metadata erstellen
cat > "${BACKUP_PATH}/backup-metadata.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "backup_name": "${BACKUP_NAME}",
  "services": {
    "prometheus": "$(docker inspect ${PROMETHEUS_CONTAINER} --format='{{.Config.Image}}' 2>/dev/null || echo 'N/A')",
    "loki": "$(docker inspect ${LOKI_CONTAINER} --format='{{.Config.Image}}' 2>/dev/null || echo 'N/A')",
    "alertmanager": "$(docker inspect ${ALERTMANAGER_CONTAINER} --format='{{.Config.Image}}' 2>/dev/null || echo 'N/A')"
  },
  "host": "$(hostname)",
  "size_bytes": $(find "${BACKUP_PATH}" -type f -print0 | xargs -0 stat -f%z | awk '{s+=$1} END {print s}')
}
EOF

# Gesamtgröße ausgeben
TOTAL_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
log "✓ Backup abgeschlossen: ${BACKUP_PATH} (${TOTAL_SIZE})"

# TODO: S3 Upload
# aws s3 cp "${BACKUP_PATH}" "s3://sva-monitoring-backups/${BACKUP_NAME}" --recursive

# Alte Backups löschen (> 30 Tage)
log "Lösche alte Backups (> 30 Tage)..."
find "${BACKUP_DIR}" -maxdepth 1 -type d -name "monitoring-backup-*" -mtime +30 -exec rm -rf {} \;

log "Backup erfolgreich abgeschlossen ✓"
