## ADDED Requirements

### Requirement: Docker-basierter Monitoring Stack
Das System SHALL einen vollständigen Observability Stack für die Entwicklungsumgebung bereitstellen, der Prometheus, Loki, Grafana und OpenTelemetry Collector umfasst und via Docker Compose gestartet werden kann.

#### Scenario: Entwickler startet Monitoring Stack
- **WHEN** ein Entwickler `docker compose -f docker-compose.monitoring.yml up` ausführt
- **THEN** starten alle Services (Prometheus, Loki, Grafana, OTEL Collector, Promtail) erfolgreich
- **AND** Grafana ist unter `http://localhost:3001` erreichbar
- **AND** alle Datasources (Prometheus, Loki) sind vorkonfiguriert
- **AND** alle Services sind healthy (Health-Checks bestätigt)

- **AND** vordefinierte Dashboards werden automatisch importiert

#### Scenario: Zero-Config Setup für neue Entwickler
- **WHEN** ein neuer Entwickler das Repository klont
- **THEN** kann er mit einem einzigen Befehl den Stack starten (kein manuelles Dashboard-Setup)
- **AND** alle notwendigen Konfigurationsdateien sind im Repository versioniert
- **AND** die Dokumentation enthält klare Setup-Anweisungen (<5 Minuten)

### Requirement: Automatisches Log-Shipping
Alle App-Container SHALL ihre Logs automatisch an Loki senden, ohne dass Entwickler Code-Änderungen vornehmen müssen.

#### Scenario: Backend-Logs erscheinen in Grafana
- **WHEN** das Backend einen Log-Eintrag schreibt (`console.log`, `logger.info`)
- **THEN** erscheint der Log-Eintrag innerhalb von 5 Sekunden in Grafana
- **AND** enthält korrekte Labels (workspace_id, component, level)
- **AND** ist im JSON-Format mit Timestamp und Metadaten

#### Scenario: Promtail sammelt Docker-Logs
- **WHEN** ein App-Container startet und Logs zu stdout/stderr schreibt
- **THEN** liest Promtail die Logs aus `/var/lib/docker/containers`
- **AND** fügt Labels hinzu basierend auf Docker-Labeln
- **AND** sendet die Logs an Loki via HTTP API

### Requirement: OpenTelemetry SDK Integration
Die Applikation SHALL OpenTelemetry SDK nutzen für Metriken und Logs, um Vendor-Neutralität zu gewährleisten.

#### Scenario: Metriken werden zu Prometheus exportiert
- **WHEN** das Backend OpenTelemetry SDK initialisiert
- **THEN** werden automatisch HTTP-Request-Metriken erfasst (Latency, Status-Codes)
- **AND** Custom Business-Metriken können via `meter.createCounter()` definiert werden
- **AND** alle Metriken werden via OTLP an den OTEL Collector gesendet
- **AND** erscheinen in Prometheus unter `/metrics` Endpoint

#### Scenario: Context-basierte Label-Injection
- **WHEN** eine API-Route workspace_id aus dem Request-Header liest
- **THEN** wird workspace_id automatisch in den OTEL Context injected
- **AND** alle nachfolgenden Logs/Metriken enthalten workspace_id als Label
- **AND** Entwickler müssen workspace_id nicht manuell bei jedem Log-Call übergeben

### Requirement: Vorkonfigurierte Grafana-Dashboards
Grafana SHALL mit mindestens 3 Dashboards vorkonfiguriert sein, die typische Entwicklungs-Use-Cases abdecken.

#### Scenario: Development Overview Dashboard
- **WHEN** ein Entwickler Grafana öffnet
- **THEN** sieht er ein Dashboard "Development Overview"
- **AND** zeigt CPU/RAM/Disk-Metriken aller Services
- **AND** zeigt API-Request-Rate und Error-Rate
- **AND** zeigt aktive Workspaces (workspace_id Cardinality)

#### Scenario: Application Logs Dashboard
- **WHEN** ein Entwickler das "Application Logs" Dashboard öffnet
- **THEN** sieht er die letzten 100 Log-Einträge aller Services
- **AND** kann nach workspace_id, level, component filtern
- **AND** kann Logs in Echtzeit streamen (Live-Tail)
- **AND** kann einzelne Log-Einträge expandieren (JSON-Details)

#### Scenario: Multi-Tenancy Test Dashboard
- **WHEN** ein Entwickler mit mehreren Test-Workspaces arbeitet
- **THEN** zeigt das Dashboard separate Panels pro workspace_id
- **AND** visualisiert Request-Verteilung über Workspaces
- **AND** zeigt potenzielle Cardinality-Probleme (zu viele unique Labels)

