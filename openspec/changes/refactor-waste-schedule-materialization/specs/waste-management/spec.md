## ADDED Requirements
### Requirement: The system SHALL model pickup adjustments as explicit persisted schedule rules
Das System SHALL ein explizites, versionierbares Regelmodell für Terminabweichungen bereitstellen, das unabhängig von bereits materialisierten Ausführungsterminen ist.

#### Scenario: Regeln werden getrennt von Ausführungsterminen gespeichert
- **WHEN** ein Benutzer eine Feiertags- oder Abweichungsvorgabe speichert
- **THEN** wird daraus ein regelbasierter Datensatz mit Trigger, Wirkung, Richtung und Kaskadenbereich abgelegt
- **AND** diese Regel wird vor jedem Exportzyklus als Ausgangsbasis zur Terminberechnung verwendet

#### Scenario: Regelmodell ersetzt alte semantische Schichtfelder
- **WHEN** das Regelmodell geladen wird
- **THEN** verarbeitet es nur die expliziten Regel-Attribute (Trigger, Richtung, Kaskade, Gültigkeitsbereich)
- **AND** nicht mehr implizit interpretierte Felder, die keine direkte Fachsemantik liefern, dürfen den Sync-Pfad nicht steuern

### Requirement: The system SHALL persist generated tour pickup dates for a bounded synchronization window
Das System SHALL die konkret anfallenden Tourtermine in einer materialisierten Tabelle persistieren und nur für ein begrenztes Synchronisationsfenster bereitstellen.

#### Scenario: Materialisierung für aktuelles und Folgejahr
- **WHEN** die Materialisierung für eine Instanz startet
- **THEN** werden für jede aktive Tourserie Termine für das laufende und das folgende Kalenderjahr berechnet
- **AND** unbegrenzte Wiederholungsregeln erzeugen in diesem Schritt keine Daten außerhalb dieses Fensters

#### Scenario: Sync nutzt ausschließlich materialisierte Termine
- **WHEN** ein Mainserver-Sync gestartet wird
- **THEN** werden bestehende Regeln zuerst in konkrete Termine materialisiert
- **AND** der eigentliche Transport nutzt ausschließlich diese materialisierten Termine

## MODIFIED Requirements
### Requirement: Das System SHALL wiederkehrende Tourtermine so modellieren, dass manuelle Einzelverschiebungen fachlich korrekt verarbeitet werden können.
Das System SHALL wiederkehrende Tourtermine so modellieren, dass fachlich eindeutige Regeln und Ausnahmen verarbeitet werden können.

#### Scenario: Einzelregel bewegt genau einen Ausfalltermin
- **WHEN** eine Regel mit `coverage=single_pickup` und Richtung `advance`
- **THEN** wird genau der durch den Trigger betroffene Basistermin verschoben
- **AND** Folge-/Vorher-Termine bleiben unverändert, sofern keine weitere aktive Regel sie adressiert

#### Scenario: Einzelregel verschiebt in Gegenrichtung
- **WHEN** eine Regel mit `coverage=single_pickup` und Richtung `postpone`
- **THEN** wird genau der betroffene Basistermin auf das nachfolgende Datum verschoben
- **AND** alle anderen Termine der Serie bleiben unverändert

#### Scenario: Wochenbereichsregel wirkt auf restlichen Wochenverlauf
- **WHEN** eine Regel mit `coverage=rest_of_week` auf Montag oder Dienstag greift
- **THEN** werden der Trigger-Tag selbst und die noch folgenden Tage der Woche gemäß der fachlichen Richtung angepasst
- **AND** der Teil der Woche vor dem Trigger-Tag bleibt unverändert

### Requirement: Das System SHALL Feiertage und andere globale Abweichungsgründe als eigenständige Fachlogik für Terminverschiebungen behandeln.
Das System SHALL Feiertage und andere globale Abweichungsgründe als eigenständige Regelquelle behandeln und ihre Wirkung vor dem Mainserver-Transport deterministisch auf Materialisierungsebene berechnen.

#### Scenario: Feiertag auf Donnerstag (postponed single pickup)
- **WHEN** ein Feiertag auf Donnerstag liegt und die Regel `single_pickup/postpone` aktiv ist
- **THEN** wird der Donnerstag auf Freitag verschoben
- **AND** der Freitag wird entsprechend auf Samstag nachgezogen, sofern eine aktive Regel dies vorsieht

#### Scenario: Feiertag auf Dienstag (Vorschub vorgezogen)
- **WHEN** ein Feiertag auf Dienstag liegt und die Regel `advance` mit `coverage=rest_of_week` aktiv ist
- **THEN** werden vor diesem Tag liegende relevante Touren (z. B. Montag) auf Vortage verschoben
- **AND** Dienstag selbst wird auf Montag vorgezogen
- **AND** Termine ab Mittwoch bleiben unverändert, sofern keine weitere Regel greift

## REMOVED Requirements
### Requirement: Alte implizite Schiebefelder steuern den Materialisierungspfad
Legacy-Implementationen, die nicht explizit regelbasiert sind und den Sync indirekt über implizite Schichtflags steuern, sind für den neuen Architekturpfad nicht mehr zulässig.

#### Scenario: Alte Implizitlogik blockiert keinen Synchronisierungs-Commit
- **WHEN** ein bestehender Datensatz nur implizite Schiebefelder enthält
- **THEN** wird der Datensatz beim Materialisierungsschritt transformiert oder als migrationsseitig unmappbar gekennzeichnet
- **AND** ein klarer Migrationsfehler verhindert unbeabsichtigte Weiterverarbeitung in den Mainserver-Sync
