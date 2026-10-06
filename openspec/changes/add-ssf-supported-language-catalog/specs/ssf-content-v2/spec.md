## ADDED Requirements

### Requirement: SSF-Sprachauswahl verwendet den unterstützten Sprachkatalog

Die Locale-Auswahlen für Installationstexte, Mitarbeitendentexte und Gastsprachen MUST auf dem von SSF bereitgestellten unterstützten Sprachkatalog basieren. Freie Spracheingaben MUST ausgeschlossen sein. Name und Eigenname einer neuen Gastsprachkonfiguration MUST aus dem Katalog vorbelegt werden. Bereits gespeicherte Sprachen MUST erhalten bleiben, auch wenn sie nicht mehr im aktuellen Katalog enthalten sind.

#### Scenario: Administrator wählt eine unterstützte Sprache

- **GIVEN** der SSF-Sprachkatalog ist verfügbar
- **WHEN** ein Administrator die Sprache der Installationstexte oder Mitarbeitendentexte ändert oder eine Gastsprachkonfiguration ergänzt
- **THEN** kann er ausschließlich einen Sprachcode aus dem Katalog auswählen
- **AND** Name und Eigenname einer neuen Gastsprachkonfiguration werden aus dem Katalog vorbelegt

#### Scenario: Sprachkatalog ist nicht verfügbar

- **GIVEN** der SSF-Sprachkatalog kann nicht geladen oder validiert werden
- **WHEN** ein Administrator die Inhaltsverwaltung öffnet
- **THEN** kann er bestehende Texte weiter bearbeiten
- **AND** Änderungen an der Mitarbeitendensprache und das Hinzufügen von Gastsprachen sind deaktiviert und der Fehlerzustand wird angezeigt
- **AND** bereits gespeicherte Sprachen bleiben unverändert erhalten

#### Scenario: Gespeicherte Sprache fehlt im aktuellen Katalog

- **GIVEN** eine gespeicherte Sprache ist nicht im aktuellen Katalog enthalten
- **WHEN** ein Administrator die Inhaltsverwaltung öffnet
- **THEN** bleiben Sprache und zugehörige Texte sichtbar und gespeichert
- **AND** das Öffnen oder Speichern anderer Inhalte entfernt diese Sprache nicht