### Requirement: Label-Schema Enforcement
Das System SHALL ein definiertes Label-Schema durchsetzen und High-Cardinality-Labels verhindern.

#### Scenario: Erlaubte Labels werden akzeptiert
- **WHEN** eine Metrik mit Labels `{workspace_id, component, level}` gesendet wird
- **THEN** wird sie von Prometheus/Loki akzeptiert
- **AND** erscheint korrekt in Grafana-Queries

#### Scenario: Verbotene Labels werden gefiltert (Development-Modus)
- **WHEN** ein Entwickler versehentlich `user_id` als Label setzt
- **THEN** gibt der OTEL Collector eine Warning aus (Console-Log)
- **AND** entfernt das Label vor dem Export zu Prometheus/Loki
- **AND** die Metrik wird trotzdem gespeichert (nicht blockiert)

#### Scenario: Fehlende workspace_id erzeugt Warning (Development-Modus)
- **WHEN** eine Metrik ohne workspace_id Label gesendet wird
- **THEN** loggt der OTEL Collector eine Warning
- **AND** setzt workspace_id auf "unknown" (Fallback)
- **AND** die Metrik wird gespeichert (nicht verworfen)

### Requirement: Persistente Daten mit Retention
Metriken und Logs SHALL lokal gespeichert werden mit automatischer Retention-Policy (7 Tage).

#### Scenario: Daten überleben Container-Restart
- **WHEN** ein Entwickler `docker compose down && docker compose up` ausführt
- **THEN** sind alle Metriken/Logs der letzten 7 Tage noch vorhanden
- **AND** Grafana-Dashboards zeigen historische Daten

#### Scenario: Alte Daten werden automatisch gelöscht
- **WHEN** Metriken/Logs älter als 7 Tage sind
- **THEN** löscht Prometheus sie automatisch (retention.time=7d)
- **AND** löscht Loki sie automatisch (retention_period=168h)
- **AND** Disk-Usage bleibt unter 5GB pro Service

#### Scenario: Speicher-Limit wird eingehalten
- **WHEN** Prometheus mehr als 5GB Speicher nutzen würde
- **THEN** löscht es die ältesten Daten zuerst
- **AND** loggt eine Warning, wenn Limit erreicht wird

### Requirement: Health-Check Endpoints
Alle Monitoring-Services SHALL Health-Check Endpoints bereitstellen für Startup-Validierung.

#### Scenario: Prometheus Health-Check
- **WHEN** Prometheus gestartet ist
- **THEN** antwortet `http://localhost:9090/-/healthy` mit 200 OK
- **AND** `http://localhost:9090/-/ready` mit 200 OK wenn Targets scraped

#### Scenario: Loki Health-Check
- **WHEN** Loki gestartet ist
- **THEN** antwortet `http://localhost:3100/ready` mit 200 OK

#### Scenario: Grafana Health-Check
- **WHEN** Grafana gestartet ist
- **THEN** antwortet `http://localhost:3001/api/health` mit 200 OK
- **AND** Datasources sind connected (kein "Datasource error")

### Requirement: Entwickler-Dokumentation
Das Setup SHALL vollständig dokumentiert sein mit Troubleshooting-Guide.

#### Scenario: Setup-Anleitung im README
- **WHEN** ein Entwickler `docs/development/monitoring-stack.md` öffnet
- **THEN** findet er Schritt-für-Schritt-Anleitung zum Setup
- **AND** Beispiel-Queries für Prometheus (PromQL) und Loki (LogQL)
- **AND** Links zu Grafana-Dashboards (mit URLs)

#### Scenario: Troubleshooting für häufige Probleme
- **WHEN** ein Entwickler auf Port-Konflikte stößt
- **THEN** beschreibt die Dokumentation, wie Ports geändert werden (Environment-Variables)
- **AND** listet RAM-Requirements auf (<2GB zusätzlich)
- **AND** erklärt, wie einzelne Services deaktiviert werden können

#### Scenario: OTEL SDK Konfiguration für App-Entwickler
- **WHEN** ein Entwickler Custom Metrics hinzufügen möchte
- **THEN** zeigt die Dokumentation Code-Beispiele für `meter.createCounter()`
- **AND** erklärt Context-Injection für workspace_id
- **AND** listet alle verfügbaren Auto-Instrumentations auf (HTTP, DB, Redis)

