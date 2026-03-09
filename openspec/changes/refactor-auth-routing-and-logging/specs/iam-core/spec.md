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
- **THEN** enthält der `error`-Log-Eintrag `requestId` und `traceId` via `buildLogContext({ includeTraceId: true })`
- **AND** der Stack-Trace wird als `error.stack`-Feld mitgeloggt (nicht als separater String)

#### Scenario: Middleware-Logs mit Trace-Kontext

- **WHEN** Auth-Middleware einen Log-Eintrag erzeugt (z. B. bei Session-Auflösung oder Redirect)
- **THEN** enthält der Eintrag `trace_id` via `buildLogContext({ includeTraceId: true })`

## ADDED Requirements

### Requirement: Keycloak-Sync Debug-Logging

Das System SHALL beim Keycloak-User-Sync detaillierte Debug-Informationen für übersprungene Benutzer bereitstellen, um Multi-Tenant-Konfigurationsprobleme schnell diagnostizierbar zu machen.

#### Scenario: Einzeln übersprungene User geloggt

- **WHEN** ein Keycloak-User beim Sync übersprungen wird (kein passender Instanzkontext)
- **THEN** erzeugt das System einen `debug`-Log-Eintrag mit `keycloakUserId`, `email` (redacted), `userInstanceId`-Attribut und `expectedInstanceId`

#### Scenario: Zusammenfassung der übersprungenen User

- **WHEN** der Keycloak-Sync abgeschlossen ist und User übersprungen wurden
- **THEN** erzeugt das System einen `info`-Log-Eintrag mit `skippedCount` und einer Stichprobe der gefundenen `instanceId`-Werte (max. 5 verschiedene)
- **AND** der Eintrag enthält `requestId` und `traceId`
