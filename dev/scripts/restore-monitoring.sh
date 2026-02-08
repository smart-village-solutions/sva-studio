#!/usr/bin/env bash
#
# Restore Script für Monitoring Stack
# Stellt Prometheus, Loki und AlertManager Daten wieder her
#
# Usage: ./restore-monitoring.sh <backup-path>
# Beispiel: ./restore-monitoring.sh ./backups/monitoring-backup-20260208_120000
#
# TODO: Für Staging/Production:
# - S3/MinIO Download Integration
# - Validierung der Backup-Integrität vor Restore
# - Rollback-Mechanismus bei fehlgeschlagenem Restore
#

set -euo pipefail

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Argument Check
if [ $# -eq 0 ]; then
    error "Kein Backup-Pfad angegeben"
    echo "Usage: $0 <backup-path>"
    echo "Beispiel: $0 ./backups/monitoring-backup-20260208_120000"
    exit 1
fi

BACKUP_PATH="$1"

if [ ! -d "${BACKUP_PATH}" ]; then
    error "Backup-Verzeichnis nicht gefunden: ${BACKUP_PATH}"
    exit 1
fi

log "Restore von: ${BACKUP_PATH}"

# Metadata lesen
if [ -f "${BACKUP_PATH}/backup-metadata.json" ]; then
    log "Backup-Metadata:"
    cat "${BACKUP_PATH}/backup-metadata.json"
else
    warn "Keine backup-metadata.json gefunden"
fi

# Bestätigung
read -p "Monitoring Stack stoppen und Restore durchführen? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "Restore abgebrochen"
    exit 0
fi

# Docker Compose Projekt-Verzeichnis
COMPOSE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
log "Docker Compose Verzeichnis: ${COMPOSE_DIR}"

# 1. Monitoring Stack stoppen
log "Stoppe Monitoring Stack..."
cd "${COMPOSE_DIR}"
docker compose -f docker-compose.monitoring.yml down

# 2. Volumes löschen
log "Lösche alte Daten..."
docker volume rm sva-studio_prometheus-data sva-studio_loki-data sva-studio_alertmanager-data 2>/dev/null || true

# 3. Volumes neu erstellen
log "Erstelle neue Volumes..."
docker volume create sva-studio_prometheus-data
docker volume create sva-studio_loki-data
docker volume create sva-studio_alertmanager-data

# 4. Prometheus Restore
if [ -f "${BACKUP_PATH}/prometheus-snapshot.tar.gz" ]; then
    log "Stelle Prometheus Daten wieder her..."
    
    # Checksum validieren
    if [ -f "${BACKUP_PATH}/prometheus-snapshot.tar.gz.sha256" ]; then
        cd "${BACKUP_PATH}"
        if sha256sum -c prometheus-snapshot.tar.gz.sha256; then
            log "✓ Prometheus Checksum OK"
        else
            error "Prometheus Checksum fehlgeschlagen!"
            exit 1
        fi
        cd -
    fi
    
    # Temporären Container starten
    docker run --rm -v sva-studio_prometheus-data:/prometheus -v "${BACKUP_PATH}":/backup alpine sh -c "
        cd /prometheus && 
        tar -xzf /backup/prometheus-snapshot.tar.gz --strip-components=1
    "
    log "✓ Prometheus Daten wiederhergestellt"
else
    warn "Kein Prometheus Backup gefunden"
fi

# 5. Loki Restore
if [ -f "${BACKUP_PATH}/loki-data.tar.gz" ]; then
    log "Stelle Loki Daten wieder her..."
    
    # Checksum validieren
    if [ -f "${BACKUP_PATH}/loki-data.tar.gz.sha256" ]; then
        cd "${BACKUP_PATH}"
        if sha256sum -c loki-data.tar.gz.sha256; then
            log "✓ Loki Checksum OK"
        else
            error "Loki Checksum fehlgeschlagen!"
            exit 1
        fi
        cd -
    fi
    
    docker run --rm -v sva-studio_loki-data:/loki -v "${BACKUP_PATH}":/backup alpine sh -c "
        cd /loki && 
        tar -xzf /backup/loki-data.tar.gz --strip-components=1
    "
    log "✓ Loki Daten wiederhergestellt"
else
    warn "Kein Loki Backup gefunden"
fi

# 6. AlertManager Restore
if [ -f "${BACKUP_PATH}/alertmanager-data.tar.gz" ]; then
    log "Stelle AlertManager Daten wieder her..."
    
    # Checksum validieren
    if [ -f "${BACKUP_PATH}/alertmanager-data.tar.gz.sha256" ]; then
        cd "${BACKUP_PATH}"
        if sha256sum -c alertmanager-data.tar.gz.sha256; then
            log "✓ AlertManager Checksum OK"
        else
            error "AlertManager Checksum fehlgeschlagen!"
            exit 1
        fi
        cd -
    fi
    
    docker run --rm -v sva-studio_alertmanager-data:/alertmanager -v "${BACKUP_PATH}":/backup alpine sh -c "
        cd /alertmanager && 
        tar -xzf /backup/alertmanager-data.tar.gz --strip-components=1
    "
    log "✓ AlertManager Daten wiederhergestellt"
else
    warn "Kein AlertManager Backup gefunden"
fi

# 7. Monitoring Stack starten
log "Starte Monitoring Stack..."
cd "${COMPOSE_DIR}"
docker compose -f docker-compose.monitoring.yml up -d

# 8. Health Checks
log "Warte auf Health Checks..."
sleep 10

# Prometheus
if docker exec sva-studio-prometheus wget -qO- http://localhost:9090/-/healthy >/dev/null 2>&1; then
    log "✓ Prometheus healthy"
else
    error "Prometheus health check fehlgeschlagen"
fi

# Loki
if docker exec sva-studio-loki wget -qO- http://localhost:3100/ready >/dev/null 2>&1; then
    log "✓ Loki ready"
else
    warn "Loki health check fehlgeschlagen"
fi

# AlertManager
if docker exec sva-studio-alertmanager wget -qO- http://localhost:9093/-/healthy >/dev/null 2>&1; then
    log "✓ AlertManager healthy"
else
    warn "AlertManager health check fehlgeschlagen"
fi

log "✓ Restore erfolgreich abgeschlossen"
log "Monitoring Stack läuft wieder unter:"
log "  - Prometheus: http://localhost:9090"
log "  - Loki: http://localhost:3100"
log "  - Grafana: http://localhost:3001"
log "  - AlertManager: http://localhost:9093"
