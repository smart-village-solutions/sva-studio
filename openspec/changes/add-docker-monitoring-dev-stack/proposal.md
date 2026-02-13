# Change: Docker-basierter Monitoring Stack für lokale Entwicklung

## Why

Entwickler benötigen während der lokalen Entwicklung Zugang zu Logs und Metriken, um:
- Fehler schnell zu debuggen (strukturierte Logs mit Kontext)
- Performance-Probleme zu identifizieren (Response-Zeiten, Cache-Hit-Rates)
- Multi-Tenancy-Isolation zu testen (workspace_id-basierte Filterung)
- OpenTelemetry SDK Integration zu validieren

Aktuell fehlt ein lokales Observability-Setup, das die Produktionsumgebung (Prometheus + Loki + Grafana) widerspiegelt.

## What Changes

- Docker Compose Setup mit Prometheus, Loki, Grafana und OTEL Collector
- Vorkonfigurierte Dashboards für lokale Entwicklung
- Automatisches Log-Shipping von App-Containern via Promtail
- OpenTelemetry SDK Integration in SVA Studio Backend
- Label-Enforcement für workspace_id (Development-Modus: Warning statt Error)
- Persistente Volumes für Metriken/Logs (7 Tage Retention)
- Health-Check Endpoints für alle Komponenten:
  - Prometheus: `GET http://localhost:9090/-/healthy`
  - Loki: `GET http://localhost:3100/ready`
  - Grafana: `GET http://localhost:3001/api/health`
  - OTEL Collector: gRPC Health Check Port 13133
  - Promtail: `GET http://localhost:3101/ready`
- Dokumentation für lokales Setup und Troubleshooting
- PII-Redaction für Logs (keine User-IDs/Emails in Labels)
- Security Defaults (Auth, localhost-only bindings)
- ADRs für Observability Module Ownership, Logging Pipeline, Label-Schema & PII-Policy

**BREAKING**: Keine Breaking Changes für existierenden Code

**Risiken & Mitigationen**:
- 🔴 PII-Leakage: Redaction-Filter im Logger/OTEL Exporter verpflichtend
- 🟡 Docker-Lock-in: OTEL Collector als Abstraktionsschicht, Migrations-Doku
- 🟡 Doppelte Log-Pipelines: Promtail nur für Container ohne OTEL, klare Priorisierung

## Impact

- **Affected specs**: `monitoring-client` (neu)
- **Affected code**:
  - `docker-compose.yml` - neue Services hinzugefügt
  - `packages/monitoring-client/` - OTEL SDK Integration, Prometheus/Loki Clients (neu)
  - `packages/sdk/src/logger/` - Framework-agnostischer Logger mit OTEL Transport (neu)
  - `docs/development/monitoring-stack.md` - Setup & Runbooks (neu)
- **Infrastructure**: Lokale Docker-Umgebung benötigt ~2GB RAM zusätzlich
- **Developer Experience**: Einmaliges Setup (5 Minuten), danach automatisch verfügbar
- **ADRs benötigt**: Observability Module Ownership (Task 0.1), Logging Pipeline Strategy (Task 0.2), Label Schema & PII Policy (Task 0.3)
