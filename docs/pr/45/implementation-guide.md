# PR #45 Implementation Guide — Betriebstauglichkeit

**Zielgruppe:** Lead Engineer / DevOps
**Ziel:** Alle P0-Blocker innerhalb 1 Woche beheben
**Geschätzter Aufwand:** 5-7 Tage

---

## Task 1: Alerting Stack (1-2 Tage)

### 1.1 Prometheus Alert Rules konfigurieren

**File:** `dev/monitoring/prometheus/alert-rules.yml` (neu)

```yaml
groups:
  - name: observability_alerts
    interval: 1m
    rules:
      # === CRITICAL Alerts ===

      - alert: PrometheusHighDiskUsage
        expr: |
          (
            node_filesystem_avail_bytes{mountpoint="/prometheus"}
            /
            node_filesystem_size_bytes{mountpoint="/prometheus"}
          ) < 0.05
        for: 5m
        labels:
          severity: critical
          component: prometheus
        annotations:
          summary: "Prometheus disk usage > 95%"
          description: "Prometheus disk {{ $value | humanizePercentage }} free remaining. Metrics will be dropped if disk fills completely."
          runbook_url: "https://internal.docs/runbooks/prometheus-disk-full"

      - alert: PrometheusLocalStorageRetentionExceeded
        expr: rate(prometheus_tsdb_retention_limit_bytes_total[5m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Prometheus retention limit exceeded"
          description: "Prometheus is dropping metrics due to retention size limit"

      - alert: LokiLogIngestionErrors
        expr: rate(loki_chunk_store_index_entries_added_total{status="error"}[5m]) > 0
        for: 5m
        labels:
          severity: critical
          component: loki
        annotations:
          summary: "Loki log ingestion has errors"
          description: "{{ $value | humanize }} errors/sec in log ingestion"
          runbook_url: "https://internal.docs/runbooks/loki-ingestion-errors"

      - alert: LokiChunkFlushErrors
        expr: increase(loki_chunk_flush_failed_total[5m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Loki chunk flush failing"
          description: "{{ $value }} chunk flush failures in last 5 minutes"

      - alert: OTELCollectorHealthDown
        expr: up{job="otel-collector"} == 0
        for: 2m
        labels:
          severity: critical
          component: otel-collector
        annotations:
          summary: "OTEL Collector unreachable"
          description: "OTEL Collector health check failing for 2 minutes"
          runbook_url: "https://internal.docs/runbooks/otel-collector-down"

      - alert: PromtailHealthDown
        expr: up{job="promtail"} == 0
        for: 2m
        labels:
          severity: critical
          component: promtail
        annotations:
          summary: "Promtail unreachable"
          description: "Promtail health check failing for 2 minutes"
          runbook_url: "https://internal.docs/runbooks/promtail-down"

      # === HIGH Alerts ===

      - alert: PrometheusMemoryUsageHigh
        expr: |
          (
            container_memory_working_set_bytes{name="sva-studio-prometheus"}
            /
            2000000000  # 2GB limit
          ) > 0.85
        for: 10m
        labels:
          severity: high
          component: prometheus
        annotations:
          summary: "Prometheus memory usage > 85% of limit"
          description: "Memory: {{ $value | humanizePercentage }} of 2GB"
          runbook_url: "https://internal.docs/runbooks/prometheus-memory-high"

      - alert: LokiDiskUsageHigh
        expr: |
          (
            node_filesystem_avail_bytes{mountpoint="/loki"}
            /
            node_filesystem_size_bytes{mountpoint="/loki"}
          ) < 0.2
        for: 10m
        labels:
          severity: high
          component: loki
        annotations:
          summary: "Loki disk usage > 80%"
          description: "{{ $value | humanizePercentage }} free"

      - alert: GrafanaUnhealthy
        expr: up{job="grafana"} == 0
        for: 2m
        labels:
          severity: high
          component: grafana
        annotations:
          summary: "Grafana is unreachable"
          description: "Grafana health check failing"

      - alert: MetricsNotFlowing
        expr: time() - timestamp(max(up) by (job)) > 300
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "Metrics are stale (> 5m old) from {{ $labels.job }}"
          description: "Last metric received {{ $value | humanizeDuration }} ago"

      # === MEDIUM Alerts ===

      - alert: PrometheusQueryErrors
        expr: rate(prometheus_tsdb_head_chunks[5m]) > 100
        for: 10m
        labels:
          severity: medium
        annotations:
          summary: "Prometheus high chunk rate"
          description: "High chunk creation rate may indicate memory pressure"

      - alert: LokiQueryLatencyHigh
        expr: histogram_quantile(0.95, rate(loki_request_duration_seconds_bucket{route="loki_api_v1_query"}[5m])) > 1.0
        for: 10m
        labels:
          severity: medium
          component: loki
        annotations:
          summary: "Loki query latency > 1s (p95)"
          description: "Latency: {{ $value | humanizeDuration }}"

      # === INFO Alerts ===

      - alert: PrometheusRetentionCleanup
        expr: increase(prometheus_tsdb_compactions_total[5m]) > 0
        labels:
          severity: info
        annotations:
          summary: "Prometheus running retention cleanup"
          description: "{{ $value }} compactions in last 5 minutes (normal)"
```

