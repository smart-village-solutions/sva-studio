## MODIFIED Requirements

### Requirement: SDK Logger for IAM Server Modules

Das System MUST den SDK Logger (`createSdkLogger` aus `@sva/sdk`) für alle operativen Logs in IAM-Servermodulen verwenden, gemäß ADR-006 und Observability Best Practices. `console.log`/`console.error` DÜRFEN im IAM-Servercode NICHT verwendet werden.

#### Scenario: Structured logging with mandatory fields

- **WHEN** ein IAM-Servermodul einen Log-Eintrag erzeugt
- **THEN** enthält der Eintrag mindestens: `workspace_id` (= `instanceId`), `component` (z. B. `iam-auth`), `environment`, `level`
- **AND** PII-Redaktion wird automatisch durch den SDK Logger angewendet
- **AND** es erscheinen keine Klartext-Tokens, Session-IDs oder E-Mail-Adressen in Logs

#### Scenario: Correlation IDs in authentication flows

- **WHEN** ein IAM-API-Endpunkt aufgerufen wird
- **THEN** wird eine `request_id` erzeugt oder aus dem `X-Request-Id`-Header übernommen
- **AND** der OTEL-Trace-Kontext wird propagiert
- **AND** alle Log-Einträge innerhalb der Anfrage referenzieren `request_id` und `trace_id`

#### Scenario: Token validation error logging

- **WHEN** eine Token-Validierung fehlschlägt (invalid, expired, audience mismatch, issuer mismatch)
- **THEN** emittiert der SDK Logger einen `warn`-Eintrag mit `operation`, `error_type`, `has_refresh_token`, `request_id`
- **AND** es werden keine Tokenwerte oder Session-IDs im Log-Eintrag enthalten

#### Scenario: Correlation IDs in Handler-Catch-Blöcken

- **WHEN** ein `withAuthenticatedIamHandler`-Catch-Block einen unerwarteten Fehler abfängt
- **THEN** enthält der `error`-Log-Eintrag `request_id` und `trace_id` via `buildLogContext({ includeTraceId: true })` aus `packages/auth/src/shared/log-context.ts` (kanonische Implementierung)
- **AND** der Eintrag enthält `error_type` (Constructor-Name oder `typeof`-Fallback) und `error_message`
- **AND** der Eintrag enthält **kein** `error.stack`-Feld (Observability Best Practices: keine Stack-Traces in strukturierten Log-Feldern)

#### Scenario: Correlation IDs bei fehlendem AsyncLocalStorage-Context

- **WHEN** ein `withAuthenticatedIamHandler`-Catch-Block ausgelöst wird und der AsyncLocalStorage-Context leer ist (z. B. bei Worker-Threads oder außerhalb des Request-Lifecycle)
- **THEN** enthält der Log-Eintrag `request_id: undefined` und `trace_id: undefined`
- **AND** der Logger wirft keinen eigenen Fehler

#### Scenario: Middleware-Logs mit Trace-Kontext

- **WHEN** Auth-Middleware einen Log-Eintrag erzeugt (z. B. bei Session-Auflösung oder Redirect)
- **THEN** enthält der Eintrag `trace_id` via `buildLogContext({ includeTraceId: true })` aus `packages/auth/src/shared/log-context.ts`

#### Scenario: Error-Response über einheitlichen Utility

- **WHEN** `withAuthenticatedIamHandler` einen unerwarteten Fehler abfängt
- **THEN** wird die Error-Response über `toJsonErrorResponse()` aus `@sva/sdk/server` erzeugt
- **AND** der Response-Shape ist für stabile IAM-v1-Endpunkte `{ error: "internal_error", message?: "..." }` mit HTTP 500
- **AND** rohe Exception-Texte, Provider-Fehler und Stack-Fragmente gelangen nie in das Feld `message`

## ADDED Requirements

### Requirement: Keycloak-Sync Debug-Logging

Das System SHALL beim Keycloak-User-Sync detaillierte Debug-Informationen für übersprungene Benutzer bereitstellen, um Multi-Tenant-Konfigurationsprobleme schnell diagnostizierbar zu machen.

#### Scenario: Einzeln übersprungene User geloggt

- **WHEN** ein Keycloak-User beim Sync übersprungen wird (kein passender Instanzkontext)
- **AND** der Debug-Log-Level aktiv ist (`logger.isLevelEnabled('debug')` als Guard)
- **THEN** erzeugt das System begrenzte oder gesampelte `debug`-Log-Einträge mit `subject_ref` (pseudonymisiert), `user_instance_id` und `expected_instance_id`

