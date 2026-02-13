# Monitoring Stack (lokal)

Dieses Dokument beschreibt den lokalen Observability-Stack für die Entwicklung mit Docker Compose.

Architektur-Referenz: [Logging Architecture](../architecture/logging-architecture.md)

## Überblick

Der Stack besteht aus:
- Prometheus (Metriken)
- Loki (Logs)
- Grafana (Dashboards)
- OpenTelemetry Collector (OTLP Hub)
- Promtail (Container-Log-Sammlung)

Alle Services sind **lokal** gebunden (localhost) und nutzen eine **7-Tage-Retention**.

## Setup

1. Optional: `.env` anlegen (siehe .env.example), z. B.:
   - `GF_SECURITY_ADMIN_PASSWORD=dev-admin`
2. Start:
   - Kombiniertes Setup: `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d`
3. Health-Checks:
   - Prometheus: http://localhost:9090/-/healthy
   - Loki: http://localhost:3100/ready
   - Grafana: http://localhost:3001/api/health
   - OTEL Collector: http://localhost:13133/healthz
   - Promtail: http://localhost:3101/ready

## URLs & Credentials

- Grafana: http://localhost:3001
  - User: `admin`
  - Passwort: `.env` → `GF_SECURITY_ADMIN_PASSWORD`

## Dashboards (Auto-Import)

Die Dashboards werden beim Start automatisch aus dem Repo geladen:

- `dev/monitoring/grafana/dashboards/development-overview.json`
- `dev/monitoring/grafana/dashboards/application-logs.json`
- `dev/monitoring/grafana/dashboards/multi-tenancy-test.json`

## OTEL SDK (App-Integration)

Beispiel für die Initialisierung:

```ts
import { startOtelSdk } from '@sva/monitoring-client';

await startOtelSdk({
  serviceName: 'sva-studio-backend',
  environment: process.env.NODE_ENV ?? 'development',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
});
```

Custom Metrics (Business Events):

```ts
import { recordBusinessEvent } from '@sva/monitoring-client';

recordBusinessEvent('content.published', {
  workspace_id: 'local-dev',
  component: 'cms'
});
```

## Label-Schema (Whitelist)

Erlaubte Labels:
- `workspace_id` (mandatory)
- `component`
- `environment`
- `level`

Verbotene Labels (PII / High Cardinality):
- `user_id`, `session_id`, `email`, `request_id`, `token`, `authorization`, `api_key`, `secret`, `ip`

## PII-Redaction

- Token, Passwörter und Secrets werden redacted.
- E-Mails werden maskiert.
- Request-/User-/Session-IDs werden als Payload geführt, nicht als Labels.

## Beispiel-Queries

**PromQL:**
- Requests/s: `sum(rate(http_requests_total[5m])) by (job)`
- CPU: `sum(rate(process_cpu_seconds_total[5m])) by (job)`

**LogQL:**
- Alle Logs: `{component=~".+"}`
- Errors (5m): `sum(count_over_time({level="error"}[5m]))`
- Logs je Workspace: `sum(count_over_time({workspace_id=~".+"}[5m])) by (workspace_id)`

## Standards & Versionen

- OTLP/HTTP v1
- Prometheus Remote Scrape
- Loki Push API v1

## Security Defaults

- Alle Ports sind an `localhost` gebunden.
- Keine externen Ingresses.
- PII-Redaction aktiv.
- Label-Whitelist enforced.

## Troubleshooting

**Port-Konflikte**
- Prüfen, ob Ports 3001/3100/9090/4317/4318 belegt sind.

**Hoher RAM-Verbrauch**
- Prüfen, ob Docker Desktop ausreichend RAM hat (>= 4 GB empfohlen).

**Grafana zeigt keine Daten**
- Datasources prüfen (Prometheus/Loki erreichbar?)
- Health-Checks abrufen.

**Loki meldet „entry too far behind“**
- Ursache: Promtail liest alte Container-Logs mit Zeitstempeln außerhalb des akzeptierten Loki-Fensters.
- Aktuelle Schutzmaßnahme: `drop`-Stage in `dev/monitoring/promtail/promtail-config.yml` mit `older_than: 1h`.
- Wirkung: Alte Backfill-Zeilen werden vor dem Push verworfen; neue Logs werden normal ingestiert.

## Runbooks

**Install**
- `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d`

**Update/Rollback**
- Update: `docker compose pull && docker compose up -d`
- Rollback: `docker compose down` und `docker compose up -d` mit vorherigem Image-Tag

**Backup/Restore**
- Prometheus/Loki nutzen lokale Volumes.
- Sicherung: `docker volume inspect` + `docker run --rm -v <volume>:/data -v $PWD:/backup alpine tar -czf /backup/<name>.tgz /data`
- Restore: `docker run --rm -v <volume>:/data -v $PWD:/backup alpine tar -xzf /backup/<name>.tgz -C /`

## Dashboard-A11y

- Tastatur-Navigation über Grafana-UI möglich.
- Kontrast über Grafana Theme Settings anpassen.
- Live-Tail kann pausiert werden (Barrierefreiheit).
