# Logging Architecture

Dieses Dokument beschreibt die aktuelle Logging-Architektur im SVA Studio Monorepo, inklusive Datenfluss, Sicherheitsregeln, Konfigurationspunkten und Betriebsmodell.

## Zielbild

Die Logging-Architektur verfolgt vier Kernziele:

1. Einheitliche, strukturierte Logs ueber alle Server-Module.
2. Korrelation von Logs mit Workspace- und Request-Kontext.
3. Strikte PII-Kontrolle (Redaction + Label-Whitelist).
4. Vendor-neutrale Pipeline ueber OpenTelemetry statt direkter Loki-Bindung im App-Code.

## Scope

Abgedeckt sind:

- Server-seitiges App-Logging (`@sva/sdk/server`).
- OTEL-Export von Logs und Metriken (`@sva/monitoring-client/server`).
- OTEL Collector + Loki + Promtail im lokalen Monitoring-Stack.
- Tenant-/Request-Kontext per AsyncLocalStorage.

Nicht abgedeckt sind:

- Frontend-Browser-Logging.
- Alerting-Regeln im Detail (siehe Monitoring-Doku).

## Komponentenuebersicht

### 1) Application Logger (`packages/sdk/src/logger/index.server.ts`)

- Entry Point: `createSdkLogger(...)`
- Implementierung: Winston Logger mit
  - JSON-Format fuer strukturierte Logs,
  - Kontext-Anreicherung (`workspace_id`, `request_id`, `user_id`, `session_id`),
  - Redaction sensibler Felder,
  - optionaler Console-Ausgabe,
  - direktem OTEL-Transport (`DirectOtelTransport`).

Wichtig:
- Server-Code nutzt `@sva/sdk/server`.
- Keine direkten `console.*` Calls im regulären Server-Code (Ausnahme: zirkulaere Abhaengigkeiten im Context-Middleware-Modul).

### 2) Context Propagation (`packages/sdk/src/observability/context.server.ts`)

- AsyncLocalStorage speichert Request-/Workspace-Kontext.
- API:
  - `runWithWorkspaceContext`
  - `getWorkspaceContext`
  - `setWorkspaceContext`
- Extraktion via Request-Helper in `packages/sdk/src/middleware/request-context.server.ts`.

Damit werden Logs in async Workflows automatisch mit Kontext angereichert.

### 3) OTEL Bootstrap (`packages/sdk/src/server/bootstrap.server.ts`)

- `initializeOtelSdk()` startet OTEL idempotent.
- Aktivierung:
  - Production: immer aktiv
  - Development: nur bei `ENABLE_OTEL=true|1`
- `flushOtelSdk()` fuer kontrolliertes Flush-Verhalten beim Shutdown.

### 4) OTEL SDK + Processor (`packages/monitoring-client/src/otel.server.ts`)

- Start via `startOtelSdk(...)`.
- Enthält:
  - OTLP Log Exporter (`/v1/logs`)
  - OTLP Metric Exporter (`/v1/metrics`)
  - `RedactingLogProcessor` als zentrale Label/PII-Policy im OTEL-Layer
  - Batch-Verhalten mit dev/prod-optimierten Flush-Intervallen.

### 5) LoggerProvider Singleton (`packages/monitoring-client/src/logger-provider.server.ts`)

- Stellt globalen Zugriff auf den OTEL LoggerProvider bereit.
- `DirectOtelTransport` verwendet diesen Provider fuer direkte Log-Emission.

### 6) Collector + Storage (`dev/monitoring/...`, `docker-compose.monitoring.yml`)

- OTEL Collector:
  - Receives OTLP gRPC + HTTP
  - Exportiert Logs nach Loki, Metriken nach Prometheus
- Loki:
  - Log Storage + Query
- Promtail:
  - Fallback fuer Container-stdout/stderr, plus zusätzliche Label-Filterung.

## End-to-End Datenfluss

```text
App Code (createSdkLogger)
  -> Winston Logger (JSON + Kontext + Redaction)
    -> DirectOtelTransport
      -> Global OTEL LoggerProvider
        -> OTEL SDK LogRecord
          -> RedactingLogProcessor (Label-Whitelist + PII-Regeln)
            -> OTLP Export (/v1/logs)
              -> OTEL Collector
                -> Loki
                  -> Grafana / LogQL
```

Fallback-Pfad:

```text
Container stdout/stderr
  -> Promtail (docker stage + relabel)
    -> Loki
```

## Logging Contract

### Pflichtfelder

- `component`: Herkunft des Logs (z. B. `auth`, `bootstrap`).
- `environment`: `development|test|production`.
- `workspace_id`: Mandantenkontext, wenn vorhanden.

### Kontexteinbettung

Der Logger injiziert Kontextdaten in `context`:

- `request_id`
- `user_id`
- `session_id`

Diese werden als Kontext-Payload gefuehrt, nicht als frei skalierende Labels.

### Severity Mapping

`DirectOtelTransport` mappt Winston-Level auf OTEL Severity:

- `error` -> 17
- `warn` -> 13
- `info` -> 9
- `debug` -> 5
- `verbose` -> 1