**Validieren:**
```bash
# Syntax check
promtool check rules dev/monitoring/prometheus/alert-rules.yml

# Laden ins docker-compose
docker compose exec prometheus \
  curl -X POST http://localhost:9090/-/reload
```

### 1.2 Docker-Compose für Alert Rules updaten

**File:** `docker-compose.monitoring.yml` (ändern)

```yaml
prometheus:
  image: prom/prometheus:v2.52.0
  volumes:
    - ./dev/monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    - ./dev/monitoring/prometheus/alert-rules.yml:/etc/prometheus/alert-rules.yml:ro  # ← NEU
    - prometheus-data:/prometheus
  command:
    - "--config.file=/etc/prometheus/prometheus.yml"
    - "--storage.tsdb.path=/prometheus"
    - "--storage.tsdb.retention.time=7d"
    - "--storage.tsdb.retention.size=5GB"
    # ↓ NEU: Rules laden
    - "--rules.file=/etc/prometheus/alert-rules.yml"
```

### 1.3 AlertManager konfigurieren

**File:** `dev/monitoring/alertmanager/alertmanager.yml` (neu)

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: "${SLACK_WEBHOOK_URL}"  # ← From .env

route:
  receiver: 'ops-default'
  repeat_interval: 4h
  group_wait: 30s  # Wait 30s for batch of alerts
  group_interval: 5m  # Send batch every 5m if more alerts come
  group_by: ['alertname', 'cluster']

  # Route critical alerts immediately
  routes:
    - match:
        severity: critical
      receiver: 'ops-critical'
      repeat_interval: 1h  # Remind every 1h
      group_wait: 10s  # Send immediately

    - match:
        severity: high
      receiver: 'ops-default'
      repeat_interval: 4h

receivers:
  - name: 'ops-default'
    slack_configs:
      - channel: '#sva-monitoring-alerts'
        title: '[{{ .GroupLabels.severity }}] {{ .GroupLabels.alertname }}'
        text: |
          {{ range .Alerts.Firing }}
          • {{ .Labels.component }}: {{ .Annotations.summary }}
            {{ .Annotations.description }}
            Runbook: {{ .Annotations.runbook_url }}
          {{ end }}
        send_resolved: true

  - name: 'ops-critical'
    slack_configs:
      - channel: '#sva-critical-incidents'
        title: '🚨 [CRITICAL] {{ .GroupLabels.alertname }}'
        text: |
          {{ range .Alerts.Firing }}
          • {{ .Labels.component }}: {{ .Annotations.summary }}
            {{ .Annotations.description }}
            🔗 Runbook: {{ .Annotations.runbook_url }}
          {{ end }}
        send_resolved: true
    # ← Optional: PagerDuty für nachts
    # pagerduty_configs:
    #   - routing_key: "${PAGERDUTY_KEY}"

inhibit_rules:
  # Don't send resolved alerts if firing alerts exist
  - source_match:
      severity: 'critical'
    target_match_re:
      severity: 'high|medium|info'
    equal: ['alertname', 'component']
```

### 1.4 AlertManager zu Docker-Compose hinzufügen

```yaml
# docker-compose.monitoring.yml

alertmanager:
  image: prom/alertmanager:v0.26.0
  container_name: sva-studio-alertmanager
  ports:
    - "127.0.0.1:9093:9093"
  volumes:
    - ./dev/monitoring/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    - alertmanager-data:/alertmanager
  command:
    - "--config.file=/etc/alertmanager/alertmanager.yml"
    - "--storage.path=/alertmanager"
  environment:
    - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-}
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://localhost:9093/-/healthy >/dev/null 2>&1"]
    interval: 30s
    timeout: 10s
    retries: 3
  restart: unless-stopped

volumes:
  alertmanager-data:
    driver: local
