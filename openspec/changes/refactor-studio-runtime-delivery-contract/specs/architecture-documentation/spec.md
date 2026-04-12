## ADDED Requirements

### Requirement: Architektur dokumentiert finalen Runtime-Vertrag

Die Architektur- und Betriebsdokumentation SHALL den finalen Runtime-Vertrag fuer `studio` explizit gegenueber Intermediate-SSR-Artefakten und Legacy-Recovery-Pfaden abgrenzen.

#### Scenario: Arc42 beschreibt finale Runtime als Release-Wahrheit

- **WHEN** die Dokumentation den `studio`-Releasepfad beschreibt
- **THEN** benennen `05-building-block-view`, `07-deployment-view`, `08-cross-cutting-concepts` und `11-risks-and-technical-debt` das finale `.output/server/**`-Artefakt als verbindliche technische Wahrheit
- **AND** ordnen sie `.nitro/vite/services/ssr/**` als Diagnosematerial ein
- **AND** beschreiben sie den Entrypoint-Patch als Legacy-Recovery-Pfad mit explizitem Flag statt als Standardbetrieb