## PII- und Label-Policy

Die Policy ist mehrstufig implementiert.

### Stufe A: App-Logger Redaction

In `createSdkLogger`:

- sensitive keys werden auf `[REDACTED]` gesetzt (z. B. `password`, `token`, `authorization`, `api_key`, `secret`, `email`)
- E-Mails werden maskiert (Pattern-basiert).

### Stufe B: OTEL Log Processor

In `RedactingLogProcessor`:

- `workspace_id` wird aus AsyncLocalStorage injiziert.
- Nur erlaubte Label bleiben erhalten (Whitelist):
  - `workspace_id`
  - `component`
  - `environment`
  - `level`
- Verbotene/high-cardinality/PII Label werden verworfen.
- Kontextdaten werden in den Body serialisiert.

### Stufe C: Promtail Fallback Filter

In `dev/monitoring/promtail/promtail-config.yml`:

- `labeldrop` entfernt verbotene Labels.
- `labelkeep` erzwingt erlaubten Labelsatz fuer Fallback-Logs.

## Betriebsmodi

### Development

- Standard: OTEL aus (schneller, weniger lokale Komplexitaet)
- Optional: OTEL an mit `ENABLE_OTEL=true`
- Console-Logging aktiv fuer schnelle Feedback-Loops.

### Production

- OTEL aktiv.
- Strukturiertes Logging und Export ueber Collector verpflichtend.
- Graceful Shutdown mit `forceFlush` + `sdk.shutdown()`.

## Konfiguration

### Relevante Env Vars

- `NODE_ENV`
- `ENABLE_OTEL`
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

### Lokale Standardports

- OTEL Collector: `4317` (gRPC), `4318` (HTTP), `13133` (health)
- Loki: `3100`
- Promtail: `3101`
- Prometheus: `9090`
- Grafana: `3001`

## Implementierungsrichtlinien fuer neue Module

### Do

1. Logger via `createSdkLogger({ component: '...' })` erstellen.
2. Request-Handler mit `withRequestContext(...)` kapseln.
3. Strukturierte Meta-Felder statt freiem String-Ballast nutzen.
4. Keine PII in Labels schreiben.
5. Bei neuen Services `component` stabil benennen (dash-case oder snake_case, konsistent).

### Don't

1. Kein `console.log` als App-Logging-Ersatz.
2. Kein direkter Loki-Client im Feature-Code.
3. Keine hochkardinalen IDs als Labels.
4. Keine Secrets/Tokens in Log-Meta.

## Tests und Verifikation

### Unit-/Integration-Ebene

- SDK/Monitoring-Tests unter:
  - `packages/sdk/tests/`
  - `packages/monitoring-client/tests/`
  - `packages/auth/src/auth.server.test.ts` (session-bezogen)

### Lokal

1. Monitoring-Stack starten (`docker-compose.monitoring.yml`).
2. OTEL aktivieren (`ENABLE_OTEL=true`).
3. App starten und Flows triggern.
4. In Grafana/Loki verifizieren:
   - Labels entsprechen Whitelist.
   - PII ist maskiert/redacted.
   - `workspace_id` ist vorhanden (wo Kontext vorhanden ist).

## Bekannte Trade-offs

1. Doppelte Pipeline (OTEL + Promtail) kann ohne saubere Trennung Duplikate erzeugen.
2. Context-Middleware nutzt in einem Sonderfall `console.warn` (zirkulaere Abhaengigkeit zum Logger), bewusst begrenzt auf Development-Warnpfad.
3. Bei fehlendem OTEL LoggerProvider faellt `DirectOtelTransport` auf no-op fuer OTEL-Emission, Console-Transport bleibt als Sicherheitsnetz.

## Roadmap (empfohlen)

1. Status der ADRs 005/006/007 von `Proposed` auf `Accepted`, sobald Review abgeschlossen ist.
2. Optionales deduplizierendes Labeling zwischen OTEL-Pfad und Promtail-Fallback.
3. Erweiterte Compliance-Tests fuer Label-Whitelist/PII als CI-Checks.
4. Klare Naming-Konvention fuer `component` zentral in Development Rules.

## Referenzen

- `packages/sdk/src/logger/index.server.ts`
- `packages/sdk/src/middleware/request-context.server.ts`
- `packages/sdk/src/observability/context.server.ts`
- `packages/sdk/src/server/bootstrap.server.ts`
- `packages/monitoring-client/src/otel.server.ts`
- `packages/monitoring-client/src/logger-provider.server.ts`
- `dev/monitoring/otel-collector/otel-collector.yml`
- `dev/monitoring/promtail/promtail-config.yml`
- `docker-compose.monitoring.yml`
- `docs/development/observability-best-practices.md`
- `docs/development/monitoring-stack.md`
- `docs/architecture/decisions/ADR-004-monitoring-stack-loki-grafana-prometheus.md`
- `docs/architecture/decisions/ADR-005-observability-module-ownership.md`
- `docs/architecture/decisions/ADR-006-logging-pipeline-strategy.md`
- `docs/architecture/decisions/ADR-007-label-schema-and-pii-policy.md`