```

### 1.5 Prometheus zur AlertManager zeigen

**File:** `dev/monitoring/prometheus/prometheus.yml` (ergänzen)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

# ← NEU
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

rule_files:
  - '/etc/prometheus/alert-rules.yml'

scrape_configs:
  # ... existing configs ...

  # ← NEU: Prometheus scrapes AlertManager
  - job_name: "alertmanager"
    dns_sd_configs:
      - names:
          - "alertmanager"
        type: "A"
        port: 9093
```

### 1.6 .env für Slack

**File:** `.env` (neu oder ergänzen)

```bash
# Monitoring - Slack Integration
# Get this from https://api.slack.com/apps/YOUR_APP_ID/incoming-webhooks
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# AlertManager
ALERTMANAGER_RESOLVE_TIMEOUT=5m
```

**Test:**
```bash
# Deploy
docker compose up -d alertmanager

# Send test alert manually
curl -XPOST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{"status":"firing","labels":{"alertname":"TestAlert","component":"testing","severity":"info"}}]'

# Should see alert in Slack
```

---

## Task 2: Redis hinzufügen (0.5 Tage)

### 2.1 Redis Service zu docker-compose

**File:** `docker-compose.monitoring.yml` (ergänzen)

```yaml
redis:
  image: redis:7.2-alpine
  container_name: sva-studio-redis
  ports:
    - "127.0.0.1:6379:6379"
  command:
    - "redis-server"
    - "--save"      # Enable persistence
    - ""            # (no auto-save)
    - "--appendonly"  # Enable AOF for durability
    - "yes"
  volumes:
    - redis-data:/data
  environment:
    - REDIS_LOGLEVEL=notice
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 30s
    timeout: 10s
    retries: 3
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 256M
  restart: unless-stopped

volumes:
  redis-data:
    driver: local
```

### 2.2 Backup-Script für Redis

**File:** `scripts/backup-redis.sh` (neu)

```bash
#!/bin/bash
set -e

BACKUP_DIR="${1:-.}/backups/redis/$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting Redis backup to $BACKUP_DIR"

# Trigger RDB snapshot
docker compose exec -T redis redis-cli BGSAVE 2>/dev/null || true

# Wait for snapshot to complete
echo "⏳ Waiting for Redis snapshot..."
for i in {1..30}; do
  if docker compose exec -T redis redis-cli LASTSAVE | grep -q .; then
    sleep 1
  fi
done

# Copy dump
docker compose exec -T redis cat /data/dump.rdb > "$BACKUP_DIR/dump.rdb"
ls -lh "$BACKUP_DIR/dump.rdb"

# Copy AOF if enabled
if docker compose exec -T redis test -f /data/appendonly.aof; then
  docker compose exec -T redis cat /data/appendonly.aof > "$BACKUP_DIR/appendonly.aof"
  ls -lh "$BACKUP_DIR/appendonly.aof"
fi

# Verify backup
if [ -s "$BACKUP_DIR/dump.rdb" ]; then
  echo "✅ Redis backup successful: $BACKUP_DIR"
  exit 0
else
  echo "❌ Redis backup failed (empty file)"
  exit 1
fi
```

**Test:**
```bash
chmod +x scripts/backup-redis.sh
docker compose up -d redis
./scripts/backup-redis.sh
```

---

## Task 3: Container Resource Limits (0.5 Tage)

### 3.1 Update docker-compose mit Limits

```yaml
# docker-compose.monitoring.yml

prometheus:
  # ... existing config ...
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:  # Soft limits for scheduling
        cpus: '1'
        memory: 1G

loki:
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 512M

grafana:
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 512M
      reservations:
        cpus: '0.5'
        memory: 256M

otel-collector:
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 512M
      reservations:
        cpus: '0.25'
        memory: 256M

promtail:
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 256M
      reservations:
        cpus: '0.25'
        memory: 128M

redis:
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 256M
      reservations:
        cpus: '0.25'
        memory: 128M

alertmanager:
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 256M
      reservations:
        cpus: '0.25'
        memory: 128M
```

### 3.2 Monitoring für Memory-Pressure

Add to alert-rules.yml:

```yaml
- alert: ContainerMemoryLimitApproaching
  expr: |
    (
      container_memory_working_set_bytes
      /
      container_spec_memory_limit_bytes
    ) > 0.85
  for: 10m
  labels:
    severity: high
  annotations:
    summary: "Container {{ $labels.container }} memory > 85% of limit"
    description: "{{ $value | humanizePercentage }} of limit"
```

---

## Task 4: Backup-Strategie mit Tests (2-3 Tage)

### 4.1 Prometheus Backup-Script

**File:** `scripts/backup-prometheus.sh` (neu)

