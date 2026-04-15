# Capability: routing

## Purpose
Die Routing-Capability definiert, wie Routen aus Core und Plugins typsicher zusammengeführt und zur Laufzeit registriert werden.
## Requirements
### Requirement: Code-Route-Registry
Das System SHALL eine einzige öffentliche Routing-Schnittstelle in `@sva/routing` bereitstellen, die UI-, Auth- und Plugin-Routen zusammenführt und für pfadspezifische Handler-Mappings in Teilbereichen wie Auth-Routing als Single Source of Truth dient. App-lokale Parallel-Registrierungen DÜRFEN NICHT existieren.

#### Scenario: App bezieht alle produktiven Routen aus dem Routing-Package
- **WHEN** die App startet
- **THEN** werden UI-, Auth- und Plugin-Routen gemeinsam im Router registriert
- **AND** die App bezieht die Route-Factories ausschließlich aus `@sva/routing` oder `@sva/routing/server`

#### Scenario: Produktive Seitenrouten sind code-based
- **WHEN** die Codebasis nach produktiven Seitenrouten durchsucht wird
- **THEN** liegen diese nicht in file-based Route-Dateien
- **AND** file-based Routing bleibt auf `__root.tsx` und notwendige TanStack-Integrationsartefakte reduziert

#### Scenario: Auth-Route-Handler exhaustiv aufgelöst
- **WHEN** ein Auth-Route-Pfad zur Laufzeit aufgelöst wird
- **THEN** wird der zugehörige Handler aus einem typsicheren `Record<AuthRoutePath, Handler>`-Mapping geladen
- **AND** bei einem unbekannten Pfad wird ein expliziter Fehler geworfen statt eines stillschweigenden Fallbacks

#### Scenario: Fehlender Handler wird zur Compile-Time erkannt
- **WHEN** ein neuer Auth-Route-Pfad zum Union-Type hinzugefügt wird
- **AND** kein Handler-Eintrag im Mapping existiert
- **THEN** meldet der TypeScript-Compiler einen Fehler

#### Scenario: Keine redundanten Route-Registrierungen
- **WHEN** die Codebasis nach Route-Registrierungen durchsucht wird
- **THEN** existiert genau eine Route-Registry (`@sva/routing`)
- **AND** es gibt keine parallelen Pfad-Arrays oder Handler-Maps in anderen Packages

#### Scenario: Demo-Routen sind kein Teil des Produkt-Routings
- **WHEN** der produktive Route-Baum aufgebaut wird
- **THEN** enthält er keine `/demo`-Routen
- **AND** Demo- oder Sandbox-Routen benötigen einen separaten, expliziten Integrationseintrag

#### Scenario: Startup-Guard erkennt Abweichungen
- **WHEN** die Anwendung startet und das Routing-Modul importiert wird
- **THEN** prüft ein einmaliger Guard, ob alle `AuthRoutePath`-Einträge einen Handler im `authHandlerMap` haben
- **AND** bei Abweichung wird ein `warn`-Level-Log erzeugt mit den fehlenden oder überzähligen Pfaden
- **AND** die Anwendung startet trotzdem (kein `throw`, kein Startup-Blocker)
- **AND** der Guard läuft in Dev- und Produktionsmodus

### Requirement: Plugin-Route-Exports
Plugins SHALL eigene Routen als Exporte bereitstellen können, die von der Route-Registry aufgenommen werden.

#### Scenario: Plugin liefert Route-Definition
- **WHEN** ein Plugin eine Route exportiert
- **THEN** kann die App diese Route registrieren

### Requirement: Root-Level Error Boundary
Die App SHALL auf Root-Route-Ebene ein `errorComponent` bereitstellen, das unbehandelte Runtime-Fehler abfängt und eine benutzerfreundliche Fehlerseite rendert.

#### Scenario: Unbehandelter Runtime-Fehler in einer Route
- **WHEN** eine Route einen unbehandelten Fehler wirft
- **THEN** wird die Error-Fallback-Komponente gerendert
- **AND** der Benutzer sieht eine verständliche Fehlermeldung mit Retry-Option

#### Scenario: Fehlerseite ist barrierefrei
- **WHEN** die Error-Fallback-Komponente angezeigt wird
- **THEN** ist sie per Keyboard navigierbar
- **AND** Screen Reader erhalten `role="alert"` und `aria-live="assertive"`

### Requirement: Stabile Dependency-Versionen
Die App SHALL ausschließlich stabile Release-Versionen für Laufzeit-Dependencies verwenden und Framework-Versionen workspace-weit synchronisieren.

#### Scenario: Keine Nightly-Dependencies in Produktion
- **WHEN** die Dependency-Liste der App geprüft wird
- **THEN** enthält sie keine `nightly`-, `canary`- oder `latest`-Tags für Laufzeit-Dependencies

#### Scenario: TanStack-Router-Version synchronisiert
- **WHEN** `@tanstack/react-router` in mehreren Packages verwendet wird
- **THEN** ist die aufgelöste Version im gesamten Workspace identisch

### Requirement: Handler Error Observability
Auth-Route-Handler SHALL bei unbehandelten Fehlern strukturierte Logs mit Correlation-IDs erzeugen, um Server-seitige Fehlerpfade im Monitoring sichtbar zu machen.

