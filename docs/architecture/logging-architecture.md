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
- Routing-Observability fuer `@sva/routing` inklusive Guard-, Plugin- und Auth-Dispatch-Ereignissen.
- OTEL-Export von Logs und Metriken (`@sva/monitoring-client/server`).
- OTEL Collector + Loki + Promtail im lokalen Monitoring-Stack.
- Tenant-/Request-Kontext per AsyncLocalStorage.

Nicht abgedeckt sind:

- produktives Browser-Logging außerhalb der lokalen Dev-Konsole.
- Alerting-Regeln im Detail (siehe Monitoring-Doku).

## Komponentenuebersicht

### 1) Application Logger (`packages/sdk/src/logger/index.server.ts`)

- Entry Point: `createSdkLogger(...)`
- Implementierung: Winston Logger mit
  - JSON-Format fuer strukturierte Logs,
  - Kontext-Anreicherung (`workspace_id`, `request_id`, `user_id`, `session_id`),
  - Redaction sensibler Felder,
  - modusspezifischen Transports fuer Console, Dev-UI und OTEL,
  - direktem OTEL-Transport (`DirectOtelTransport`),
  - Laufzeit-Rekonfiguration bereits erzeugter Logger nach erfolgreicher OTEL-Initialisierung.

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
  - Production: verpflichtend aktiv
  - Development: standardmäßig angefragt; per `ENABLE_OTEL=false|0` explizit deaktivierbar
- Rueckgabewert: strukturiertes Ergebnisobjekt mit `status: ready|disabled|failed`
- Der Bootstrap erzwingt kein zusaetzliches OTEL-Diag-Console-Logging; regulaere App-Logs folgen ausschliesslich dem Runtime-Modell.
- `flushOtelSdk()` fuer kontrolliertes Flush-Verhalten beim Shutdown.

### 3a) Development Log Console (`apps/sva-studio-react/src/components/DevelopmentLogConsole.tsx`)

- Nur in der Entwicklungsumgebung gerendert.
- Zeigt Browser-Logs und redaktierte Server-Logs in einer lokalen Debug-Konsole am Seitenende.
- Browser-Logs werden clientseitig gesammelt.
- Server-Logs werden ueber einen redaktierten In-Memory-Buffer im SDK und Polling aus der App bereitgestellt.
- Der zugehoerige Serverpfad liefert ausserhalb von Development keine Eintraege aus.

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
    -> Console Transport (Development)
    -> Development UI Transport (Development)
    -> DirectOtelTransport (nur wenn OTEL ready)
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
Pseudonyme technische IDs bleiben dennoch personenbeziehbar und duerfen nur bei begruendeter Betriebsnotwendigkeit erscheinen.

### Severity Mapping

`DirectOtelTransport` mappt Winston-Level auf OTEL Severity:

- `error` -> 17
- `warn` -> 13
- `info` -> 9
- `debug` -> 5
- `verbose` -> 1

## Routing-Observability-Vertrag

`@sva/routing` nutzt fuer routing-relevante Entscheidungen einen kleinen Diagnostics-Vertrag statt verteilter Logger-Zugriffe.

- Client- und Server-Route-Factories verdrahten standardmaessig einen Routing-Diagnostics-Adapter; ein expliziter `RoutingDiagnosticsHook` kann diesen Default ueberschreiben.
- Die Event-zu-Logger-Zuordnung erfolgt zentral ueber `createRoutingDiagnosticsLogger(...)`.
- Serverseitig binden Auth-Routen und allgemeine Routing-Factories denselben Adapter an `createSdkLogger(...)` und damit an den OTEL-Pfad.
- Standardmaessig geloggt werden Guard-Denials, Plugin-Guard-Anomalien, Handler-Dispatch, Handler-Completion, unbehandelte Handler-Fehler und `405 Method Not Allowed`.

### Routing-Safe-Felder

