# Capability: routing

## Purpose
Die Routing-Capability definiert, wie Routen aus Core und Plugins typsicher zusammengeführt und zur Laufzeit registriert werden.
## Requirements
### Requirement: Code-Route-Registry
Das System SHALL eine einzige öffentliche Routing-Schnittstelle in `@sva/routing` bereitstellen, die UI-, Auth- und Plugin-Routen zusammenführt und für pfadspezifische Handler-Mappings in Teilbereichen wie Auth-Routing als Single Source of Truth dient. App-lokale Parallel-Registrierungen DÜRFEN NICHT existieren.

#### Scenario: App bezieht alle produktiven Routen aus dem Routing-Package
- **WHEN** die Frontend-App ihren Router erzeugt
- **THEN** bezieht sie die Route-Factories ausschließlich aus `@sva/routing` oder `@sva/routing/server`
- **AND** die App liefert nur noch Root-Route, Context und Seiten-Bindings

#### Scenario: Produktive Seitenrouten sind code-based
- **WHEN** die Codebasis nach produktiven Seitenrouten durchsucht wird
- **THEN** liegen diese nicht in file-based Route-Dateien
- **AND** file-based Routing bleibt auf `__root.tsx` und notwendige TanStack-Integrationsartefakte reduziert

#### Scenario: Demo-Routen sind kein Teil des Produkt-Routings
- **WHEN** der produktive Route-Baum aufgebaut wird
- **THEN** enthält er keine `/demo`-Routen
- **AND** Demo- oder Sandbox-Routen benötigen einen separaten, expliziten Integrationseintrag

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

### Requirement: Fully-Qualified Plugin-Action-Bindings im Routing und UI
Das Routing-System MUST Plugin-Routen und zugehörige UI-Bindings so integrieren, dass deklarierte Plugin-Aktionen über ihre vollständig qualifizierten Action-IDs referenziert werden können.

#### Scenario: Host-App löst Plugin-Aktionsmetadaten zentral auf
- **WHEN** die Host-App Plugins registriert
- **THEN** baut sie neben Route- und Navigation-Registries auch eine zentrale Plugin-Action-Registry auf
- **AND** UI-Bindings können Titel, Owner und Guard-Metadaten über die fully-qualified Action-ID auflösen

#### Scenario: Plugin-UI nutzt deklarierte Action-ID statt impliziter String-Konvention
- **WHEN** eine Plugin-Oberfläche eine Aktion wie `news.create` rendert
- **THEN** liest sie den Titel- und Guard-Bezug aus der deklarierten Plugin-Action-Definition
- **AND** es existiert keine separate, ungebundene UI-Konvention für dieselbe Aktion