#### Scenario: Error-Boundary loggt mit Kontext
- **WHEN** ein Auth-Route-Handler einen unbehandelten Fehler wirft
- **THEN** erzeugt die Error-Boundary einen `error`-Log-Eintrag über den SDK Logger mit `component: 'auth-routing'`
- **AND** der Eintrag enthält `request_id` (aus validiertem `X-Request-Id`-Header, best-effort), `trace_id` (aus validiertem `traceparent`-Header, best-effort), `route`, `method`, `error_type`, `error_message`
- **AND** der Eintrag enthält **kein** `error.stack`-Feld (Observability Best Practices)
- **AND** es wird kein `console.error` verwendet

#### Scenario: Error-Boundary bei Non-Error-Throws
- **WHEN** ein Auth-Route-Handler einen Nicht-Error-Wert wirft (z. B. String, Object, `null`)
- **THEN** erzeugt die Error-Boundary trotzdem einen `error`-Log-Eintrag
- **AND** `error_type` enthält `typeof`-Ergebnis als Fallback (z. B. `'string'`, `'object'`)
- **AND** `error_message` enthält `String(error)` als Fallback

#### Scenario: Error-Boundary bei fehlenden Headern
- **WHEN** ein Auth-Route-Handler fehlschlägt und der Request keine `X-Request-Id` oder `traceparent`-Header hat
- **THEN** enthält der Log-Eintrag `request_id: undefined` und `trace_id: undefined`
- **AND** `route` und `method` sind weiterhin als Korrelationsersatz vorhanden
- **AND** die Error-Boundary wirft keinen eigenen Fehler

#### Scenario: Error-Boundary bei ungültigen Headern
- **WHEN** ein Auth-Route-Handler fehlschlägt und `X-Request-Id` oder `traceparent` ungültig formatiert sind
- **THEN** werden die ungültigen Headerwerte verworfen
- **AND** der Log-Eintrag enthält `request_id: undefined` und/oder `trace_id: undefined`
- **AND** kein ungefilterter Headerwert erscheint im Log-Eintrag

#### Scenario: SDK-Logger-Fallback
- **WHEN** der SDK Logger bei der Fehlerbehandlung selbst eine Exception wirft
- **THEN** wird ein sanitierter Minimal-JSON-Eintrag auf `process.stderr` geschrieben
- **AND** der Fallback enthält nur Safe-Felder wie `component`, `route`, `method`, `error_type` und best-effort `request_id`
- **AND** das rohe Error-Objekt und Stack-Traces werden nicht ausgegeben
- **AND** der Client erhält trotzdem eine JSON-500-Response

#### Scenario: JSON-Response bei Handler-Fehler
- **WHEN** ein Auth-Route-Handler einen unbehandelten Fehler wirft
- **THEN** antwortet der Server mit HTTP 500 und einem JSON-Body `{ error: "internal_error", message: "Ein unerwarteter Fehler ist aufgetreten." }`
- **AND** der Response-Shape wird über den gemeinsamen `toJsonErrorResponse()`-Utility aus `@sva/sdk/server` erzeugt
- **AND** keine Stack-Traces oder interne Details werden an den Client übermittelt

### Requirement: Einheitlicher Error-Response-Contract
Auth-Error-Boundaries SHALL einen einheitlichen JSON-Error-Response-Shape verwenden, um konsistente API-Antworten für Konsumenten sicherzustellen.

#### Scenario: Infrastruktur-Boundary und Business-Boundary nutzen gleichen Shape
- **WHEN** `wrapHandlersWithJsonErrorBoundary` (Infrastruktur) oder `withAuthenticatedIamHandler` (Business) einen Fehler abfängt
- **THEN** erzeugen beide für stabile IAM-v1-Endpunkte eine Response mit dem Shape `{ error: string, message?: string }`
- **AND** das Feld `error` bleibt der maschinenlesbare Fehlercode; `message` ist additiv und nicht für Client-Logik bestimmt
- **AND** beide nutzen den `toJsonErrorResponse()`-Utility aus `@sva/sdk/server`

#### Scenario: toJsonErrorResponse liefert korrektes Format
- **WHEN** `toJsonErrorResponse(500, 'internal_error', 'Ein unerwarteter Fehler ist aufgetreten.')` aufgerufen wird
- **THEN** wird eine `Response` mit Status 500, `Content-Type: application/json` und dem Body `{ "error": "internal_error", "message": "Ein unerwarteter Fehler ist aufgetreten." }` zurückgegeben

#### Scenario: Request-ID als stabiler Response-Header
- **WHEN** ein IAM-Endpunkt eine Response zurückgibt, auch im Fehlerfall
- **THEN** enthält die Response best-effort den Header `X-Request-Id`
- **AND** der Header kann von Clients und Support-Tools zur Korrelation mit Server-Logs verwendet werden

### Requirement: Kontrollierter Silent-SSO-Routing-Vertrag
Das System SHALL für den Auth-Router einen expliziten, kontrollierten Silent-SSO-Vertrag bereitstellen.

#### Scenario: Silent Login über bestehenden Auth-Pfad

- **WHEN** `/auth/login?silent=1` aufgerufen wird
- **THEN** verwendet der Auth-Handler denselben OIDC-Flow wie der aktive Login
- **AND** setzt bei der Authorize-Anfrage `prompt=none`
- **AND** verwendet weiter dieselben Schutzmechanismen für `state`, `nonce` und PKCE

#### Scenario: Silent Callback antwortet iframe-sicher

- **WHEN** ein stiller Login über `/auth/callback` erfolgreich oder fehlerhaft abgeschlossen wird
- **THEN** antwortet der Handler mit einer iframe-sicheren HTML-Response statt mit einem normalen App-Redirect
- **AND** die Response signalisiert Erfolg oder Fehler an den aufrufenden Browserkontext
- **AND** normale interaktive Login-Callbacks behalten ihr Redirect-Verhalten bei
