## ADDED Requirements

### Requirement: News-Editor unterstützt Push-Ziele nach Abholort

Der News-Editor MUST berechtigten Redakteuren erlauben, Ziel-Abholorte unabhängig von der öffentlichen Sichtbarkeit einer Nachricht zu verwalten.

#### Scenario: Redaktion wählt gezielte Empfänger

- **WHEN** die Redaktion aktive Abholorte im Zielgruppen-Overlay auswählt und die Auswahl übernimmt
- **THEN** zeigt der Zielgruppenbereich den deduplizierten gezielten Modus und die ausgewählten Adressen
- **AND** gehen vorherige Auswahlen durch Filtern oder Seitenwechsel nicht verloren

#### Scenario: Vorhandenes Ziel kann nicht aufgelöst werden

- **WHEN** ein vorhandener Abholortschlüssel nicht mehr anhand der aktuellen Waste-Stammdaten aufgelöst werden kann
- **THEN** erhält der Editor den Schlüssel und kennzeichnet ihn als veraltet, bis die Redaktion ihn ausdrücklich entfernt

#### Scenario: Waste-Daten sind nicht verfügbar

- **WHEN** Waste-Stammdaten nicht gelesen werden können oder der Redaktion der Zugriff fehlt
- **THEN** wird der Zielgruppenbereich ausgeblendet
- **AND** bleiben vorhandene Zielschlüssel beim Speichern anderer Nachrichtenfelder erhalten

### Requirement: Globaler Nachrichten-Push erfordert ausdrückliche Bestätigung

Der News-Editor MUST eine ausdrückliche Bestätigung verlangen, wenn der aktuelle Speichervorgang eine Push-Benachrichtigung ohne Abholortziele auslöst.

#### Scenario: Redaktion bestätigt globalen Push

- **WHEN** Push aktiviert ist, kein Ziel ausgewählt wurde und die Redaktion einen Speichervorgang ausführt, der die Push-Zustellung auslöst
- **THEN** fragt das Studio vor dem Senden der Mutation nach einer Bestätigung
- **AND** weist die Bestätigung bei verfügbarer Zielgruppenauswahl darauf hin, dass keine Abholorte ausgewählt sind
- **AND** suggeriert die Bestätigung keine auswählbare Zielliste, wenn der Redaktion der Waste-Zugriff fehlt
- **AND** weist die Bestätigung bei einem Ladefehler auf nicht verfügbare Abholortdaten hin
