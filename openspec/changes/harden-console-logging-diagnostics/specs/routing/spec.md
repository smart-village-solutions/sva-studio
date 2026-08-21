## MODIFIED Requirements

### Requirement: Handler Error Observability

Auth-Route-Handler und routing-nahe Server-Dispatch-Pfade SHALL innerhalb eines isolierten request-lokalen Korrelationskontexts laufen und bei unbehandelten Fehlern sowie relevanten Dispatch-Anomalien strukturierte Logs erzeugen. Der Kontext MUST vor Sonder-, Auth-, Mainserver- oder regulärem Studio-Dispatch beginnen und unabhängig von OTEL- sowie optionalen Diagnoseschaltern verfügbar sein. Jeder HTTP-Request MUST eine gültige `request_id` besitzen; eine `trace_id` darf nur aus einem gültigen eingehenden oder aktiven Tracing-Kontext stammen. Korrelations-IDs dienen ausschließlich der Diagnose und dürfen keine Security- oder Idempotenzentscheidung beeinflussen.

#### Scenario: Request-Kontext beginnt vor jedem fachlichen Dispatch

- **WHEN** ein Request von einer Sonder-, Auth-, Mainserver- oder regulären Studio-Route verarbeitet wird
- **THEN** laufen deren Handler und nachgelagerte synchrone Server-Logs innerhalb desselben Request-Kontexts
- **AND** steht vor dem ersten fachlichen Dispatch eine gültige `request_id` zur Verfügung
- **AND** ist der Kontext nicht von einem OTEL- oder optionalen Diagnoseschalter abhängig

#### Scenario: Error-Boundary loggt mit Kontext

- **WHEN** ein Auth-Route-Handler einen unbehandelten Fehler wirft
- **THEN** erzeugt die Error-Boundary ein `error`-Log-Ereignis über den Server-Runtime-Logger mit `component: 'auth-routing'`
- **AND** enthält der Eintrag `event: "routing.handler.error_caught"`, `request_id`, optional eine echte `trace_id`, `route`, `method`, `error_type` und einen stabilen `error_code`
- **AND** ist `error_message` optional und ausschließlich nach sicherer Klassifizierung beziehungsweise Sanitization zulässig
- **AND** enthält der Eintrag kein `error.stack`-Feld
- **AND** wird kein `console.error` verwendet

#### Scenario: Error-Boundary bei Non-Error-Throws

- **WHEN** ein Auth-Route-Handler einen Nicht-Error-Wert wirft, etwa einen String, ein Objekt oder `null`
- **THEN** erzeugt die Error-Boundary trotzdem ein `error`-Log-Ereignis
- **AND** klassifiziert `error_type` den Nicht-Error-Throw sicher und stabil
- **AND** wird der rohe geworfene Wert weder serialisiert noch als freie Fehlermeldung protokolliert

#### Scenario: Eingehende Korrelations-IDs fehlen

- **WHEN** ein Request keine gültige `X-Request-Id` und keinen gültigen Trace-Kontext besitzt
- **THEN** erzeugt der Server vor dem ersten fachlichen Dispatch eine sichere lokale `request_id`
- **AND** verwendet er sie konsistent im gesamten Request und in der bestehenden Response-Propagation
- **AND** erfindet er keine `trace_id`

#### Scenario: Eingehende Korrelations-IDs sind ungültig

- **WHEN** `X-Request-Id`, `X-Correlation-Id`, `traceparent` oder ein vergleichbarer Korrelationsheader ungültig formatiert ist
- **THEN** verwirft der Server den ungültigen Wert
- **AND** erzeugt er eine sichere lokale `request_id`, falls keine andere gültige Request-Korrelation vorhanden ist
- **AND** bleibt `trace_id` ohne anderen echten Trace-Kontext leer
- **AND** erscheint kein ungefilterter Headerwert im Log-Ereignis

#### Scenario: Requests werden parallel verarbeitet

- **WHEN** zwei Requests mit unterschiedlichen Korrelations-IDs zeitlich überlappen
- **THEN** sieht jeder Handler ausschließlich seinen eigenen Kontext
- **AND** übernimmt kein Log-Ereignis die IDs des anderen Requests

#### Scenario: Unabhängige Hintergrundarbeit wird losgelöst

- **WHEN** Worker-Bootstrap oder andere bewusst unabhängige Hintergrundarbeit aus dem Serverprozess gestartet wird
- **THEN** läuft sie außerhalb beziehungsweise explizit losgelöst vom HTTP-Request-Kontext
- **AND** erfindet sie keine HTTP-Request-ID
- **AND** verwendet sie eine vorhandene Job-, Execution- oder vergleichbare Ausführungskorrelation

#### Scenario: Server-Runtime-Logger-Fallback

- **WHEN** der Server-Runtime-Logger bei der Fehlerbehandlung selbst eine Exception wirft
- **THEN** wird ein sanitierter Minimal-JSON-Eintrag auf `process.stderr` geschrieben
- **AND** enthält der Fallback nur Safe-Felder wie `component`, `event`, `route`, `method`, `error_type`, `error_code` und best-effort `request_id`
- **AND** werden das rohe Error-Objekt, freie Providertexte und Stack-Traces nicht ausgegeben
- **AND** erhält der Client trotzdem eine JSON-500-Response

#### Scenario: Method not allowed wird observierbar

- **WHEN** ein bekannter Auth-/IAM-Route-Pfad mit einer nicht unterstützten HTTP-Methode aufgerufen wird
- **THEN** erzeugt der Server ein strukturiertes Routing-Ereignis mit `event: "routing.handler.method_not_allowed"` und höchstens `warn`-Schweregrad
- **AND** enthält das Ereignis mindestens `route`, `method`, `allow`, `request_id` und optional eine echte `trace_id`
- **AND** erhält der Client weiterhin eine JSON-405-Response
- **AND** sind Health-Check-Routen (`/health/ready`, `/health/live`, `/api/v1/iam/health/ready`, `/api/v1/iam/health/live`) von diesem Einzelereignis explizit ausgenommen

#### Scenario: JSON-Response bei Handler-Fehler

- **WHEN** ein Auth-Route-Handler einen unbehandelten Fehler wirft
- **THEN** antwortet der Server mit HTTP 500 und einem JSON-Body `{ error: "internal_error", message: "Ein unerwarteter Fehler ist aufgetreten." }`
- **AND** wird der Response-Shape über den gemeinsamen `toJsonErrorResponse()`-Utility aus `@sva/server-runtime` erzeugt
- **AND** werden keine Stack-Traces oder internen Details an den Client übermittelt
