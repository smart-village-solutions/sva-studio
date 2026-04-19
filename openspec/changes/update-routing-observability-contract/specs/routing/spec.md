## ADDED Requirements

### Requirement: Routing Decision Observability
Das System SHALL für `@sva/routing` einen einheitlichen, typisierten Observability-Vertrag bereitstellen, über den routing-relevante Entscheidungen und Anomalien strukturiert emittiert werden können, ohne direkte `console.*`-Nutzung im Package zu erzwingen.

#### Scenario: Routing verwendet einen expliziten Diagnostics-Vertrag
- **WHEN** Guard-, Plugin- oder Dispatch-Logik in `@sva/routing` ein beobachtbares Ereignis emittiert
- **THEN** erfolgt die Emission über einen expliziten Routing-Diagnostics- oder Logger-Vertrag
- **AND** die framework-agnostische Routing-Logik bleibt von konkreten Transporten wie Console oder OTEL getrennt
- **AND** client-shared Routing-Dateien (`protected.routes.ts`, `account-ui.routes.ts`, `app.routes.shared.ts`, `route-search.ts`) enthalten **keinen Runtime-Import** aus `@sva/sdk` oder `@sva/sdk/server`
- **AND** der Diagnostics-Hook ist ein optionaler Parameter (Dependency-Injection) mit No-op-Default; die Hook-Typ-Definition lebt als reine `interface`-Deklaration in `@sva/routing` ohne SDK-Import

#### Scenario: Diagnostics-Hook-Injektion über Options-Parameter
- **WHEN** ein Consumer `createProtectedRoute()` oder `getPluginRouteFactories()` aufruft
- **THEN** kann ein optionaler `diagnostics`-Parameter vom Typ `RoutingDiagnosticsHook` übergeben werden
- **AND** fehlt dieser Parameter, wird ein No-op-Fallback verwendet
- **AND** der Hook ist eine synchrone Callback-Funktion ohne Rückgabewert, die keine Exceptions propagiert

#### Scenario: Browser-Produktion bleibt standardmäßig still
- **WHEN** clientseitige Routing-Logik in einer Produktionsumgebung ohne expliziten Diagnostics-Hook ausgeführt wird
- **THEN** entstehen daraus keine unkontrollierten Browser-Logs
- **AND** der Vertrag erlaubt stattdessen einen No-op-Fallback
- **AND** das `@sva/routing`-Package enthält im eigenen Code keinerlei `console.*`-Aufrufe (Enforcement via ESLint)

#### Scenario: Kein Diagnostics-Event ohne Aktion verifizierbar
- **WHEN** ein Guard den Zugriff erlaubt oder eine erwartete Normalisierung ohne Anomalie läuft
- **THEN** MUSS der injizierte Diagnostics-Hook nachweislich **nicht aufgerufen** worden sein
- **AND** die Implementierung erlaubt dies durch den injizierten Hook als Mock-Funktion in Tests zu verifizieren

### Requirement: Guard Decision Logging
Guard-basierte Routing-Entscheidungen SHALL bei Zugriffsdialogik und Redirect-Denials strukturierte Diagnoseereignisse erzeugen, damit Authentifizierungs- und Autorisierungsprobleme nachvollziehbar bleiben.

#### Scenario: Unauthentifizierter Zugriff auf geschützte Route
- **WHEN** `createProtectedRoute()` einen Benutzer auf den Login-Pfad umleitet, weil kein User-Kontext vorhanden ist
- **THEN** erzeugt der Routing-Vertrag ein strukturiertes Ereignis für einen Guard-Denial mit Log-Level `info`
- **AND** das Ereignis enthält `event: "routing.guard.access_denied"`, `route` (normalisierter Template-Pfad, z. B. `/admin/users/$userId`), `reason: "unauthenticated"` und den sanitisierten Redirect-Zielpfad **ohne Query-Parameter**
- **AND** `route` enthält **niemals** den aufgelösten Pfad mit konkreten IDs oder Werten

