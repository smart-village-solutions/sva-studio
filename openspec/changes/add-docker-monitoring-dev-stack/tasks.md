# Implementation Tasks

## 0. Architecture Decision Records (ADRs)
- [ ] 0.1 Erstelle ADR-004: "Observability Module Ownership" (Core, SDK, oder Monitoring-Client?)
- [ ] 0.2 Erstelle ADR-005: "Logging Pipeline Strategy" (OTEL vs. Logger vs. Promtail)
- [ ] 0.3 Erstelle ADR-006: "Label Schema & PII Policy" (Whitelisting, Redaction, Retention)
- [ ] 0.4 Team-Review aller ADRs vor Phase 1 Implementierung

## 1. Docker Infrastructure
- [ ] 1.1 Erstelle `docker-compose.monitoring.yml` mit allen Services
- [ ] 1.2 Konfiguriere Prometheus mit Service-Discovery
- [ ] 1.3 Konfiguriere Loki mit Docker Log Driver
- [ ] 1.4 Konfiguriere Grafana mit Datasources (Prometheus, Loki)
- [ ] 1.5 Füge OpenTelemetry Collector hinzu
- [ ] 1.6 Erstelle Promtail-Konfiguration für Log-Collection
- [ ] 1.7 Konfiguriere Persistent Volumes (7 Tage Retention)
- [ ] 1.8 Definiere Health-Check Endpoints für alle Services
  - [ ] 1.8.1 Prometheus: `GET /-/healthy` (200 OK)
  - [ ] 1.8.2 Loki: `GET /ready` (204 No Content)
  - [ ] 1.8.3 Grafana: `GET /api/health` (200 OK)
  - [ ] 1.8.4 OTEL Collector: gRPC Port 13133
  - [ ] 1.8.5 Promtail: `GET /ready` (200 OK)

## 2. Grafana Dashboards
- [ ] 2.1 Erstelle Dashboard: "Development Overview" (CPU, RAM, Requests)
- [ ] 2.2 Erstelle Dashboard: "Application Logs" (Fehler, Warnings, Debug)
- [ ] 2.3 Erstelle Dashboard: "Multi-Tenancy Test" (workspace_id Isolation)
- [ ] 2.4 Exportiere Dashboards als JSON (versioniert im Repo)
- [ ] 2.5 Konfiguriere Auto-Import beim Grafana-Start

## 3. OpenTelemetry SDK Integration
- [ ] 3.1 Installiere `@opentelemetry/sdk-node` und Dependencies
- [ ] 3.2 Erstelle `packages/monitoring-client/src/otel.ts` (SDK Setup)
- [ ] 3.3 Konfiguriere OTLP Exporter (OTLP/HTTP v1, Prometheus/Loki via OTEL Collector)
- [ ] 3.4 Implementiere Auto-Instrumentation für HTTP/DB (mit Semantic Conventions)
- [ ] 3.5 Füge Custom Metrics hinzu (Business Events)
- [ ] 3.6 Implementiere Label-Injection (workspace_id aus Context)
- [ ] 3.7 Erstelle Environment-basierte Config (dev vs prod)
- [ ] 3.8 Füge PII-Processor hinzu (filtert verbotene Labels vor Export)

## 4. Strukturiertes Logging
- [ ] 4.1 Installiere Winston und `@opentelemetry/winston-transport`
- [ ] 4.2 Erstelle `packages/sdk/src/logger/index.ts`
- [ ] 4.3 Konfiguriere JSON-Format mit Metadaten (timestamp, level, workspace_id)
- [ ] 4.4 Implementiere Log-Kontexte (Request-ID, User-ID, Session-ID) als Payload-Fields (nicht Labels)
- [ ] 4.5 Füge Transport für OTEL Collector hinzu
- [ ] 4.6 Erstelle Development-Konsole-Logger (Human-Readable)
- [ ] 4.7 Implementiere PII-Redaction (password, token, email-masking)
- [ ] 4.8 Teste Redaction mit sensiblen Daten (Unit-Tests)

## 5. Label-Enforcement & Validation
- [ ] 5.1 Erstelle Middleware für workspace_id-Injection (mit Header-Validierung)
- [ ] 5.2 Implementiere Label-Whitelist (allowed: workspace_id, component, level, environment)
- [ ] 5.3 Füge Development-Modus hinzu (Warning bei fehlendem workspace_id)
- [ ] 5.4 Erstelle Tests für Label-Validation
- [ ] 5.5 Dokumentiere Label-Schema in README
- [ ] 5.6 Konfiguriere Promtail Container-Filter (nur SVA-Services via Labels)
- [ ] 5.7 Teste PII-Leakage Prevention (user_id/email dürfen nicht in Labels landen)

## 6. Dokumentation & Developer Experience
- [ ] 6.1 Erstelle `docs/development/monitoring-stack.md`
- [ ] 6.2 Dokumentiere Setup-Schritte (Docker Compose Start)
- [ ] 6.3 Füge Troubleshooting-Guide hinzu (Port-Konflikte, RAM-Limits)
- [ ] 6.4 Erstelle README mit Grafana-URLs und Login-Credentials (.env Setup)
- [ ] 6.5 Dokumentiere OTEL SDK Konfiguration für App-Entwickler
- [ ] 6.6 Füge Beispiel-Queries hinzu (PromQL, LogQL)
- [ ] 6.7 Erstelle Runbooks: Install, Update/Rollback, Backup/Restore
- [ ] 6.8 Dokumentiere API-Versionen & Standards (OTLP, Prometheus, Loki)
- [ ] 6.9 Dokumentiere Security Defaults (localhost-only, PII-Redaction)
- [ ] 6.10 Füge Dashboard-A11y-Hinweise hinzu (Tastatur, Kontrast)

## 7. Testing & Validation
- [ ] 7.1 Teste Multi-Container Startup (alle Services healthy)
- [ ] 7.2 Validiere Prometheus Target-Discovery (Auto-Scraping)
- [ ] 7.3 Validiere Loki Log-Ingestion (Docker Logs sichtbar)
- [ ] 7.4 Teste Grafana Dashboards (Daten sichtbar)
- [ ] 7.5 Validiere OTEL SDK Metriken (Custom Metrics in Prometheus)
- [ ] 7.6 Teste workspace_id-Filterung in Grafana
- [ ] 7.7 Validiere Retention-Policies (alte Daten werden gelöscht)
- [ ] 7.8 Teste PII-Redaction (sensible Daten nicht in Logs/Labels)
- [ ] 7.9 Teste Backup/Restore (Volume-Sicherung + Restore)
- [ ] 7.10 Validiere Port-Bindings (nur localhost erreichbar)
- [ ] 7.11 Teste Dashboard-Accessibility (Tastatur-Navigation, Live-Tail Pause)

## 8. CI/CD Integration (optional, spätere Phase)
- [ ] 8.1 Füge Docker Compose Health-Checks zu CI hinzu
- [ ] 8.2 Validiere Label-Schema in CI-Tests
- [ ] 8.3 Exportiere Metriken für Performance-Regression-Tests
