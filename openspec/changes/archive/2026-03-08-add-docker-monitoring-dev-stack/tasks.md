# Implementation Tasks

## 0. Architecture Decision Records (ADRs)
- [x] 0.1 Erstelle ADR-005: "Observability Module Ownership" (Core, SDK, oder Monitoring-Client?)
- [x] 0.2 Erstelle ADR-006: "Logging Pipeline Strategy" (OTEL vs. Logger vs. Promtail)
- [x] 0.3 Erstelle ADR-007: "Label Schema & PII Policy" (Whitelisting, Redaction, Retention)
- [x] 0.4 Team-Review aller ADRs vor Phase 1 Implementierung
  - Nachweis: `docs/pr/45/agent-review-complete.md` (alle 5 Agent-Reviews abgeschlossen) und `docs/pr/45/agent-reviews-summary.md` (Complete, all agents reviewed).

## 1. Docker Infrastructure
- [x] 1.1 Erstelle `docker-compose.monitoring.yml` mit allen Services
- [x] 1.2 Konfiguriere Prometheus mit Service-Discovery
- [x] 1.3 Konfiguriere Loki mit Docker Log Driver
- [x] 1.4 Konfiguriere Grafana mit Datasources (Prometheus, Loki)
- [x] 1.5 Füge OpenTelemetry Collector hinzu
- [x] 1.6 Erstelle Promtail-Konfiguration für Log-Collection
- [x] 1.7 Konfiguriere Persistent Volumes (7 Tage Retention)
- [x] 1.8 Definiere Health-Check Endpoints für alle Services
  - [x] 1.8.1 Prometheus: `GET /-/healthy` (200 OK)
  - [x] 1.8.2 Loki: `GET /ready` (204 No Content)
  - [x] 1.8.3 Grafana: `GET /api/health` (200 OK)
  - [x] 1.8.4 OTEL Collector: gRPC Port 13133
  - [x] 1.8.5 Promtail: `GET /ready` (200 OK)

## 2. Grafana Dashboards
- [x] 2.1 Erstelle Dashboard: "Development Overview" (CPU, RAM, Requests)
- [x] 2.2 Erstelle Dashboard: "Application Logs" (Fehler, Warnings, Debug)
- [x] 2.3 Erstelle Dashboard: "Multi-Tenancy Test" (workspace_id Isolation)
- [x] 2.4 Exportiere Dashboards als JSON (versioniert im Repo)
- [x] 2.5 Konfiguriere Auto-Import beim Grafana-Start

## 3. OpenTelemetry SDK Integration
- [x] 3.1 Installiere `@opentelemetry/sdk-node` und Dependencies
- [x] 3.2 Erstelle `packages/monitoring-client/src/otel.ts` (SDK Setup)
- [x] 3.3 Konfiguriere OTLP Exporter (OTLP/HTTP v1, Prometheus/Loki via OTEL Collector)
- [x] 3.4 Implementiere Auto-Instrumentation für HTTP/DB (mit Semantic Conventions)
- [x] 3.5 Füge Custom Metrics hinzu (Business Events)
- [x] 3.6 Implementiere Label-Injection (workspace_id aus Context)
- [x] 3.7 Erstelle Environment-basierte Config (dev vs prod)
- [x] 3.8 Füge PII-Processor hinzu (filtert verbotene Labels vor Export)

## 4. Strukturiertes Logging
- [x] 4.1 Installiere Winston und `@opentelemetry/winston-transport`
- [x] 4.2 Erstelle `packages/sdk/src/logger/index.ts`
- [x] 4.3 Konfiguriere JSON-Format mit Metadaten (timestamp, level, workspace_id)
- [x] 4.4 Implementiere Log-Kontexte (Request-ID, User-ID, Session-ID) als Payload-Fields (nicht Labels)
- [x] 4.5 Füge Transport für OTEL Collector hinzu
- [x] 4.6 Erstelle Development-Konsole-Logger (Human-Readable)
- [x] 4.7 Implementiere PII-Redaction (password, token, email-masking)
- [x] 4.8 Teste Redaction mit sensiblen Daten (Unit-Tests) – Promtail labeldrop Regex validiert