### Requirement: Minimale Ressourcen-Nutzung
Der Monitoring Stack SHALL mit <2GB RAM auskommen, um Entwickler-Maschinen nicht zu überlasten.

#### Scenario: Memory-Limits in Docker Compose
- **WHEN** Docker Compose den Stack startet
- **THEN** hat jeder Service ein `mem_limit` definiert:
  - Prometheus: 512MB
  - Loki: 512MB
  - Grafana: 256MB
  - OTEL Collector: 256MB
  - Promtail: 128MB
- **AND** Gesamt-RAM-Verbrauch bleibt unter 2GB

#### Scenario: Optionaler Start für Entwickler
- **WHEN** ein Entwickler nur das Backend testen möchte (ohne Monitoring)
- **THEN** kann er `docker compose up` ohne `-f docker-compose.monitoring.yml` nutzen
- **AND** die Applikation funktioniert trotzdem (Monitoring ist optional)
- **AND** OTEL SDK loggt Warning, aber crashed nicht

### Requirement: PII-Redaction & Privacy-by-Default
Das System SHALL personenbezogene Daten automatisch reduzieren/maskieren, um DSGVO-Konformität zu gewährleisten.

#### Scenario: Automatische Redaction sensibler Felder
- **WHEN** ein Log-Eintrag Felder wie `password`, `token`, `authorization` enthält
- **THEN** werden diese Felder automatisch vor dem Export redacted (ersetzt durch `***`)
- **AND** erscheinen nicht in Loki/Grafana

#### Scenario: Email-Masking
- **WHEN** ein Log-Eintrag eine Email-Adresse enthält
- **THEN** wird sie automatisch maskiert (`user@example.com` → `u***@example.com`)
- **AND** ist in Grafana nur teilweise sichtbar

#### Scenario: User-IDs nur als Payload-Fields
- **WHEN** ein Log-Eintrag `user_id` oder `session_id` enthält
- **THEN** werden sie nur als Log-Payload-Fields gespeichert (nicht als Labels)
- **AND** sind nicht über Grafana-Filter suchbar (nur im JSON-Detail sichtbar)

#### Scenario: Promtail filtert nur SVA-Services
- **WHEN** Promtail Docker-Logs sammelt
- **THEN** werden nur Container mit Label `com.sva-studio.monitoring=enabled` erfasst
- **AND** andere lokale Container werden ignoriert (keine Daten-Leakage)

### Requirement: Security Defaults
Das System SHALL sichere Default-Konfigurationen verwenden, um unbefugten Zugriff zu verhindern.

#### Scenario: Localhost-only Bindings
- **WHEN** Docker Compose den Stack startet
- **THEN** sind alle Services nur auf `127.0.0.1` erreichbar (nicht `0.0.0.0`)
- **AND** können nicht von außen zugegriffen werden

#### Scenario: Randomized Grafana Admin-Password
- **WHEN** Grafana startet
- **THEN** wird das Admin-Passwort aus `.env` gelesen (`GF_SECURITY_ADMIN_PASSWORD`)
- **AND** ist nicht hartcodiert oder Default (`admin/admin`)
- **AND** README dokumentiert Setup via `.env.example`

#### Scenario: Keine Secrets im Repository
- **WHEN** Docker Compose Config committed wird
- **THEN** enthält sie keine hardcoded Passwörter oder API-Keys
- **AND** nutzt `.env` für Secrets (via `env_file`)
- **AND** `.env` ist in `.gitignore`

### Requirement: Dashboard Accessibility (WCAG 2.1 AA)
Grafana-Dashboards SHALL barrierefrei bedienbar sein, um allen Entwicklern Zugang zu ermöglichen.

#### Scenario: Vollständige Tastaturbedienung
- **WHEN** ein Entwickler nur die Tastatur nutzt
- **THEN** kann er alle Dashboard-Filter navigieren (Tab-Reihenfolge logisch)
- **AND** kann Panels fokussieren und expandieren (Enter/Space)
- **AND** kann Live-Tail starten/stoppen (Tastatur-Shortcut)

#### Scenario: Live-Tail mit Pause-Kontrolle
- **WHEN** ein Entwickler Live-Tail aktiviert
- **THEN** gibt es eine sichtbare Pause-Schaltfläche
- **AND** kann der Stream via Tastatur pausiert werden
- **AND** scrollt der Log-Stream nicht unkontrolliert (WCAG 2.2.2)

#### Scenario: Kontrast und Farbunabhängigkeit
- **WHEN** ein Dashboard kritische Fehler anzeigt
- **THEN** werden sie nicht nur farblich markiert (zusätzlich Icon/Text)
- **AND** ist der Kontrast mindestens 4.5:1 (WCAG 1.4.3)
- **AND** funktioniert das Dashboard auch in High-Contrast-Mode

