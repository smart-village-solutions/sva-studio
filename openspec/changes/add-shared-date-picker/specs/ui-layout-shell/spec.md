## ADDED Requirements

### Requirement: Gemeinsame zugängliche Datumseingabe

Das Studio MUST eine gemeinsame Datumskomponente in `studio-ui-react` bereitstellen. Diese MUST lokale Tastatureingabe, Kalenderauswahl mit Maus und Tastatur, zugeordnete Beschriftungen und verständliche Validierung unterstützen. Öffentliche gültige Werte MUST Kalenderdaten im Format `YYYY-MM-DD` ohne Zeitzonenverschiebung sein.

#### Scenario: Unvollständige Eingabe

- **WHEN** eine Person ein Datum schrittweise eingibt oder einen ungültigen Kalendertag einfügt
- **THEN** bleibt der Eingabetext erhalten
- **AND** verhindert die Formularintegration das Speichern einer ungültigen Eingabe.

#### Scenario: Kalendernavigation

- **WHEN** eine Person im geöffneten Kalender den Monat wechselt
- **THEN** bleibt der Kalender geöffnet und der Wert unverändert
- **AND** übernimmt erst eine bewusste Tagesauswahl ein Datum.

#### Scenario: Tastatur und Fokus

- **WHEN** eine Person den Kalender ausschließlich per Tastatur bedient
- **THEN** sind Öffnen, Monats-/Tagesnavigation, Auswahl und Abbrechen erreichbar
- **AND** kehrt der Fokus nach dem Schließen zur Kalenderschaltfläche zurück.

#### Scenario: Mehrere Veranstaltungstermine

- **WHEN** das Start- oder Enddatum einer Terminzeile geändert wird
- **THEN** bleiben weitere Termine und die Identität der Eingabefelder erhalten
- **AND** wird die Validität jeder Terminzeile vor dem Speichern geprüft.