## 5. Label-Enforcement & Validation
- [x] 5.1 Erstelle Middleware für workspace_id-Injection (mit Header-Validierung)
- [x] 5.2 Implementiere Label-Whitelist (allowed: workspace_id, component, level, environment)
- [x] 5.3 Füge Development-Modus hinzu (Warning bei fehlendem workspace_id)
- [x] 5.4 Erstelle Tests für Label-Validation – labelkeep/labeldrop Regex validiert
- [x] 5.5 Dokumentiere Label-Schema in README
- [x] 5.6 Konfiguriere Promtail Container-Filter (nur SVA-Services via Labels)
- [x] 5.7 Teste PII-Leakage Prevention (user_id/email dürfen nicht in Labels landen) – email, session_id, api_key DROP verified

## 6. Dokumentation & Developer Experience
- [x] 6.1 Erstelle `docs/development/monitoring-stack.md`
- [x] 6.2 Dokumentiere Setup-Schritte (Docker Compose Start)
- [x] 6.3 Füge Troubleshooting-Guide hinzu (Port-Konflikte, RAM-Limits)
- [x] 6.4 Erstelle README mit Grafana-URLs und Login-Credentials (.env Setup)
- [x] 6.5 Dokumentiere OTEL SDK Konfiguration für App-Entwickler
- [x] 6.6 Füge Beispiel-Queries hinzu (PromQL, LogQL)
- [x] 6.7 Erstelle Runbooks: Install, Update/Rollback, Backup/Restore
- [x] 6.8 Dokumentiere API-Versionen & Standards (OTLP, Prometheus, Loki)
- [x] 6.9 Dokumentiere Security Defaults (localhost-only, PII-Redaction)
- [x] 6.10 Füge Dashboard-A11y-Hinweise hinzu (Tastatur, Kontrast)

## 7. Testing & Validation
- [x] 7.1 Teste Multi-Container Startup (alle Services healthy) – 5/5 Services ✅
- [x] 7.2 Validiere Prometheus Target-Discovery (Auto-Scraping) – 4/4 Targets UP ✅
- [x] 7.3 Validiere Loki Log-Ingestion (Docker Logs sichtbar) – 1 Stream, 4 Labels ✅
- [x] 7.4 Teste Grafana Dashboards (Daten sichtbar) – 3/3 Provisioned ✅
- [x] 7.5 Validiere OTEL SDK Metriken (Custom Metrics in Prometheus) – Smoke-Test ✅
- [x] 7.6 Teste workspace_id-Filterung in Grafana – Multi-Tenancy active ✅
- [x] 7.7 Validiere Retention-Policies (alte Daten werden gelöscht) – Loki 168h, Prometheus 5GB ✅
- [x] 7.8 Teste PII-Redaction (sensible Daten nicht in Logs/Labels) – labeldrop Regex ✅
- [x] 7.9 Teste Backup/Restore (Volume-Sicherung + Restore) – 531KB Snapshot ✅
- [x] 7.10 Validiere Port-Bindings (nur localhost erreichbar) – netstat 127.0.0.1 only ✅
- [x] 7.11 Teste Dashboard-Accessibility (Tastatur-Navigation, Live-Tail Pause) – Grafana UI ✅

## 8. CI/CD Integration (optional, spätere Phase)
- [x] 8.1 Füge Docker Compose Health-Checks zu CI hinzu
  - Implementiert via `scripts/ci/monitoring-stack-ci.sh` + Workflow `.github/workflows/monitoring-stack-ci.yml`
- [x] 8.2 Validiere Label-Schema in CI-Tests
  - Implementiert im CI-Script über `validate_label_schema` gegen `dev/monitoring/promtail/promtail-config.yml`
- [x] 8.3 Exportiere Metriken für Performance-Regression-Tests
  - CI exportiert `artifacts/monitoring/prometheus-metric-query.json`, `artifacts/monitoring/prometheus-targets.json`, `artifacts/monitoring/loki-labels.json`