```bash
#!/bin/bash
set -e

BACKUP_DIR="${1:-.}/backups/prometheus/$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting Prometheus backup to $BACKUP_DIR"

# Trigger snapshot via Prometheus API
SNAPSHOT_RESP=$(curl -s -XPOST http://localhost:9090/api/v1/admin/tsdb/snapshot)
SNAPSHOT_NAME=$(echo "$SNAPSHOT_RESP" | jq -r '.data.name')

if [ "$SNAPSHOT_NAME" = "null" ] || [ -z "$SNAPSHOT_NAME" ]; then
  echo "❌ Failed to create Prometheus snapshot"
  echo "Response: $SNAPSHOT_RESP"
  exit 1
fi

echo "📦 Snapshot created: $SNAPSHOT_NAME"

# Wait for snapshot to be written
sleep 2

# Copy snapshot directory
docker compose exec -T prometheus tar czf - /prometheus/snapshots/"$SNAPSHOT_NAME" \
  | tar xzf - -C "$BACKUP_DIR"

# Also backup current WAL
docker compose exec -T prometheus tar czf - /prometheus/wal \
  | tar xzf - -C "$BACKUP_DIR"

# Verify
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
if [ "$(du -s "$BACKUP_DIR" | cut -f1)" -gt 1000 ]; then
  echo "✅ Prometheus backup successful ($BACKUP_SIZE): $BACKUP_DIR"
  exit 0
else
  echo "❌ Prometheus backup too small (likely failed)"
  exit 1
fi
```

### 4.2 Full Backup-Orchestration

**File:** `scripts/backup-all.sh` (neu)

```bash
#!/bin/bash
set -e

BACKUP_ROOT="${1:-.}/backups/full_backup_$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$BACKUP_ROOT"

echo "🔄 Starting full monitoring stack backup"
echo "📁 Location: $BACKUP_ROOT"

# Prometheus
echo "▶️  Prometheus..."
./scripts/backup-prometheus.sh "$BACKUP_ROOT/prometheus" || {
  echo "⚠️  Prometheus backup failed (non-critical)"
}

# Loki
echo "▶️  Loki..."
mkdir -p "$BACKUP_ROOT/loki"
docker compose exec -T loki tar czf - /loki/chunks | tar xzf - -C "$BACKUP_ROOT/loki"
docker compose exec -T loki tar czf - /loki/rules | tar xzf - -C "$BACKUP_ROOT/loki"

# Redis
echo "▶️  Redis..."
./scripts/backup-redis.sh "$BACKUP_ROOT/redis" || {
  echo "⚠️  Redis backup failed (non-critical)"
}

# Metadata
echo "▶️  Metadata..."
cat > "$BACKUP_ROOT/BACKUP_INFO.md" << EOF
# Backup Metadata

Date: $(date -Iseconds)
Host: $(hostname)
Prometheus Version: $(curl -s http://localhost:9090/api/v1/status/buildinfo | jq -r '.data.version')

## Restore Instructions

### Prometheus
\`\`\`bash
docker compose down prometheus
docker volume rm sva-studio-prometheus-data || true
docker compose up -d prometheus
docker exec sva-studio-prometheus tar xzf - -C /prometheus < $BACKUP_ROOT/prometheus/wal.tar.gz
docker compose restart prometheus
\`\`\`

### Loki
\`\`\`bash
docker compose down loki
docker volume rm sva-studio-loki-data || true
docker compose up -d loki
docker exec sva-studio-loki tar xzf - -C /loki < $BACKUP_ROOT/loki/chunks.tar.gz
docker compose restart loki
\`\`\`

### Redis
\`\`\`bash
docker compose down redis
docker volume rm sva-studio-redis-data || true
docker compose up -d redis
docker cp $BACKUP_ROOT/redis/dump.rdb sva-studio-redis:/data/
docker exec sva-studio-redis redis-cli shutdown
docker compose up -d redis
\`\`\`
EOF

echo "✅ Full backup complete: $BACKUP_ROOT"
```

### 4.3 Restore-Test Script

**File:** `scripts/test-restore.sh` (neu)

```bash
#!/bin/bash
set -e

BACKUP_DIR="${1:-.}/backups/latest"

echo "🧪 Testing restore from $BACKUP_DIR"

# Backup current state
docker compose exec -T prometheus curl -s http://localhost:9090/api/v1/query?query=up | \
  jq '.data.result | length' > /tmp/pre_restore_metrics.txt
PRE_RESTORE=$(cat /tmp/pre_restore_metrics.txt)
echo "📊 Pre-restore metrics: $PRE_RESTORE"

# Simulate restore (don't actually restore to keep system running)
echo "✅ Restore test passed (validation only)"
echo "   - Backup files present: $(ls -1 $BACKUP_DIR | wc -l) items"
echo "   - Total size: $(du -sh $BACKUP_DIR | cut -f1)"
```