#### Scenario: Detail-Logs sind begrenzt

- **WHEN** in einem Sync-Lauf sehr viele User übersprungen werden
- **THEN** werden Detail-Logs pro Request begrenzt oder gesampelt
- **AND** die Gesamtsituation bleibt über ein Summary-Log nachvollziehbar

#### Scenario: Keine Debug-Logs bei inaktivem Level

- **WHEN** ein Keycloak-User beim Sync übersprungen wird
- **AND** der Debug-Log-Level nicht aktiv ist
- **THEN** werden keine `debug`-Log-Einträge erzeugt und keine Log-Objekte konstruiert (Performance-Schutz)

#### Scenario: Zusammenfassung der übersprungenen User

- **WHEN** der Keycloak-Sync abgeschlossen ist und User übersprungen wurden
- **THEN** erzeugt das System einen `info`-Log-Eintrag mit `skipped_count` und `sample_instance_ids` (kommaseparierter String der gefundenen instanceId-Werte, max. 5 verschiedene)
- **AND** der Eintrag enthält `request_id` und `trace_id` via `buildLogContext({ includeTraceId: true })`

#### Scenario: Keine Zusammenfassung bei null Übersprungenen

- **WHEN** der Keycloak-Sync abgeschlossen ist und keine User übersprungen wurden
- **THEN** wird kein `debug`-Log und kein `info`-Summary-Log für übersprungene User erzeugt

### Requirement: Client-seitige Fehlerberichtung

Das System SHALL client-seitige API-Fehler nur im Development-Modus strukturiert in der Browser-Konsole protokollieren, um Korrelation zwischen Client- und Server-Fehlern zu ermöglichen, ohne Produktions-Logs im Browser zu erzeugen.

#### Scenario: Fehler-Log bei API-Fehler

- **WHEN** `requestJson` im Development-Modus eine nicht-erfolgreiche API-Response erhält (HTTP 4xx/5xx mit JSON-Body)
- **THEN** erzeugt das System einen `console.error`-Eintrag mit `request_id`, `status` und `code`
- **AND** der Eintrag enthält **keinen** Response-Body, Request-Payload oder PII

#### Scenario: Kein Browser-Logging in Produktion

- **WHEN** `requestJson` in einem Produktions-Build einen API-Fehler verarbeitet
- **THEN** erzeugt das System keinen `console.error`-Eintrag
- **AND** die Korrelation erfolgt über Server-Logs und den `X-Request-Id`-Response-Header

#### Scenario: Korrelation bei Non-JSON-Response

- **WHEN** `requestJson` eine nicht-JSON-Response erhält (z. B. HTML-Fehlerseite)
- **THEN** wird `request_id` aus dem `X-Request-Id`-Response-Header extrahiert (Fallback)
- **AND** der `console.error`-Eintrag enthält `request_id` (oder `undefined` wenn Header fehlt), `status` und `code: 'non_json_response'`

#### Scenario: Kein Body-Logging

- **WHEN** `requestJson` einen Fehler loggt
- **THEN** werden weder Request-Body noch Response-Body im Log-Eintrag enthalten
- **AND** es werden keine Klartext-Tokens, Session-IDs oder E-Mail-Adressen geloggt

### Requirement: Rückwärtskompatibler IAM-v1-Fehlervertrag

Das System MUST für bereits dokumentierte stabile IAM-v1-Endpunkte den öffentlichen Fehlervertrag rückwärtskompatibel halten.

#### Scenario: Maschinenlesbarer Fehlercode bleibt stabil

- **WHEN** ein stabiler IAM-v1-Endpunkt eine Fehlerantwort liefert
- **THEN** bleibt das Feld `error` ein String-Code
- **AND** bestehende Konsumenten müssen ihre Parser nicht auf ein Objekt unter `error` umstellen

#### Scenario: Öffentliche Diagnoseinformation bleibt additiv

- **WHEN** zusätzlich ein Feld `message` in einer IAM-v1-Fehlerantwort vorhanden ist
- **THEN** ist dieses Feld additiv und optional
- **AND** es ist nicht für Client-Logik bestimmt
- **AND** es enthält keine rohen Exception-Texte, Stack-Fragmente oder Provider-Interna

#### Scenario: Request-ID-Header ist für Support-Korrelation verfügbar

- **WHEN** ein stabiler IAM-v1-Endpunkt eine Response erzeugt, auch bei Fehlern oder Non-JSON-Fallbacks
- **THEN** enthält die Response best-effort den Header `X-Request-Id`
- **AND** Clients und Support-Tools können damit Browser-, Netzwerk- und Server-Sicht korrelieren
