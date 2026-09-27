## ADDED Requirements

### Requirement: Optionales Waste-Plugin besitzt seine Fachverträge und reine Fachlogik

Das System SHALL Waste-spezifische Daten-, Job-, Import-, Touren-, Kalender- und PDF-Verträge sowie reine Fachfunktionen in vorhandenen Waste-Paketen halten. Generischer Core und Plugin-SDK SHALL keine Waste-Fach-API veröffentlichen.

#### Scenario: Host ohne Waste-Fachpakete

- **GIVEN** das Waste-Plugin und seine Fachpakete sind nicht Teil einer Studio-Distribution
- **WHEN** Core und Plugin-SDK gebaut und vom Host geladen werden
- **THEN** benötigen sie keine Waste-Fachpakete oder Waste-spezifischen Reexports

#### Scenario: Fachverbraucher verwenden den owning Vertrag

- **GIVEN** Plugin-UI, Worker und öffentlicher Abfallkalender benötigen Waste-Verträge
- **WHEN** sie diese importieren
- **THEN** beziehen sie sie aus den bestehenden Waste-Paketen
- **AND** Browser-Verbraucher laden keine serverseitigen Module

### Requirement: Waste-Fachhandler und Fachpersistenz sind optional geladen

Das System SHALL Waste-Handler und Waste-Tabellen-SQL ausschließlich über den installierten Waste-Server-Beitrag ausführen; Host-Dispatch und Execution-Context SHALL Authentifizierung, Tenant-Bindung, Rechte, CSRF, Audit und Fehlervertrag führen.

#### Scenario: Waste ist nicht installiert

- **GIVEN** das Waste-Plugin ist nicht installiert
- **WHEN** ein Waste-Endpunkt aufgerufen oder der Host gestartet wird
- **THEN** wird kein Waste-Fachhandler oder Waste-Fach-SQL geladen oder ausgeführt
- **AND** der Host antwortet nach seinem bestehenden Nichtverfügbarkeitsvertrag

#### Scenario: Waste ist für den Tenant nicht aktiviert

- **GIVEN** das Waste-Plugin ist installiert, für den aufrufenden Tenant aber nicht aktiv
- **WHEN** ein Waste-Endpunkt aufgerufen wird
- **THEN** sperrt der Host den Aufruf vor der Fachausführung
- **AND** es erfolgt kein fachlicher SQL-Schreibzugriff

#### Scenario: Autorisierter Waste-Aufruf

- **GIVEN** das Waste-Plugin ist installiert und für den Tenant aktiv
- **WHEN** ein autorisierter Aufruf einen bestehenden Waste-Pfad mit oder ohne Pfadparameter nutzt
- **THEN** führt genau ein hostvalidierter Dispatch-Pfad den passenden Fachhandler aus
- **AND** bestehende Methoden, Daten-, Fehler-, Audit- und Transaktionsverträge bleiben erhalten

#### Scenario: Nicht autorisierter Schreibaufruf

- **GIVEN** ein Waste-Schreibaufruf hat einen falschen Tenant, keine Berechtigung oder keinen gültigen CSRF-Nachweis
- **WHEN** der Host den Request prüft
- **THEN** erreicht er weder Waste-Fachhandler noch Fach-SQL

#### Scenario: Tour wird mit bestehender Tour als Vorlage angelegt

- **GIVEN** der Akteur besitzt `waste-management.tours.manage`
- **WHEN** er eine Tour mit `duplicateFromTourId` anlegt
- **THEN** prüft der Host zusätzlich `waste-management.scheduling.manage` vor dem fachlichen Schreibzugriff
- **AND** eine Ablehnung erhält den bisherigen Fehlervertrag
