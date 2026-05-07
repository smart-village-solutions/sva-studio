## ADDED Requirements

### Requirement: Auth- und Runtime-Hotspots unterliegen No-Growth-Regeln

Das System MUST fuer als kritisch markierte Auth-, Session-, Routing- und Registry-Hotspots eine No-Growth-Regel fuer strukturelle Komplexitaet anwenden, bis die dokumentierte Zerlegung umgesetzt ist.

#### Scenario: Hotspot bleibt ueber Schwellwert

- **GIVEN** eine Datei oder ein Modul ist als kritischer Hotspot oberhalb des Schwellwerts markiert
- **WHEN** ein PR diesen Hotspot weiter veraendert
- **THEN** darf der Qualitaetslauf keine weitere Erhoehung der gemessenen Komplexitaet akzeptieren
- **AND** der PR verweist auf das zugehoerige Refactoring-Ticket oder die Zerlegungsaufgabe

#### Scenario: Hotspot wird entlang dokumentierter Verantwortung geschnitten

- **WHEN** ein kritischer Hotspot in kleinere Module zerlegt wird
- **THEN** bleibt die Zerlegung an fachlichen oder Vertragsgrenzen orientiert
- **AND** die Policy kann den Hotspot erst nach nachweislicher Entschaerfung neu klassifizieren
