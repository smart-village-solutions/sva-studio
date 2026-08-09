## MODIFIED Requirements

### Requirement: Waste-Management kopiert abhängige Tour-Beziehungen erst nach dem Speichern

Das System SHALL Abholort-Zuordnungen und tourbezogene Datumsverschiebungen erst nach erfolgreichem Speichern der neuen Tour serverseitig übernehmen.

#### Scenario: UI erklärt die verzögerte Übernahme

- **WHEN** ein Benutzer den Create-View aus einem Duplizieren-Flow öffnet
- **THEN** sieht er vor den Save-Actions einen Hinweis zur erst nachgelagerten Übernahme der Zuordnungen

#### Scenario: Server dupliziert Beziehungen vollständig

- **WHEN** die neue Tour erfolgreich gespeichert wird
- **THEN** kopiert das System die Abholort-Zuordnungen, datumsspezifische Abholort-Zuordnungen und tourbezogene Datumsverschiebungen der Quell-Tour auf die neue Tour
- **AND** für alle kopierten Abholort-Zuordnungen gilt ausschließlich der Zeitraum der neuen Tour
- **AND** die Original-Tour bleibt unverändert
- **AND** Teilerfolge sind nicht zulässig

## ADDED Requirements

### Requirement: Abholort-Zuordnungen verwenden ausschließlich die Tour-Gültigkeit

Das System SHALL für alle einer Tour zugeordneten Abholorte ausschließlich den an der Tour gepflegten Gültigkeitszeitraum verwenden und SHALL keine abweichenden Start- oder Enddaten an der Zuordnung speichern oder auswerten.

#### Scenario: Wiederkehrende Tour wird für einen Abholort materialisiert

- **WHEN** das System Termine einer Tour für einen zugeordneten Abholort materialisiert
- **THEN** begrenzen ausschließlich `first_date` und `end_date` der Tour die wiederkehrenden Termine
- **AND** die Orts–Tour-Zuordnung besitzt kein eigenes Gültigkeitsfenster

#### Scenario: Bestehende Zuordnungszeiträume werden migriert

- **WHEN** das Runtime-Schema auf das zentrale Tour-Gültigkeitsmodell aktualisiert wird
- **THEN** entfernt das System vorhandene `start_date`- und `end_date`-Spalten der Orts–Tour-Zuordnung idempotent
- **AND** Touren und ihre Abholort-Zuordnungen bleiben bestehen
- **AND** vorhandene Tourzeiträume werden nicht aus den entfernten Zuordnungswerten verändert

### Requirement: Tour-Zuordnungen sind fachlich sortiert

Das System SHALL im Dialog zur Tour-Zuordnung ausgewählte Abholorte vor nicht ausgewählten Abholorten anzeigen und beide Gruppen deterministisch nach Region, Ort und Straße sortieren.

#### Scenario: Dialog enthält ausgewählte und nicht ausgewählte Abholorte

- **WHEN** ein Benutzer den Dialog zur Tour-Zuordnung öffnet oder seine Auswahl ändert
- **THEN** stehen alle aktuell ausgewählten Abholorte vor den nicht ausgewählten Abholorten
- **AND** innerhalb beider Gruppen wird aufsteigend nach vorhandener Region, Ort und Straße sortiert
- **AND** Bezeichnung und ID stellen bei gleichen Fachwerten eine stabile Reihenfolge sicher

## REMOVED Requirements

### Requirement: Standortbezogene Tour-Gültigkeitsfenster bleiben wirksam

**Reason**: Einzelne Abholorte innerhalb derselben Tour dürfen keine unterschiedlichen Gültigkeitszeiträume besitzen; maßgeblich ist ausschließlich der Zeitraum der Tour.

**Migration**: Die nullable Spalten `start_date` und `end_date` werden aus `waste_location_tour_links` entfernt. Vorhandene Werte werden nicht auf die Tour übertragen, Touren und Zuordnungen bleiben ansonsten unverändert erhalten.