- `event`
- `route`
- `reason`
- `plugin`
- `redirect_target`
- `required_roles`
- `unsupported_guard`
- `method`
- `allow`
- `status_code`
- `duration_ms`
- `workspace_id`
- `request_id`
- `trace_id`
- `error_type`
- `error_message`

Nicht zulaessig sind insbesondere aufgeloeste Pfade mit IDs, rohe Query-Strings, Token-URLs, `session_id`, `email`, `ip_address`, `user_agent` und Stack-Traces.

## PII- und Label-Policy

Die Policy ist mehrstufig implementiert.

### Stufe A: App-Logger Redaction

In `createSdkLogger`:

- sensitive keys werden auf `[REDACTED]` gesetzt (z. B. `password`, `token`, `authorization`, `api_key`, `secret`, `email`)
- E-Mails werden maskiert (Pattern-basiert).
- sensitive Query-Parameter in URLs wie `id_token_hint`, `access_token`, `refresh_token` und `code` werden maskiert
- JWT-aehnliche Strings und Inline-Bearer-Tokens in Freitexten werden heuristisch auf `[REDACTED_JWT]` bzw. `[REDACTED]` reduziert
- tokenhaltige Redirect- oder Logout-URLs duerfen fachlich gar nicht erst als Rohwert den Logger erreichen; zulaessig ist nur eine sichere Summary ohne Query-Geheimnisse

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

- Console-Logging ist immer aktiv.
- Die lokale Dev-Konsole im Frontend ist immer aktiv.
- OTEL wird standardmäßig initialisiert, aber nur bei erfolgreichem SDK-Start als aktiver Transport zugeschaltet.
- OTEL kann fuer lokale Entwicklungslaeufe explizit via `ENABLE_OTEL=false|0` deaktiviert werden.
- Lokale Diagnosekanaele folgen denselben Redaction-Regeln wie OTEL; Development ist kein Privacy-Sonderfall.

### Production

- Console-Logging ist aus.
- Die Dev-Konsole ist aus.
- OTEL ist verpflichtend aktiv.
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
5. Keine tokenhaltigen URLs loggen; stattdessen sichere Summary-Felder verwenden.
6. Bei neuen Services `component` stabil benennen (dash-case oder snake_case, konsistent).

### Don't

1. Kein `console.log` als App-Logging-Ersatz.
2. Kein direkter Loki-Client im Feature-Code.
3. Keine hochkardinalen IDs als Labels.
4. Keine Secrets/Tokens in Log-Meta.
5. Keine Redirect- oder Logout-URLs mit sensitiven Query-Parametern im operativen Logging.

## Tests und Verifikation

### Unit-/Integration-Ebene

- SDK/Monitoring-Tests unter:
  - `packages/sdk/tests/`
  - `packages/monitoring-client/tests/`
  - `packages/auth-runtime/src/session.test.ts` (session-bezogen)

### Lokal

1. Monitoring-Stack starten (`docker-compose.monitoring.yml`).
2. App starten und Flows triggern.
3. Optional OTEL lokal deaktivieren (`ENABLE_OTEL=false`), wenn nur Console + Dev-Konsole genutzt werden sollen.
4. In Grafana/Loki verifizieren:
   - Labels entsprechen Whitelist.
   - PII ist maskiert/redacted.
   - `workspace_id` ist vorhanden (wo Kontext vorhanden ist).

## Bekannte Trade-offs

1. Doppelte Pipeline (OTEL + Promtail) kann ohne saubere Trennung Duplikate erzeugen.
2. Context-Middleware nutzt in einem Sonderfall `console.warn` (zirkulaere Abhaengigkeit zum Logger), bewusst begrenzt auf Development-Warnpfad.
3. In Development kann die Anwendung bewusst ohne aktiven OTEL-Transport laufen; Console und Dev-Konsole bleiben dann die primären Diagnosekanaele.

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
- `docs/adr/README.md`
