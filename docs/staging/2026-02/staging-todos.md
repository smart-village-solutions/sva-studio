# Staging/Production TODOs – Monitoring Stack

Dieses Dokument listet alle Features auf, die **vorbereitet** aber **noch nicht implementiert** sind, weil externe Services (Slack, S3) fehlen.

---

## 🔔 Alerting (AlertManager)

**Status:** ✅ Lokal vorbereitet, ⏳ Externe Integration TODO

### Was funktioniert (Lokal):
- ✅ AlertManager läuft auf `http://localhost:9093`
- ✅ Prometheus sendet Alerts an AlertManager
- ✅ Alert-Rules definiert (siehe `dev/monitoring/prometheus/alert-rules.yml`)
- ✅ Webhook-Receiver konfiguriert (localhost:5001)

### Was fehlt (Staging/Production):

#### TODO 1: Slack Integration
**Datei:** `dev/monitoring/alertmanager/alertmanager.yml`

```yaml
# Zeile 35–40: Slack Webhook hinzufügen
receivers:
  - name: 'critical-alerts'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/HERE'
        channel: '#monitoring-alerts'
        title: '🚨 Critical Alert: {{ .GroupLabels.alertname }}'
        text: |
          {{ range .Alerts }}
          *Summary:* {{ .Annotations.summary }}
          *Description:* {{ .Annotations.description }}
          *Workspace:* {{ .Labels.workspace_id }}
          {{ end }}
        send_resolved: true
```

**Schritte:**
1. Slack App erstellen: https://api.slack.com/apps
2. Incoming Webhook aktivieren
3. Webhook URL in `.env` setzen: `SLACK_WEBHOOK_URL=...`
4. `alertmanager.yml` mit `${SLACK_WEBHOOK_URL}` anpassen
5. AlertManager neu starten: `docker compose -f compose.monitoring.yaml restart alertmanager`

**Test:**
```bash
# Fake-Alert senden
curl -X POST http://localhost:9093/api/v2/alerts -H "Content-Type: application/json" -d '[
  {
    "labels": {"alertname": "TestAlert", "severity": "critical"},
    "annotations": {"summary": "Test Alert", "description": "Dies ist ein Test"}
  }
]'

# Slack sollte Nachricht erhalten
```

---

#### TODO 2: Email Notifications (Warnings)
**Datei:** `dev/monitoring/alertmanager/alertmanager.yml`

```yaml
# Zeile 45–50: Email SMTP hinzufügen
global:
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alertmanager@sva-studio.de'
  smtp_auth_username: '${SMTP_USERNAME}'
  smtp_auth_password: '${SMTP_PASSWORD}'

receivers:
  - name: 'warning-alerts'
    email_configs:
      - to: 'ops@sva-studio.de'
        headers:
          Subject: '⚠️ Warning Alert: {{ .GroupLabels.alertname }}'
```

**Schritte:**
1. SMTP-Server konfigurieren (z.B. SendGrid, AWS SES, Mailgun)
2. Credentials in `.env` setzen
3. `alertmanager.yml` aktualisieren
4. Test-Email senden (siehe oben)

---

#### TODO 3: PagerDuty Integration (Production)
**Datei:** `dev/monitoring/alertmanager/alertmanager.yml`

Für 24/7 On-Call Rotation:

```yaml
receivers:
  - name: 'critical-alerts'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
        description: '{{ .GroupLabels.alertname }} - {{ .Annotations.summary }}'
```

**Schritte:**
1. PagerDuty Account erstellen
2. Integration Key generieren
3. `.env` updaten: `PAGERDUTY_SERVICE_KEY=...`
4. AlertManager neu starten

---

## 💾 Backup & Restore

**Status:** ✅ Lokal vorbereitet, ⏳ S3 Integration TODO

### Was funktioniert (Lokal):
- ✅ Backup-Script: `dev/scripts/backup-monitoring.sh`
- ✅ Restore-Script: `dev/scripts/restore-monitoring.sh`
- ✅ Snapshots von Prometheus, Loki, AlertManager
- ✅ Checksums (SHA256) für Integrität
- ✅ Automatische Rotation (> 30 Tage löschen)

### Was fehlt (Staging/Production):

#### TODO 4: S3/MinIO Upload
**Datei:** `dev/scripts/backup-monitoring.sh` (Zeile 95–96)

```bash
# Aktuell: Nur lokale Backups
# TODO: S3 Upload hinzufügen

# AWS S3 (wenn Production auf AWS)
aws s3 cp "${BACKUP_PATH}" "s3://sva-monitoring-backups/${BACKUP_NAME}" --recursive

# ODER: MinIO (Self-Hosted S3-kompatibel)
mc cp --recursive "${BACKUP_PATH}" minio/sva-backups/${BACKUP_NAME}
```

**Schritte:**
1. S3 Bucket erstellen: `sva-monitoring-backups`
2. IAM User mit S3 Permissions erstellen
3. AWS CLI konfigurieren: `aws configure`
4. Script-Kommentar entfernen (Zeile 95)
5. Cron-Job einrichten (siehe unten)

---

#### TODO 5: Automatisierte Backups (Cron)
**Ziel:** Täglich um 02:00 UTC Backup durchführen

**Datei:** `/etc/cron.d/sva-monitoring-backup` (auf Host-Server)

```bash
# Daily Backup at 2 AM UTC
0 2 * * * /path/to/sva-studio/dev/scripts/backup-monitoring.sh >> /var/log/sva-backup.log 2>&1
```

**Alternative: SystemD Timer** (für moderne Linux Systeme)

