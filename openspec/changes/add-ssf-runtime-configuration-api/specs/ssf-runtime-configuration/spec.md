## ADDED Requirements

### Requirement: SSF liest minimale Runtime-Konfiguration über die interne Service-API

Das System SHALL eine minimale tenantbezogene SSF-Runtime-Konfiguration mit expliziter Schema- und Konfigurationsrevision über den hostgeführten internen Servicevertrag bereitstellen. Die Antwort MUST auf den gebundenen, aktivierten, nicht suspendierten und bereiten Tenant begrenzt sein.

#### Scenario: Aktiver Tenant erhält minimale Konfiguration

- **GIVEN** Service-Identität und Tenant-Assertion sind gültig und das SSF-Plugin ist für den Tenant aktiv und bereit
- **WHEN** SSF die Runtime-Konfiguration abruft
- **THEN** erhält es ausschließlich die für diesen Tenant freigegebene minimale Konfiguration
- **AND** enthält die Antwort eine stabile Vertragsversion und Konfigurationsrevision
- **AND** enthält sie keine Service-Secrets oder Studio-IAM-Interna

#### Scenario: Deaktivierter oder suspendierter Tenant erhält keine Konfiguration

- **GIVEN** das SSF-Plugin ist für den Tenant deaktiviert oder die Instanz ist suspendiert
- **WHEN** SSF die interne Konfiguration anfordert
- **THEN** lehnt das System den Abruf fail-closed mit einem stabilen Statuscode ab
- **AND** liefert weder veraltete noch installationsweite Fallback-Konfiguration aus

### Requirement: SSF-Customer bleiben außerhalb des Studio-IAM

Das System SHALL SSF-Session-Token ausschließlich durch die SSF-Runtime auswerten lassen. Der anschließende Studio-Aufruf MUST über die technische Service-Identität und Tenant-Assertion erfolgen und darf für den Customer kein reguläres Studio-Konto erzeugen.

#### Scenario: Customer-Session führt zu technischem Backend-Aufruf

- **GIVEN** SSF hat einen Customer mit einem gültigen Session-Token authentifiziert und Tenant A abgeleitet
- **WHEN** SSF die Konfiguration für diesen Vorgang benötigt
- **THEN** ruft das SSF-Backend die interne API mit Service-Token und Tenant-Assertion für Tenant A auf
- **AND** erhält der Customer weder Studio-Credentials noch eine Studio-Identität

#### Scenario: Browser verwendet Customer-Token direkt am Studio

- **GIVEN** ein Browser präsentiert ein SSF-Customer-Session-Token direkt am Studio-Endpoint
- **WHEN** der Host den Request prüft
- **THEN** lehnt er den Request ab
- **AND** leitet daraus keinen Tenant- oder Benutzerkontext ab

### Requirement: Auswertungen und Gesprächsdaten bleiben außerhalb dieses Changes

Das System MUST ClickHouse, eine mögliche SSF-Session-Datenbank und Gesprächsinhalte außerhalb der Studio-Persistenz und des Runtime-Konfigurationsvertrags halten. Eine spätere Integration SHALL über einen gesondert spezifizierten internen SSF-Admin- oder Reporting-Vertrag und nicht durch direkten Studio-Datenbankzugriff erfolgen.

#### Scenario: Runtime-Konfigurationsabruf greift nicht auf Analytics-Datenbanken zu

- **WHEN** SSF die minimale Runtime-Konfiguration abruft
- **THEN** öffnet das Studio keine direkte Verbindung zu ClickHouse oder einer SSF-Session-Datenbank
- **AND** liest oder persistiert es keine Gesprächsinhalte

#### Scenario: Spätere Auswertung benötigt einen eigenen Change

- **WHEN** Nutzungs-, Kosten-, Kapazitäts- oder Gesprächsauswertungen in das Studio aufgenommen werden sollen
- **THEN** erfordert dies einen eigenen OpenSpec-Change mit Datenschutz-, Autorisierungs-, API- und Aufbewahrungsvertrag
- **AND** bleibt SSF für die zugrunde liegenden Laufzeitdaten führend