#### Scenario: Fehlende Rolle auf geschützter Route
- **WHEN** `createProtectedRoute()` oder `createAdminRoute()` wegen fehlender Rollen auf einen Fallback-Pfad umleitet
- **THEN** erzeugt der Routing-Vertrag ein strukturiertes Ereignis für einen Guard-Denial mit Log-Level `info`
- **AND** das Ereignis enthält `event: "routing.guard.access_denied"`, `route` (normalisierter Template-Pfad), `reason: "insufficient-role"` und nur die **Rollennamen ohne Kontext-Identifier** als Liste
- **AND** zusammengesetzte Claim-Strings wie `tenant:abc:admin` werden auf den Rollenname-Anteil reduziert oder verworfen

#### Scenario: Erfolgreicher Guard ohne Anomalie bleibt still
- **WHEN** ein Guard den Zugriff erlaubt und keine auffällige Korrektur oder Fehlersituation vorliegt
- **THEN** wird kein operatives Standard-Log für die erfolgreiche Navigation erzeugt

### Requirement: Plugin Routing Observability
Plugin-Routing SHALL Konfigurations- und Guard-Anomalien strukturiert sichtbar machen, ohne normale Plugin-Routenauflösung zu verrauschen.

#### Scenario: Nicht unterstütztes Plugin-Guard-Mapping
- **WHEN** `getPluginRouteFactories()` eine Plugin-Route mit einem Guard registriert, der nicht auf einen bekannten Account-Guard abgebildet werden kann
- **THEN** erzeugt das System **einmalig bei der Factory-Erstellung** ein strukturiertes Diagnoseereignis mit `event: "routing.plugin.guard_unsupported"`, `plugin`, `route` und `reason: "unsupported-plugin-guard"`
- **AND** das Ereignis verwendet `warn`-Schweregrad
- **AND** das Ereignis wird **nicht** in `beforeLoad`-Callbacks emittiert, um wiederholtes Feuern bei jeder Navigation zu verhindern

#### Scenario: Unterstütztes Plugin-Guard-Mapping bleibt ohne Noise
- **WHEN** eine Plugin-Route erfolgreich auf einen bekannten Guard gemappt und registriert wird
- **THEN** wird dafür kein reguläres operatives Erfolgslog erzeugt

## MODIFIED Requirements

### Requirement: Handler Error Observability
Auth-Route-Handler und routing-nahe Server-Dispatch-Pfade SHALL bei unbehandelten Fehlern und relevanten Dispatch-Anomalien strukturierte Logs mit Correlation-IDs erzeugen, um serverseitige Fehlerpfade im Monitoring sichtbar zu machen.

#### Scenario: Error-Boundary loggt mit Kontext
- **WHEN** ein Auth-Route-Handler einen unbehandelten Fehler wirft
- **THEN** erzeugt die Error-Boundary einen `error`-Log-Eintrag über den SDK Logger mit `component: 'auth-routing'`
- **AND** der Eintrag enthält `event: "routing.handler.error_caught"`, `request_id` (aus `@sva/sdk/server`-Extraktion, Pflicht für Server-Handler), `trace_id` (aus `@sva/sdk/server`-Extraktion, Pflicht für Server-Handler), `route`, `method`, `error_type`, `error_message`
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
- **THEN** erzeugt der Server ein strukturiertes Routing-Ereignis mit `event: "routing.handler.method_not_allowed"`, `warn`-Schweregrad
- **AND** das Ereignis enthält mindestens `route`, `method`, `allow` und best-effort `request_id`, `trace_id`
- **AND** der Client erhält weiterhin eine JSON-405-Response
- **AND** Health-Check-Routen (`/health/ready`, `/health/live`, `/api/v1/iam/health/ready`, `/api/v1/iam/health/live`) sind von diesem Logging **explizit ausgenommen**

#### Scenario: JSON-Response bei Handler-Fehler
- **WHEN** ein Auth-Route-Handler einen unbehandelten Fehler wirft
- **THEN** antwortet der Server mit HTTP 500 und einem JSON-Body `{ error: "internal_error", message: "Ein unerwarteter Fehler ist aufgetreten." }`
- **AND** der Response-Shape wird über den gemeinsamen `toJsonErrorResponse()`-Utility aus `@sva/sdk/server` erzeugt
- **AND** keine Stack-Traces oder internen Details werden an den Client übermittelt
