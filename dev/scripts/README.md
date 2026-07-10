# Monitoring Stack Scripte

Dieses Verzeichnis enthält Backup/Restore und Maintenance-Scripte für den Monitoring Stack.

## 📋 Verfügbare Scripte

### 🔄 Backup & Restore

#### `backup-monitoring.sh`
Erstellt einen vollständigen Snapshot des Monitoring Stacks.

**Features:**
- Prometheus TSDB Snapshot via Admin API
- Loki BoltDB Index + Chunks
- AlertManager Daten
- SHA256 Checksums für Integrität
- Automatische Rotation (> 30 Tage)

**Usage:**
```bash
# Manuelles Backup
./dev/scripts/backup-monitoring.sh

# Mit custom Backup-Verzeichnis
BACKUP_DIR=/mnt/backups ./dev/scripts/backup-monitoring.sh

# Tägliches Backup via Cron (02:00 UTC)
0 2 * * * /path/to/sva-studio/dev/scripts/backup-monitoring.sh >> /var/log/sva-backup.log 2>&1
```

**Output:**
```
./backups/
└── monitoring-backup-20260208_120000/
    ├── prometheus-snapshot.tar.gz
    ├── prometheus-snapshot.tar.gz.sha256
    ├── loki-data.tar.gz
    ├── loki-data.tar.gz.sha256
    ├── alertmanager-data.tar.gz
    ├── alertmanager-data.tar.gz.sha256
    └── backup-metadata.json
```

---

#### `restore-monitoring.sh`
Stellt den Monitoring Stack aus einem Backup wieder her.

**⚠️ WARNUNG:** Löscht aktuelle Daten! Backup zuerst!

**Usage:**
```bash
# Restore von lokalem Backup
./dev/scripts/restore-monitoring.sh ./backups/monitoring-backup-20260208_120000

# Restore von S3 (TODO: nicht implementiert)
# aws s3 cp s3://sva-backups/monitoring-backup-20260208_120000 ./backups/ --recursive
# ./dev/scripts/restore-monitoring.sh ./backups/monitoring-backup-20260208_120000
```

**Schritte:**
1. Stoppt Monitoring Stack (`docker compose down`)
2. Löscht alte Volumes
3. Validiert Checksums
4. Entpackt Backups in neue Volumes
5. Startet Stack neu
6. Führt Health Checks durch

---

## 🚀 Quick Start

### Erstes Backup erstellen
```bash
# 1. Monitoring Stack sollte laufen
docker compose -f compose.monitoring.yaml ps

# 2. Backup erstellen
./dev/scripts/backup-monitoring.sh

# 3. Backup-Verzeichnis prüfen
ls -lh backups/
```

### Restore testen
```bash
# 1. Testdaten generieren (optional)
# ... (Prometheus Metriken sammeln lassen)

# 2. Backup erstellen
./dev/scripts/backup-monitoring.sh

# 3. Restore durchführen
./dev/scripts/restore-monitoring.sh ./backups/monitoring-backup-YYYYMMDD_HHMMSS

# 4. Verifizieren
open http://localhost:3001  # Grafana
```

---

## 📊 Monitoring der Backups

### Backup-Status via Prometheus

**TODO:** Pushgateway Integration (siehe docs/staging/2026-02/staging-todos.md)

Aktuell: Manuell via Logs prüfen
```bash
# Letztes Backup-Log
tail -100 /var/log/sva-backup.log

# Backup-Größe
du -sh backups/
```

### Alerts bei fehlgeschlagenen Backups

**TODO:** Alert-Rule hinzufügen (siehe docs/staging/2026-02/staging-todos.md)

---

## 🔧 Troubleshooting

### Backup schlägt fehl: "Prometheus Snapshot failed"

**Ursache:** Admin API nicht aktiviert

**Lösung:**
```yaml
# compose.monitoring.yaml
prometheus:
  command:
    - "--web.enable-admin-api"  # ← muss gesetzt sein
```

Neu starten:
```bash
docker compose -f compose.monitoring.yaml restart prometheus
```

---

### Restore schlägt fehl: "Checksum mismatch"

**Ursache:** Backup korrumpiert

**Lösung:**
1. Anderen Backup versuchen
2. Checksum manuell prüfen:
   ```bash
   cd backups/monitoring-backup-YYYYMMDD_HHMMSS
   sha256sum -c prometheus-snapshot.tar.gz.sha256
   ```
3. Falls alle Backups korrumpiert: Neu anfangen (Datenverlust)

---

### Container startet nach Restore nicht

**Debugging:**
```bash
# Logs prüfen
docker logs sva-studio-prometheus

# Volume-Inhalt prüfen
docker run --rm -v sva-studio_prometheus-data:/prometheus alpine ls -la /prometheus

# Permissions fixen
docker run --rm -v sva-studio_prometheus-data:/prometheus alpine chown -R 65534:65534 /prometheus
```

---

## 📁 Backup-Retention

**Standard:** 30 Tage (automatisch gelöscht)

**Custom Retention:**
```bash
# In backup-monitoring.sh Zeile 102 anpassen:
find "${BACKUP_DIR}" -maxdepth 1 -type d -name "monitoring-backup-*" -mtime +90 -exec rm -rf {} \;
#                                                                              ^^^ Tage
```

---

## 🔐 Security Best Practices

1. **Backups verschlüsseln** (für Production):
   ```bash
   # GPG-Verschlüsselung
   tar -czf - "${BACKUP_PATH}" | gpg --encrypt --recipient ops@sva-studio.de > backup.tar.gz.gpg
   ```

2. **S3 Server-Side Encryption**:
   ```bash
   aws s3 cp backup.tar.gz s3://bucket/ --sse AES256
   ```

3. **Access Control**:
   ```bash
   chmod 700 dev/scripts/*.sh
   chown root:root dev/scripts/*.sh
   ```

---

## ⏱️ Performance

### Backup-Zeiten (Durchschnitt)

| Service | Datenmenge | Dauer |
|---------|------------|-------|
| Prometheus (7d) | 500MB–2GB | 30–60s |
| Loki (7d) | 200MB–1GB | 20–40s |
| AlertManager | < 10MB | 5s |
| **Total** | **1–3GB** | **~2 Min** |

### Restore-Zeiten

| Service | Dauer |
|---------|-------|
| Volumes löschen | 5–10s |
| Entpacken | 30–90s |
| Container Start | 10–20s |
| Health Checks | 10–20s |
| **Total** | **~2 Min** |

---

## 🎯 Nächste Schritte

Siehe [docs/staging/2026-02/staging-todos.md](../../docs/staging/2026-02/staging-todos.md):

- [ ] S3/MinIO Integration
- [ ] Automatisierte Cron-Jobs
- [ ] Backup Monitoring (Prometheus Metric)
- [ ] Wöchentliche Restore-Tests
- [ ] Slack Notifications bei Backup-Fehlern

---

**Erstellt:** 2026-02-08
**Getestet:** ✅ Lokal (macOS, Docker Desktop)
**Production-ready:** ⏳ Nach S3-Integration
