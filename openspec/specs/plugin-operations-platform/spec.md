# plugin-operations-platform Specification

## Purpose
TBD - created by archiving change update-plugin-platform-for-generic-jobs-imports. Update Purpose after archive.
## Requirements
### Requirement: Plugin-Operations sind hostgeführte Plattformbeiträge

Das System SHALL generische Plugin-Jobs und strukturierte Importprofile als hostgeführte Plattformbeiträge modellieren.

#### Scenario: Plugin registriert Jobtypen und Importprofile deklarativ

- **WHEN** ein Plugin langlaufende Operationen oder strukturierte Importe anbieten will
- **THEN** registriert es dafür deklarative Jobtypen und Importprofile über den kanonischen Plugin-Vertrag
- **AND** es führt keine eigene parallele Plattform-Registry für dieselben Fähigkeiten ein

### Requirement: Jobtypen werden über den Plugin-Vertrag registriert

Das System SHALL fachliche Jobtypen über einen expliziten Plugin-Vertrag registrieren.

#### Scenario: Plugin registriert einen Jobtyp

- **WHEN** ein Plugin einen generischen Studio-Job anbieten will
- **THEN** enthält sein Beitrag mindestens eine technische Kennung, einen owning Namespace und den fachlichen Bezug
- **AND** Kollisionen oder Namespace-Verstöße werden bei der Host-Validierung deterministisch abgewiesen

### Requirement: Importprofile werden über den Plugin-Vertrag registriert

Das System SHALL strukturierte Importprofile über einen expliziten Plugin-Vertrag registrieren.

#### Scenario: Plugin registriert ein Importprofil

- **WHEN** ein Plugin einen strukturierten Import anbieten will
- **THEN** enthält das Importprofil mindestens eine technische Kennung, erlaubte Quellformate, Schema-/Mapping-Erwartungen und Validierungsmetadaten
- **AND** das Plugin registriert damit keine eigene Import-Runtime oder parallele Host-Oberfläche

### Requirement: Generische Studio-Jobs sind zentral persistent

Das System SHALL pluginübergreifende Jobs zentral im Studio-Postgres persistent führen.

#### Scenario: Generischer Job wird gestartet

- **WHEN** ein Host-Endpunkt einen pluginübergreifenden Job startet
- **THEN** wird der führende Jobdatensatz zentral in der Studio-Persistenz angelegt
- **AND** eine externe Fachdatenbank gilt dafür nicht als primärer Plattformvertrag

#### Scenario: Host führt Jobs über einen runner-agnostischen Plattformvertrag

- **WHEN** die Plattform einen generischen Plugin-Job ausführt
- **THEN** bleiben Plugin-Vertrag, API-Shape, Statusmodell und zentrale Persistenz unabhängig von einer konkreten Worker-Technologie
- **AND** eine erste interne Runner-Implementierung wie Graphile Worker bleibt hinter der hostgeführten Runtime austauschbar

### Requirement: Generische Studio-Jobs verwenden einen stabilen Grundstatusvertrag

Das System SHALL für generische pluginübergreifende Jobs einen stabilen Grundstatusvertrag bereitstellen.

#### Scenario: Jobstatus wird gelesen

- **WHEN** ein Client oder Plugin den Status eines generischen Jobs abfragt
- **THEN** verwendet das System einen stabilen Grundstatusvertrag mit mindestens `queued`, `running`, `succeeded`, `failed`
- **AND** weitere optionale Status wie `cancelled` bleiben zulässig, sind aber nicht für die erste Ausbaustufe verpflichtend

### Requirement: Generische Plugin-Operations-Endpunkte bleiben hostgeführt

Das System SHALL generische Plugin-Operations-Endpunkte nur als hostgeführte Runtime-Endpunkte publizieren.

#### Scenario: Job- oder Import-Endpunkt wird produktiv verwendet

- **WHEN** ein generischer Job- oder Import-Endpunkt produktiv erreichbar ist
- **THEN** wird er über den Host mit Validierung, Actor-Kontext, Rechteprüfung und Fehlervertrag ausgeführt
- **AND** das Plugin publiziert dafür keinen unabhängigen Laufzeit-Endpunkt außerhalb der Host-Runtime

