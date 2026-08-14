## ADDED Requirements

### Requirement: Sicherheitskritische Entscheidungs-Hotspots werden fachlich zerlegt

Das System SHALL einen sicherheitskritischen Komplexitäts-Hotspot entlang stabiler fachlicher Entscheidungsgrenzen in kleine reine Bausteine zerlegen. Die Senkung MUST durch maschinenlesbare Komplexitätsmetriken belegt werden und darf nicht durch Suppressionen, geänderte Grenzwerte oder einen parallelen Entscheidungspfad entstehen.

#### Scenario: ABAC-Hotspot wird messbar reduziert

- **GIVEN** `evaluateAbacRules` überschreitet die dokumentierten Komplexitätsgrenzen
- **WHEN** die interne ABAC-Auswertung refaktoriert wird
- **THEN** verschwindet der ursprüngliche Fallow-Hotspot oder liegt nachweislich unter den kanonischen Grenzwerten
- **AND** das Complexity-Gate bleibt ohne neue Suppression grün
- **AND** Characterization-Tests belegen die unveränderte Entscheidungssemantik
