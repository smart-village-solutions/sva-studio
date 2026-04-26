## MODIFIED Requirements

### Requirement: Hard-Cut-Fortschritt bleibt nachvollziehbar

Die Architektur- und Entwicklungsdokumentation MUST den Fortschritt der harten Package-Transition nachvollziehbar machen, inklusive alter Importpfade, entfernter Re-Exports, noch offener Boundary-Disables und verbleibender Risiken.

#### Scenario: Migrationsphase wird abgeschlossen

- **WHEN** eine Migrationsphase abgeschlossen wird
- **THEN** dokumentiert der PR entfernte alte Importpfade und aktivierte Enforcement-Regeln
- **AND** verbleibende Abweichungen sind mit Ticket, Risiko und geplantem Abbau dokumentiert

#### Scenario: Alter Sammelpfad bleibt vorübergehend bestehen

- **WHEN** ein alter Importpfad aus `@sva/auth`, `@sva/data` oder `@sva/sdk` vorübergehend bestehen bleibt
- **THEN** nennt die Dokumentation den Grund, die betroffenen Consumer und die Entfernungsvoraussetzung
- **AND** der Pfad wird nicht als stabiler öffentlicher Vertrag beschrieben

#### Scenario: Legacy-Auth-Package wird entfernt dokumentiert

- **WHEN** `@sva/auth` aus dem aktiven Workspace entfernt wird
- **THEN** beschreiben aktive Architektur- und Entwicklungsdokumente `@sva/auth-runtime` und die IAM-Zielpackages als aktuelle Verträge
- **AND** verbleibende `@sva/auth`-Nennungen sind eindeutig als historisch, archiviert oder nicht-produktiv markiert