#### Scenario: Host veröffentlicht initiale Start- und Status-Endpunkte

- **WHEN** die erste Ausbaustufe der Plattform produktiv bereitgestellt wird
- **THEN** veröffentlicht der Host mindestens einen Endpunkt zum Starten generischer Plugin-Jobs und einen Endpunkt zur Statusabfrage
- **AND** beide Endpunkte arbeiten auf demselben zentralen Jobdatensatz und demselben stabilen Statusvertrag

### Requirement: Optionale Host-UI-Anbindung ist kein Pflichtvollausbau

Das System SHALL erste UI-Andockpunkte für generische Jobs oder Importe erlauben, ohne dafür bereits einen vollständigen Monitoring- oder Wizard-Ausbau zu verlangen.

#### Scenario: Plattform wird ohne fertige Monitoring-Seite eingeführt

- **WHEN** die generische Plugin-Operations-Plattform eingeführt wird
- **THEN** darf sie zunächst ohne voll ausgebaute Monitoring-Oberfläche oder Import-Wizard bestehen
- **AND** Fachchanges können die Plattform trotzdem über den Host-Vertrag konsumieren

#### Scenario: Host führt einen ersten lesenden Jobs-Unterbereich unter Monitoring ein

- **WHEN** der Host einen ersten UI-Einstieg für generische Plugin-Operations-Jobs bereitstellt
- **THEN** darf dieser als gezielter Unterbereich `Monitoring > Jobs` umgesetzt werden
- **AND** er bleibt im ersten Schnitt auf lesende Listen- und Detailansichten beschränkt
- **AND** daraus entsteht noch kein verpflichtender Vollausbau einer allgemeinen Monitoring-Suite

### Requirement: Host veröffentlicht eine lesende Listenansicht für Plugin-Operations-Jobs

Das System SHALL für generische Plugin-Operations-Jobs eine hostgeführte Listenansicht mit separater Sicht auf aktive und historische Jobs bereitstellen.

#### Scenario: Monitoring zeigt aktive Jobs

- **WHEN** ein Operator die Jobliste im Tab `Aktiv` öffnet
- **THEN** zeigt das System laufende und retryende Jobs mit Status, Progress-Kurzsicht, letzter Aktivität und Runtime-Diagnostik an
- **AND** aktive Jobs werden periodisch aktualisiert, ohne dass die Historienansicht dieselbe Polling-Frequenz übernehmen muss

#### Scenario: Monitoring zeigt historische Jobs

- **WHEN** ein Operator den Tab `Historie` öffnet
- **THEN** zeigt das System abgeschlossene oder anderweitig historische Jobs getrennt von aktiven Jobs an
- **AND** die Historienansicht unterstützt mindestens Status-, Plugin- und Jobtyp-Filter sowie eine einfache Suche

### Requirement: Host stellt eine paginierte Jobs-Listen-API bereit

Das System SHALL für die Monitoring-Liste eine eigene hostgeführte Listen-API für Plugin-Operations-Jobs bereitstellen.

#### Scenario: Client lädt aktive Jobs über Listen-API

- **WHEN** ein Client die Jobliste für aktive Jobs lädt
- **THEN** kann er die Sicht explizit als `active` anfordern
- **AND** die Antwort enthält eine reduzierte Listenprojektion statt vollständiger Detaildatensätze

#### Scenario: Client filtert historische Jobs

- **WHEN** ein Client historische Jobs nach `status`, `pluginId`, `jobTypeId` oder einer einfachen Suche filtert
- **THEN** wertet der Host diese Filter serverseitig aus
- **AND** die Antwort bleibt paginiert und monitoringtauglich

### Requirement: Host bietet eigene Detailseiten für Plugin-Operations-Jobs

Das System SHALL für einzelne Plugin-Operations-Jobs eine eigene lesende Detailansicht mit technischer History bereitstellen.

#### Scenario: Operator öffnet Jobdetail

- **WHEN** ein Operator aus der Monitoring-Liste einen einzelnen Job öffnet
- **THEN** zeigt die Detailansicht Status, Progress, Runtime-Diagnostik, Ergebnis-/Fehlerpayload und technische Event-History
- **AND** die Detailansicht wird nicht als flüchtiges Inline-Panel erzwungen