```ini
# /etc/systemd/system/sva-backup.timer
[Unit]
Description=SVA Monitoring Daily Backup

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target

# /etc/systemd/system/sva-backup.service
[Unit]
Description=SVA Monitoring Backup Service

[Service]
Type=oneshot
ExecStart=/path/to/sva-studio/dev/scripts/backup-monitoring.sh
```

**Aktivieren:**
```bash
sudo systemctl enable sva-backup.timer
sudo systemctl start sva-backup.timer
sudo systemctl list-timers  # Verify
```

---

#### TODO 6: Backup Monitoring (Prometheus Metric)
**Ziel:** Überwachen ob Backups erfolgreich laufen

**Datei:** `dev/scripts/backup-monitoring.sh` (am Ende hinzufügen)

```bash
# Prometheus Pushgateway Metric
cat <<EOF | curl --data-binary @- http://localhost:9091/metrics/job/backup
# TYPE sva_backup_duration_seconds gauge
sva_backup_duration_seconds{service="monitoring"} ${BACKUP_DURATION}
# TYPE sva_backup_size_bytes gauge
sva_backup_size_bytes{service="monitoring"} $(du -sb "${BACKUP_PATH}" | cut -f1)
# TYPE sva_backup_timestamp gauge
sva_backup_timestamp{service="monitoring"} $(date +%s)
EOF
```

**Prometheus Alert hinzufügen:**

```yaml
# dev/monitoring/prometheus/alert-rules.yml
- alert: BackupFailed
  expr: |
    (time() - sva_backup_timestamp{service="monitoring"}) > 86400 * 2
  for: 1h
  labels:
    severity: critical
  annotations:
    summary: "Backup seit > 48h nicht durchgeführt"
    description: "Letzter Backup-Timestamp: {{ $value }}s ago"
```

---

#### TODO 7: Restore Testing (Wöchentlich)
**Ziel:** Automatisierte Restore-Tests in Dev-Umgebung

**Datei:** `dev/scripts/test-restore.sh` (neu erstellen)

```bash
#!/usr/bin/env bash
# Wöchentlicher Restore-Test in separate Docker-Umgebung

# 1. Neuesten Backup finden
LATEST_BACKUP=$(ls -td backups/monitoring-backup-* | head -1)

# 2. Test-Compose starten
docker compose -f docker-compose.monitoring-test.yml up -d

# 3. Restore durchführen
./dev/scripts/restore-monitoring.sh "${LATEST_BACKUP}"

# 4. Data Integrity Check
# ... (Metriken vergleichen)

# 5. Aufräumen
docker compose -f docker-compose.monitoring-test.yml down
```

**Cron:**
```bash
# Weekly Restore Test (Sonntag 03:00)
0 3 * * 0 /path/to/sva-studio/dev/scripts/test-restore.sh >> /var/log/sva-restore-test.log 2>&1
```

---

## 📊 Resource Monitoring

**Status:** ✅ Implementiert (compose.monitoring.yaml)

### Was funktioniert:
- ✅ Memory Limits: Prometheus (1GB), Loki (512MB), Grafana (512MB)
- ✅ CPU Limits gesetzt
- ✅ Alerts bei > 80% Memory Usage

### Was fehlt (Nice-to-Have):

#### TODO 8: cAdvisor Integration (Container Metriken)
**Ziel:** Detaillierte Container-Resource-Metriken

**Datei:** `compose.monitoring.yaml` (Service hinzufügen)

```yaml
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.47.0
    container_name: sva-studio-cadvisor
    ports:
      - "127.0.0.1:8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    restart: unless-stopped
```

**Prometheus Config:**
```yaml
# dev/monitoring/prometheus/prometheus.yml
scrape_configs:
  - job_name: "cadvisor"
    static_configs:
      - targets: ["cadvisor:8080"]
```

---

## 📝 Deployment Checkliste

### Staging Environment

- [ ] **Alerting**
  - [ ] Slack Webhook konfiguriert
  - [ ] Test-Alert erfolgreich empfangen
  - [ ] Email SMTP konfiguriert

- [ ] **Backup**
  - [ ] S3 Bucket erstellt
  - [ ] Cron-Job eingerichtet
  - [ ] Restore-Test durchgeführt
  - [ ] Backup-Monitoring aktiv

- [ ] **Monitoring**
  - [ ] cAdvisor deployed (optional)
  - [ ] Resource Alerts getestet
  - [ ] Dashboards zugänglich

### Production Environment

- [ ] **High Availability**
  - [ ] Redis Cluster/Sentinel für Sessions
  - [ ] Prometheus Federation oder Grafana Mimir
  - [ ] AlertManager Cluster (3 Nodes)

- [ ] **Security**
  - [ ] TLS für alle Services
  - [ ] Authentifizierung für Grafana (OAuth2/SSO)
  - [ ] Network Policies (Kubernetes)

- [ ] **Compliance**
  - [ ] Backup-Retention Policy dokumentiert
  - [ ] DSGVO: Logs > 90 Tage löschen
  - [ ] Audit-Log für Admin-Zugriffe

---

## 🔗 Hilfreiche Links

- **Prometheus Alerting:** https://prometheus.io/docs/alerting/latest/configuration/
- **Slack Incoming Webhooks:** https://api.slack.com/messaging/webhooks
- **AWS S3 CLI:** https://docs.aws.amazon.com/cli/latest/reference/s3/
- **MinIO Client:** https://min.io/docs/minio/linux/reference/minio-mc.html
- **cAdvisor:** https://github.com/google/cadvisor

---

**Erstellt:** 2026-02-08
**Nächstes Review:** Bei Staging-Deployment
**Owner:** DevOps/SRE Team
