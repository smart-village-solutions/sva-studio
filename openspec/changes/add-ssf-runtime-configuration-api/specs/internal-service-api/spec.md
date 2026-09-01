## ADDED Requirements

### Requirement: Interne Plugin-Service-Endpunkte laufen in einem hostgeführten Vertrag

Das System SHALL Plugins erlauben, ausdrücklich freigegebene interne Service-Endpunkte mit namespaced Action und gebundenem Plattform- oder Tenant-Scope zu deklarieren. Der Host MUST Authentifizierung, Autorisierung, Scope-Auflösung, Rate Limit, Fehlervertrag, Audit und Execution-Context besitzen; das Plugin implementiert ausschließlich Schema- und Fachlogik.

#### Scenario: Gültiger interner Plugin-Request erreicht den Handler

- **GIVEN** ein installiertes Plugin deklariert einen internen Tenant-Service-Endpunkt
- **AND** Service-Identität, Action und Tenant-Bindung sind gültig
- **WHEN** der Host den Request verarbeitet
- **THEN** erzeugt er einen tenantgebundenen Execution-Context
- **AND** ruft erst danach den registrierten Plugin-Handler auf

#### Scenario: Nicht freigegebener Service-Beitrag wird abgelehnt

- **GIVEN** Extension-Tier, Action oder Scope eines internen Plugin-Endpunkts ist nicht freigegeben
- **WHEN** der Host den Descriptor oder Request validiert
- **THEN** lehnt er den Beitrag beziehungsweise Request fail-closed ab
- **AND** führt keine Plugin-Fachlogik aus

### Requirement: Tenantgebundene interne Requests benötigen Service-Identität und signierte Assertion

Das System MUST für tenantgebundene interne Requests sowohl eine technische Service-Identität als auch eine kurzlebige, signierte Tenant-Assertion verlangen. Der Host MUST Signatur, Issuer, Audience, Gültigkeitsfenster, eindeutige Token-ID, Replay-Schutz, Action und Tenant-Bindung prüfen.

#### Scenario: Beide Nachweise sind gültig

- **GIVEN** ein Service-Token belegt einen freigegebenen Client und eine freigegebene Action
- **AND** eine gültige Tenant-Assertion bindet denselben Request an Tenant A
- **WHEN** der interne Endpoint aufgerufen wird
- **THEN** löst der Host Tenant A auf die kanonische `instanceId` auf
- **AND** bindet diese unveränderlich an den Execution-Context

#### Scenario: Freie instanceId reicht nicht aus

- **GIVEN** ein Request enthält nur eine `instanceId` in Pfad, Query, Body oder freiem Header
- **WHEN** er einen tenantgebundenen internen Endpoint aufruft
- **THEN** lehnt der Host den Request ohne gültige Tenant-Assertion ab
- **AND** erzeugt keinen Tenant-Execution-Context

#### Scenario: Assertion wird wiederverwendet oder widerspricht dem Kontext

- **GIVEN** eine Assertion wurde bereits verwendet, ist abgelaufen oder bindet einen anderen Tenant beziehungsweise eine andere Audience
- **WHEN** sie präsentiert wird
- **THEN** lehnt der Host den Request mit einem stabilen Auth- oder Scope-Fehler ab
- **AND** protokolliert er weder Tokeninhalt noch personenbezogene Nutzdaten

### Requirement: Interne Servicezugriffe berücksichtigen Aktivierung und Readiness

Das System SHALL vor Ausführung eines tenantbezogenen Plugin-Service-Handlers prüfen, dass Plugin und Instanz aktiv, nicht suspendiert und für den angeforderten Vertrag fachlich bereit sind.

#### Scenario: Deaktiviertes oder blockiertes Plugin erhält keinen Request

- **GIVEN** das Plugin ist für den Tenant deaktiviert, suspendiert oder seine erforderliche Readiness ist `blocked`
- **WHEN** ein ansonsten gültiger interner Request eingeht
- **THEN** lehnt der Host den Zugriff fail-closed mit einem stabilen Statuscode ab
- **AND** ruft den Plugin-Handler nicht auf
