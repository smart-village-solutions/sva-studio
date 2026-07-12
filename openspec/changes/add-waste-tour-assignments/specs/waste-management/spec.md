## ADDED Requirements

### Requirement: Waste-Management verwaltet generische Tour-Einsätze

Das System SHALL explizite Einsätze für normale Waste-Touren mit Datum, optionalem Hinweis und mindestens einem Abholort verwalten.

#### Scenario: Redaktion pflegt einen Einsatz mit mehreren Orten

- **WHEN** ein Benutzer mit `waste-management.scheduling.manage` einen Einsatz einer Tour speichert
- **THEN** werden Datum, optionaler Hinweis und alle ausgewählten Abholorte atomar gespeichert
- **AND** die Pflege verwendet die bestehende Tour-/Scheduling-Oberfläche ohne Schadstoffmobil-Sonderpfad

#### Scenario: Mehrere Einsätze teilen Tour und Datum

- **WHEN** mehrere Einsätze derselben Tour dasselbe Datum tragen
- **THEN** bleiben sie als getrennte Einsätze zulässig

### Requirement: Bestehende ortsbezogene Einzeltermine bleiben erhalten

Das System SHALL bestehende ortsbezogene Tourtermine idempotent in das Einsatzmodell überführen.

#### Scenario: Migration eines Einzeltermins

- **WHEN** ein bisheriger Einzeltermin migriert wird
- **THEN** entsteht ein Einsatz mit derselben Tour, demselben Datum, demselben Hinweis und genau einem Abholort
- **AND** eine wiederholte Migration erzeugt keinen zweiten Einsatz