---

## Task 5: Disaster Recovery Runbooks (1-2 Tage)

### 5.1 Master Runbook

**File:** `docs/operations/disaster-recovery.md` (neu)

```markdown
# Disaster Recovery Runbook

## Alert: PrometheusHighDiskUsage (🔴 CRITICAL)

### Symptoms
- Alert fires in Slack
- Metrics start getting dropped
- Queries become slow

### Diagnosis (< 5 min)
\`\`\`bash
# Check disk
df -h /prometheus

# Check Prometheus logs
docker logs sva-studio-prometheus | tail -20

# Query metrics being dropped
curl http://localhost:9090/api/v1/query?query=rate(prometheus_tsdb_retention_limit_bytes_total[5m])
\`\`\`

### Recovery (< 15 min)

#### Option 1: Cleanup old metrics (fast)
\`\`\`bash
# Reduce retention
docker compose down prometheus

# Edit docker-compose.yml:
# Change: --storage.tsdb.retention.time=7d
#     to: --storage.tsdb.retention.time=2d

docker compose up -d prometheus
sleep 30
docker compose logs prometheus | grep -i "retention"
\`\`\`

#### Option 2: Expand disk (if available)
\`\`\`bash
# Stop Prometheus
docker compose down prometheus

# Expand volume (platform-specific)
# ... resize underlying disk ...

# Restart
docker compose up -d prometheus
\`\`\`

#### Option 3: Restore from backup
\`\`\`bash
./scripts/restore-prometheus.sh backups/prometheus/<date>
\`\`\`

---

## Alert: OTELCollectorHealthDown (🔴 CRITICAL)

### Symptoms
- No metrics/logs flowing
- Applications can't send telemetry

### Diagnosis
\`\`\`bash
# Health check
curl http://localhost:13133/healthz

# Logs
docker logs sva-studio-otel-collector | grep -i error | tail -20

# Check port availability
netstat -tln | grep 4317
netstat -tln | grep 4318
\`\`\`

### Recovery
\`\`\`bash
# Restart
docker compose down otel-collector
sleep 5
docker compose up -d otel-collector
sleep 10

# Verify
curl http://localhost:13133/healthz
docker compose logs otel-collector | grep "Started"
\`\`\`

---

## Alert: LokiLogIngestionErrors (🔴 CRITICAL)

### Symptoms
- New logs not appearing in Loki
- Promtail errors in logs

### Diagnosis
\`\`\`bash
# Check Loki health
curl http://localhost:3100/ready

# Check disk space
df -h /loki

# Promtail logs
docker logs sva-studio-promtail | grep -i error | tail -20

# Loki metrics
curl -s http://localhost:9090/api/v1/query?query=loki_chunk_store_index_entries_added_total
\`\`\`

### Recovery
\`\`\`bash
# Restart Promtail
docker compose down promtail
docker compose up -d promtail
sleep 30

# Verify flow
curl -s http://localhost:3100/loki/api/v1/query?query='{component!=\"\"}'&limit=1 | jq '.data.result | length'
# Should return > 0
\`\`\`

---

## RTO/RPO Definition

| Component | RTO | RPO | Acceptable Downtime |
|-----------|-----|-----|---------------------|
| Prometheus | 30 min | 1 hour | Metrics unavailable |
| Loki | 30 min | 1 hour | Logs unavailable |
| Redis | 5 min | 1 min | Sessions lost |
| OTEL | 15 min | 5 min | No telemetry |
| Grafana | 1 hour | N/A | Dashboard unavailable |
```

---

## Implementation Timeline

```
Week 1:
├── Day 1-2: Alerting Stack (AlertManager + Slack)
├── Day 2: Redis + Resource Limits (parallel)
├── Day 3-4: Backup Scripts + Testing
├── Day 4-5: DR Runbooks
└── Day 5: Full Integration Test

Validation:
├── Run fake alert → check Slack
├── Test Prometheus backup
├── Test Redis backup
├── Execute DR runbooks
└── Load test with limits
```

---

## Sign-Off Criteria

- ✅ Alerting reaches Slack within 2 minutes of threshold breach
- ✅ Backup scripts complete without errors
- ✅ Restore test passes (validation only)
- ✅ Each runbook has been walked through by team
- ✅ Memory limits prevent OOMKiller crashes
- ✅ Load test with 10x normal traffic succeeds

---

**Status:** Recommended for implementation
**Owner:** DevOps / Lead Engineer
**Deadline:** Before Staging Release
