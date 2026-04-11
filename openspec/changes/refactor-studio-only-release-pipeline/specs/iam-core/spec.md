## MODIFIED Requirements
### Requirement: Kritischer IAM-Schema-Guard

Das System MUST vor Studio-Smoke und nach Migrationen den kritischen IAM-Sollstand validieren.

#### Scenario: Migration validiert den Sollstand

- **WHEN** `env:migrate:studio` erfolgreich alle SQL-Dateien angewendet hat
- **THEN** validiert ein Schema-Guard kritische Tabellen, Spalten, Indizes und RLS-Policies
- **AND** der Befehl endet nicht erfolgreich, solange kritische Drift verbleibt

#### Scenario: Smoke erkennt Drift vor Fachfehlern

- **WHEN** `env:smoke:<profil>` oder `env:doctor:<profil>` gegen einen Drift-Zustand ausgefuehrt wird
- **THEN** wird die Drift als eigener Fehler gemeldet
