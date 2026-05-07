## ADDED Requirements

### Requirement: Auth- und Runtime-Hotspots unterliegen No-Growth-Regeln

Das System MUST für als kritisch markierte Auth-, Session-, Routing- und Registry-Hotspots eine No-Growth-Regel für strukturelle Komplexität anwenden, bis die dokumentierte Zerlegung umgesetzt ist.

#### Scenario: Hotspot bleibt über Schwellwert

- **GIVEN** eine Datei oder ein Modul ist als kritischer Hotspot oberhalb des Schwellwerts markiert
- **WHEN** ein PR diesen Hotspot weiter verändert
- **THEN** darf der Qualitätslauf keine weitere Erhöhung der gemessenen Komplexität akzeptieren
- **AND** der PR verweist auf das zugehörige Refactoring-Ticket oder die Zerlegungsaufgabe

#### Scenario: Hotspot wird entlang dokumentierter Verantwortung geschnitten

- **WHEN** ein kritischer Hotspot in kleinere Module zerlegt wird
- **THEN** bleibt die Zerlegung an fachlichen oder Vertragsgrenzen orientiert
- **AND** die Policy kann den Hotspot erst nach nachweislicher Entschärfung neu klassifizieren
