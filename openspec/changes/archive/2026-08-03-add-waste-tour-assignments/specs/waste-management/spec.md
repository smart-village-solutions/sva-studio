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

#### Scenario: CSV ohne Einsatz-ID erzeugt einen Einzel-Einsatz

- **WHEN** ein gültiger CSV-Import für ortsbezogene Tourtermine keine `Einsatz-ID` enthält
- **THEN** erzeugt das System pro importiertem Einzeltermin einen Einsatz mit genau einem Abholort
- **AND** es schreibt keinen neuen Termin ausschließlich in das Legacy-Modell

### Requirement: Standortbezogene Tour-Gültigkeitsfenster bleiben wirksam

Das System SHALL optionale Gültigkeitsfenster einer Standort–Tour-Zuordnung dauerhaft speichern und bei der Terminmaterialisierung anwenden.

#### Scenario: Termin außerhalb des Standortfensters wird nicht materialisiert

- **WHEN** die Zuordnung einer Tour zu einem Abholort ein `start_date` oder `end_date` enthält
- **THEN** erzeugt das System für diesen Ort außerhalb dieses Zeitfensters keine berechneten Abholtermine
