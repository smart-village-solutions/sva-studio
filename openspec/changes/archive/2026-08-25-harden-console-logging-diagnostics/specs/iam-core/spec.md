## ADDED Requirements

### Requirement: IAM-Fehlerketten erzeugen genau ein kanonisches operatives Ereignis

Das System MUST für eine zusammenhängende IAM-Fehlerkette genau eine verantwortliche Logging-Grenze bestimmen. Innere Schichten MUST stabile Fehlercodes und sichere Kontextfelder propagieren, dürfen denselben Fehler jedoch nicht zusätzlich als operatives Fehlerereignis protokollieren. Die äußere Auth-Routengrenze MUST das abschließende Ergebnis mit Request-Korrelation und angemessenem Schweregrad protokollieren.

#### Scenario: Tenant-Auflösung schlägt erwartbar fehl

- **WHEN** die Tenant-Auflösung mit einem klassifizierten erwartbaren Fehler endet
- **THEN** propagiert die innere Konfigurationsschicht den stabilen Fehlercode ohne eigenes kanonisches Fehlerereignis
- **AND** emittiert die Auth-Routengrenze genau ein korreliertes Ereignis für das abschließende Ergebnis
- **AND** ist dessen Level höchstens `warn`

#### Scenario: Unerwarteter IAM-Fehler endet als 5xx

- **WHEN** ein unerwarteter IAM-Fehler zu einem 5xx-Ergebnis führt
- **THEN** emittiert die verantwortliche Auth-Routengrenze genau ein strukturiertes `error`-Ereignis
- **AND** enthalten innere Schichten keine Duplikate desselben operativen Ereignisses

### Requirement: IAM-Diagnostik begrenzt Request- und Providerdaten

Das System MUST IAM-Request-Diagnostik auf sichere Route-Templates oder Pfade ohne Query-String begrenzen. Providerfehler MUST über stabile interne Codes, Status und Retry-Klassen beschrieben werden; freie Provider-Fehlertexte dürfen nicht ungefiltert protokolliert werden.

#### Scenario: Sessionfehler tritt auf einer URL mit Query auf

- **WHEN** ein Sessionfehler bei einem Request mit Query-Parametern erkannt wird
- **THEN** enthält das IAM-Log den sicheren Pfad oder das Route-Template
- **AND** enthält es keine Query-Parameter oder vollständige URL

#### Scenario: Keycloak liefert eine Fehlerbeschreibung

- **WHEN** Keycloak einen Fehlerstatus und eine freie Fehlerbeschreibung liefert
- **THEN** klassifiziert IAM den Fehler mit einem stabilen internen Code
- **AND** protokolliert es die freie Beschreibung nicht ungefiltert
