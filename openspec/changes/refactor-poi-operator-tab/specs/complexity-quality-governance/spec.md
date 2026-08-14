## ADDED Requirements

### Requirement: Komplexe React-Editorbereiche werden entlang testbarer Zuständigkeiten zerlegt

Das System SHALL kritische React-Editor-Hotspots in reine Ableitungen, kontrollierte Zustandskoordination und präsentationale Abschnitte zerlegen, ohne UI-, Berechtigungs- oder Persistenzverträge zu verändern. Die Zerlegung MUST durch Characterization-Tests und maschinenlesbare Komplexitätsmetriken belegt werden.

#### Scenario: POI-Betreiberbereich verliert den kritischen Hotspot

- **GIVEN** `PoiDetailOperatorTab` überschreitet die dokumentierten Komplexitätsgrenzen
- **WHEN** der Betreiberbereich intern refaktoriert wird
- **THEN** bleibt `PoiDetailOperatorTab` der einzige Einbindungspunkt des Content-Tabs
- **AND** Feld-IDs, Texte, Validierungszustände, Berechtigungsentscheidungen und Geocoding-Verträge bleiben unverändert
- **AND** der ursprüngliche kritische Fallow-Befund verschwindet ohne Suppression oder Grenzwertänderung
- **AND** keine neu extrahierte React-Komponente wird selbst zu einem kritischen Hotspot
