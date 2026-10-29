## MODIFIED Requirements

### Requirement: Einheitlicher Error-Response-Contract

Auth-Error-Boundaries SHALL einen einheitlichen JSON-Error-Response-Shape verwenden, um konsistente API-Antworten für Konsumenten sicherzustellen. Studio-eigene geschützte API-Antworten MUST unabhängig von einem frühen Return oder einer Exception eine sicher bestimmte Request-ID im Header `X-Request-Id` tragen. Bestehende flache und strukturierte Fehler-Envelopes MUST kompatibel bleiben; sichere Diagnose und Korrelation werden additiv ergänzt. Diese Anforderung ändert keine Antwortverträge des externen SVA Mainservers.

#### Scenario: Infrastruktur-Boundary und Business-Boundary nutzen gleichen Shape

- **WHEN** `wrapHandlersWithJsonErrorBoundary` (Infrastruktur) oder `withAuthenticatedIamHandler` (Business) einen Fehler abfängt
- **THEN** erzeugen beide für stabile IAM-v1-Endpunkte eine Response mit dem Shape `{ error: string, message?: string }`
- **AND** das Feld `error` bleibt der maschinenlesbare Fehlercode; `message` ist additiv und nicht für Client-Logik bestimmt
- **AND** beide nutzen den `toJsonErrorResponse()`-Utility aus `@sva/server-runtime`

#### Scenario: toJsonErrorResponse liefert korrektes Format

- **WHEN** `toJsonErrorResponse(500, 'internal_error', 'Ein unerwarteter Fehler ist aufgetreten.')` aufgerufen wird
- **THEN** wird eine `Response` mit Status 500, `Content-Type: application/json` und dem Body `{ "error": "internal_error", "message": "Ein unerwarteter Fehler ist aufgetreten." }` zurückgegeben

#### Scenario: Request-ID als stabiler Response-Header

- **WHEN** ein vom Studio beantworteter geschützter API-Endpunkt eine Response zurückgibt, auch im Fehlerfall
- **THEN** enthält die Response den Header `X-Request-Id` mit derselben sicheren ID wie das zugehörige serverseitige Ergebnisereignis
- **AND** wird eine fehlende oder ungültige eingehende Korrelations-ID an der vorhandenen Request-Grenze serverseitig ersetzt
- **AND** kann die ID von Clients und Support-Tools zur Korrelation verwendet werden

#### Scenario: Früher Guard-Return behält Korrelation

- **WHEN** Middleware, Tenant-/Modulguard, Principal-, Readiness-, CSRF- oder Parse-Prüfung vor dem Fachhandler eine Fehlerantwort erzeugt
- **THEN** trägt auch diese Antwort dieselbe Request-ID wie ihr abschließendes operatives Ergebnisereignis
- **AND** ist die Korrelation nicht davon abhängig, dass eine Exception geworfen wird
- **AND** wird der abgelehnte Fachhandler nicht ausgeführt

#### Scenario: Plugin-Fehler behält die Referenz

- **WHEN** eine Studio-Fehlerantwort durch HTTP-Client, Plugin-SDK, plugin-eigene Error-Factory und Übersetzung läuft
- **THEN** bleiben stabiler Fehlercode, sichere Klassifikation und Request-ID erhalten
- **AND** zeigt die vorhandene Fehlerfläche die kopierbare Referenz ohne Rohfehler, Credentials oder Stack an
