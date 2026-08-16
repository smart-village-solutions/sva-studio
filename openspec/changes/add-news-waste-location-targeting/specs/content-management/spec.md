## ADDED Requirements

### Requirement: News-Editor unterstützt Push-Ziele nach Abholort

Der News-Editor MUST berechtigten Redakteuren erlauben, Ziel-Abholorte unabhängig von der öffentlichen Sichtbarkeit einer Nachricht zu verwalten.

#### Scenario: Redaktion wählt gezielte Empfänger

- **WHEN** die Redaktion aktive Abholorte im Zielgruppen-Overlay auswählt und die Auswahl übernimmt
- **THEN** zeigt der Zielgruppenbereich den deduplizierten gezielten Modus und die ausgewählten Adressen
- **AND** gehen vorherige Auswahlen durch Filtern oder Seitenwechsel nicht verloren

#### Scenario: Redaktion schränkt eine vorgemerkte Auswahl ein

- **GIVEN** die Redaktion hat mehrere Filtertreffer vorgemerkt
- **WHEN** sie den Filter weiter einschränkt
- **THEN** zeigt und zählt der Editor nur die Schnittmenge aus vorgemerkter Auswahl und aktuellen Treffern
- **AND** erscheinen die zuvor vorgemerkten Treffer beim erneuten Erweitern des Filters wieder als ausgewählt
- **AND** entfernt ein manuelles Abwählen den Treffer dauerhaft aus der vorgemerkten Auswahl

#### Scenario: Redaktion übernimmt eine gefilterte Auswahl

- **GIVEN** ein Filter blendet einen Teil der vorgemerkten gültigen Ziele aus
- **WHEN** die Redaktion die Auswahl übernimmt
- **THEN** ersetzt nur die wirksame Schnittmenge die bisherigen gültigen Zielschlüssel
- **AND** bleiben vorhandene nicht auflösbare Zielschlüssel erhalten, bis die Redaktion sie ausdrücklich entfernt

#### Scenario: Vorhandenes Ziel kann nicht aufgelöst werden

- **WHEN** ein vorhandener Abholortschlüssel nicht mehr anhand der aktuellen Waste-Stammdaten aufgelöst werden kann
- **THEN** erhält der Editor den Schlüssel und kennzeichnet ihn als veraltet, bis die Redaktion ihn ausdrücklich entfernt

#### Scenario: Waste-Daten sind nicht verfügbar

- **WHEN** der Redaktion der Zugriff auf Waste-Stammdaten fehlt
- **THEN** wird der Zielgruppenbereich ausgeblendet
- **AND** bleiben vorhandene Zielschlüssel beim Speichern anderer Nachrichtenfelder erhalten

#### Scenario: Waste-Daten können nicht geladen werden

- **WHEN** eine berechtigte Redaktion die Zielauswahl öffnet und die Waste-Stammdaten nicht geladen werden können
- **THEN** bleibt der Zielgruppenbereich sichtbar und zeigt einen verständlichen Fehlerzustand
- **AND** kann die Redaktion den Ladevorgang erneut auslösen
- **AND** bleiben vorhandene Zielschlüssel unverändert

#### Scenario: Push wurde bereits zugestellt

- **WHEN** eine Nachricht einen bestätigten Zustellzeitpunkt besitzt
- **THEN** zeigt der Zielgruppenbereich die gespeicherten Empfänger schreibgeschützt
- **AND** kann die Redaktion Ziele weder hinzufügen noch entfernen

#### Scenario: Filterergebnis ändert sich

- **WHEN** Suche, Hierarchiefilter oder Seite im Zielauswahldialog geändert werden
- **THEN** kündigt der Editor die aktualisierte Treffer- und Seiteninformation über eine Live-Region an

### Requirement: Globaler Nachrichten-Push erfordert ausdrückliche Bestätigung

Der News-Editor MUST eine ausdrückliche Bestätigung verlangen, wenn der aktuelle Speichervorgang eine Push-Benachrichtigung ohne Abholortziele auslöst.

#### Scenario: Redaktion bestätigt globalen Push

- **WHEN** Push aktiviert ist, kein Ziel ausgewählt wurde und die Redaktion einen Speichervorgang ausführt, der die Push-Zustellung auslöst
- **THEN** fragt das Studio vor dem Senden der Mutation nach einer Bestätigung
- **AND** weist die Bestätigung bei verfügbarer Zielgruppenauswahl darauf hin, dass keine Abholorte ausgewählt sind
- **AND** suggeriert die Bestätigung keine auswählbare Zielliste, wenn der Redaktion der Waste-Zugriff fehlt
- **AND** weist die Bestätigung bei einem Ladefehler auf nicht verfügbare Abholortdaten hin
