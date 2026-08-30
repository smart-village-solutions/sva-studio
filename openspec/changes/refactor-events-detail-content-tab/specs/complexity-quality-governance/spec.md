## MODIFIED Requirements

### Requirement: Komplexe React-Editorbereiche werden entlang testbarer Zuständigkeiten zerlegt

Das System SHALL kritische React-Editor-Hotspots in reine Ableitungen,
kontrollierte Zustandskoordination und präsentationale Abschnitte zerlegen,
ohne UI-, Berechtigungs- oder Persistenzverträge zu verändern. Die Zerlegung
MUST durch Characterization-Tests und maschinenlesbare Komplexitätsmetriken
belegt werden. Eine Zerlegung MUST ersetzten Inline- oder Parallelcode im
selben Änderungsscope entfernen und darf die produktive Ownership-Fläche nicht
durch ungenutzte oder nur weiterleitende Abstraktionen vergrößern.

#### Scenario: POI-Betreiberbereich verliert den kritischen Hotspot

- **GIVEN** `PoiDetailOperatorTab` überschreitet die dokumentierten Komplexitätsgrenzen
- **WHEN** der Betreiberbereich intern refaktoriert wird
- **THEN** bleibt `PoiDetailOperatorTab` der einzige Einbindungspunkt des Content-Tabs
- **AND** Feld-IDs, Texte, Validierungszustände, Berechtigungsentscheidungen und Geocoding-Verträge bleiben unverändert
- **AND** der ursprüngliche kritische Fallow-Befund verschwindet ohne Suppression oder Grenzwertänderung
- **AND** keine neu extrahierte React-Komponente wird selbst zu einem kritischen Hotspot

#### Scenario: Event-Inhaltseditor verliert den kritischen Wurzel-Hotspot

- **GIVEN** `EventsDetailContentTab` überschreitet die dokumentierten Komplexitätsgrenzen und besitzt mehrere fachlich unabhängige Inline-Editorbereiche
- **WHEN** der Event-Inhaltseditor entlang von Beschreibung, Medien, Terminen, Ortsdaten, Kontakten, Links und Preisen intern zerlegt wird
- **THEN** bleibt `EventsDetailContentTab` der einzige öffentliche Einbindungspunkt des Content-Tabs
- **AND** jeder RHF-Feldpfad, jedes Field-Array und jeder bereichsspezifische Callback besitzt genau eine führende pluginlokale Implementierung
- **AND** Feld-IDs, Reihenfolge, Texte, Validierungszustände, Medienberechtigungen, Geocoding- und Persistenzverträge bleiben unverändert
- **AND** alle ersetzten Inline-Blöcke und Parallelpfade werden im selben Änderungsscope entfernt
- **AND** der produktive Änderungsscope wächst netto nicht
- **AND** der ursprüngliche kritische Fallow-Befund verschwindet ohne Suppression oder Grenzwertänderung
- **AND** keine neu extrahierte React-Komponente wird selbst zu einem kritischen Hotspot