#### Scenario: Filter-Beschriftungen
- **WHEN** ein Entwickler einen Filter nutzt
- **THEN** hat jeder Filter ein sichtbares Label (nicht nur Placeholder)
- **AND** gibt es Hilfe-Text für komplexe Filter (PromQL/LogQL)
- **AND** werden Fehlermeldungen klar angezeigt (WCAG 3.3.1)

### Requirement: API-Versioning & Standards-Compliance
Das System SHALL explizite API-Versionen verwenden und offene Standards einhalten.

#### Scenario: OTLP Protocol Version
- **WHEN** die OTEL SDK Konfiguration geprüft wird
- **THEN** ist OTLP/HTTP v1 explizit dokumentiert
- **AND** sind Endpoints versioniert (`/v1/metrics`, `/v1/logs`)

#### Scenario: Prometheus API Version
- **WHEN** Prometheus konfiguriert wird
- **THEN** nutzt es Prometheus API v1 (Remote Write Protocol v1.0)
- **AND** ist die Version in der Dokumentation genannt

#### Scenario: OpenTelemetry Semantic Conventions
- **WHEN** Auto-Instrumentation HTTP-Metriken erfasst
- **THEN** folgen Attribut-Namen den OTel Semantic Conventions v1.21+
- **AND** sind Standard-Attribute dokumentiert (`http.method`, `http.status_code`)

### Requirement: Backup & Restore Capability
Das System SHALL Backup- und Restore-Prozeduren bereitstellen, um Datenverlust zu verhindern.

#### Scenario: Volume-Backup erstellen
- **WHEN** ein Entwickler ein Backup erstellen möchte
- **THEN** ist ein Skript/Befehl dokumentiert für Prometheus/Loki/Grafana Volumes
- **AND** wird ein timestamped Archiv erstellt (`prometheus-YYYYMMDD.tar.gz`)

#### Scenario: Restore von Backup
- **WHEN** ein Backup wiederhergestellt werden soll
- **THEN** ist der Restore-Prozess dokumentiert (Volume extraction)
- **AND** wird ein Smoke-Test nach Restore empfohlen (Health-Checks)

#### Scenario: Monatlicher Restore-Test
- **WHEN** CI/CD konfiguriert wird
- **THEN** ist ein monatlicher automatisierter Restore-Test vorgesehen
- **AND** validiert dieser die Datenintegrität nach Restore
### Requirement: Service Health-Checks
Alle Monitoring Services SHALL Health-Check Endpoints bereitstellen und Readiness validieren.

#### Scenario: Prometheus Health-Endpoint
- **WHEN** ein Entwickler `curl http://localhost:9090/-/healthy` aufruft
- **THEN** antwortet Prometheus mit 200 OK
- **AND** ist im JSON-Response die Server-Version enthalten

#### Scenario: Loki Readiness-Endpoint
- **WHEN** ein Entwickler `curl http://localhost:3100/ready` aufruft
- **THEN** antwortet Loki mit 204 No Content (wenn ready)
- **AND** wird automatisch bei `docker compose up` geprüft

#### Scenario: Grafana API Health
- **WHEN** ein Entwickler `curl http://localhost:3001/api/health` aufruft
- **THEN** antwortet Grafana mit 200 OK + JSON (`{"status":"ok"}`)
- **AND** zeigt auch Status von Datasources in der Response

#### Scenario: OTEL Collector Health Check
- **WHEN** OTEL Collector startet
- **THEN** ist Health-Check über gRPC Port 13133 verfügbar
- **AND** wird von Docker Compose überwacht (Restart bei Fehler)

#### Scenario: Startup-Sequenz mit Health-Checks
- **WHEN** `docker compose -f docker-compose.monitoring.yml up` ausgeführt wird
- **THEN** starten alle Services parallel
- **AND** werden alle Health-Checks alle 30s geprüft
- **AND** Grafana startet Dashboard-Auto-Import nur wenn Prometheus + Loki ready sind
- **AND** wird in der Konsole der Health-Status aller Services angezeigt

#### Scenario: Dashboard-Import nur bei Ready-Status
- **WHEN** Grafana und Prometheus beide ready sind
- **THEN** wird ein Init-Script automatisch die Dashboards importieren
- **AND** wird die Loki-Datasource validiert (Test-Query)
- **AND** gibt es bei Fehler ein Error-Log (kein Hard-Fail)
