## ADDED Requirements

### Requirement: Routing Decision Observability
Das System SHALL für `@sva/routing` einen einheitlichen, typisierten Observability-Vertrag bereitstellen, über den routing-relevante Entscheidungen und Anomalien strukturiert emittiert werden können, ohne direkte `console.*`-Nutzung im Package zu erzwingen.

#### Scenario: Routing verwendet einen expliziten Diagnostics-Vertrag
- **WHEN** Guard-, Plugin-, Search- oder Dispatch-Logik in `@sva/routing` ein beobachtbares Ereignis emittiert
- **THEN** erfolgt die Emission über einen expliziten Routing-Diagnostics- oder Logger-Vertrag
- **AND** die framework-agnostische Routing-Logik bleibt von konkreten Transporten wie Console oder OTEL getrennt

#### Scenario: Browser-Produktion bleibt standardmäßig still
- **WHEN** clientseitige Routing-Logik in einer Produktionsumgebung ohne expliziten Diagnostics-Hook ausgeführt wird
- **THEN** entstehen daraus keine unkontrollierten Browser-Logs
- **AND** der Vertrag erlaubt stattdessen einen No-op-Fallback

### Requirement: Guard Decision Logging
Guard-basierte Routing-Entscheidungen SHALL bei Zugriffsdialogik und Redirect-Denials strukturierte Diagnoseereignisse erzeugen, damit Authentifizierungs- und Autorisierungsprobleme nachvollziehbar bleiben.

#### Scenario: Unauthentifizierter Zugriff auf geschützte Route
- **WHEN** `createProtectedRoute()` einen Benutzer auf den Login-Pfad umleitet, weil kein User-Kontext vorhanden ist
- **THEN** erzeugt der Routing-Vertrag ein strukturiertes Ereignis für einen Guard-Denial
- **AND** das Ereignis enthält mindestens `route`, `reason: "unauthenticated"`, den sanitisierten Redirect-Zielpfad und best-effort Kontextfelder

#### Scenario: Fehlende Rolle auf geschützter Route
- **WHEN** `createProtectedRoute()` oder `createAdminRoute()` wegen fehlender Rollen auf einen Fallback-Pfad umleitet
- **THEN** erzeugt der Routing-Vertrag ein strukturiertes Ereignis für einen Guard-Denial
- **AND** das Ereignis enthält mindestens `route`, `reason: "insufficient_role"` und eine safe Darstellung der geforderten Rollen

#### Scenario: Erfolgreicher Guard ohne Anomalie bleibt still
- **WHEN** ein Guard den Zugriff erlaubt und keine auffällige Korrektur oder Fehlersituation vorliegt
- **THEN** wird kein operatives Standard-Log für die erfolgreiche Navigation erzeugt

### Requirement: Plugin Routing Observability
Plugin-Routing SHALL Konfigurations- und Guard-Anomalien strukturiert sichtbar machen, ohne normale Plugin-Routenauflösung zu verrauschen.

#### Scenario: Nicht unterstütztes Plugin-Guard-Mapping
- **WHEN** eine Plugin-Route einen Guard referenziert, der vom Routing-Package nicht auf einen bekannten Account-Guard abgebildet werden kann
- **THEN** erzeugt das System ein strukturiertes Diagnoseereignis mit `plugin`, `route` und `reason: "unsupported_plugin_guard"`
- **AND** das Ereignis verwendet mindestens `warn`-Schweregrad

#### Scenario: Unterstütztes Plugin-Guard-Mapping bleibt ohne Noise
- **WHEN** eine Plugin-Route erfolgreich auf einen bekannten Guard gemappt und registriert wird
- **THEN** wird dafür kein reguläres operatives Erfolgslog erzeugt

### Requirement: Search Parameter Observability
Routing-relevante Search-Param-Normalisierung SHALL nur dann Diagnoseereignisse erzeugen, wenn eine sicherheits-, diagnose- oder supportrelevante Korrektur stattfindet.

#### Scenario: Ungültiger routing-relevanter Search-Parameter wird korrigiert
- **WHEN** eine Search-Normalisierungsfunktion einen ungültigen routing-relevanten Wert auf einen sicheren Default zurücksetzt
- **THEN** kann der Routing-Vertrag ein strukturiertes Diagnoseereignis emittieren
- **AND** das Ereignis enthält den Parameternamen, den Korrekturgrund und nur sanitierte Werte oder Kategorien

#### Scenario: Normale Search-Normalisierung ohne Auffälligkeit bleibt still
- **WHEN** Search-Parameter bereits gültig sind oder eine Korrektur keinen diagnosewürdigen Mehrwert liefert
- **THEN** wird kein Standard-Log erzeugt

## MODIFIED Requirements

### Requirement: Handler Error Observability
Auth-Route-Handler und routing-nahe Server-Dispatch-Pfade SHALL bei unbehandelten Fehlern und relevanten Dispatch-Anomalien strukturierte Logs mit Correlation-IDs erzeugen, um serverseitige Fehlerpfade im Monitoring sichtbar zu machen.

#### Scenario: Error-Boundary loggt mit Kontext
- **WHEN** ein Auth-Route-Handler einen unbehandelten Fehler wirft
- **THEN** erzeugt die Error-Boundary einen `error`-Log-Eintrag über den SDK Logger mit `component: 'auth-routing'`
- **AND** der Eintrag enthält `event`, `request_id` (aus validiertem `X-Request-Id`-Header, best-effort), `trace_id` (aus validiertem `traceparent`-Header, best-effort), `route`, `method`, `error_type`, `error_message`
- **AND** der Eintrag enthält **kein** `error.stack`-Feld
- **AND** es wird kein `console.error` verwendet

#### Scenario: Error-Boundary bei Non-Error-Throws
- **WHEN** ein Auth-Route-Handler einen Nicht-Error-Wert wirft (z. B. String, Object, `null`)
- **THEN** erzeugt die Error-Boundary trotzdem einen `error`-Log-Eintrag
- **AND** `error_type` enthält `typeof`-Ergebnis oder Konstruktorname als Fallback
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
- **AND** der Fallback enthält nur Safe-Felder wie `component`, `event`, `route`, `method`, `error_type` und best-effort `request_id`
- **AND** das rohe Error-Objekt und Stack-Traces werden nicht ausgegeben
- **AND** der Client erhält trotzdem eine JSON-500-Response

#### Scenario: Method not allowed wird observierbar
- **WHEN** ein bekannter Auth-/IAM-Route-Pfad mit einer nicht unterstützten HTTP-Methode aufgerufen wird
- **THEN** erzeugt der Server ein strukturiertes Routing-Ereignis für die Dispatch-Anomalie
- **AND** das Ereignis enthält mindestens `route`, `method`, `allow` und best-effort Korrelationsfelder
- **AND** der Client erhält weiterhin eine JSON-405-Response

#### Scenario: JSON-Response bei Handler-Fehler
- **WHEN** ein Auth-Route-Handler einen unbehandelten Fehler wirft
- **THEN** antwortet der Server mit HTTP 500 und einem JSON-Body `{ error: "internal_error", message: "Ein unerwarteter Fehler ist aufgetreten." }`
- **AND** der Response-Shape wird über den gemeinsamen `toJsonErrorResponse()`-Utility aus `@sva/sdk/server` erzeugt
- **AND** keine Stack-Traces oder internen Details werden an den Client übermittelt
