## ADDED Requirements

### Requirement: Öffentliche Abfallkalender-App hat einen isolierten Releasepfad

Das System SHALL für `public-waste-calendar` einen eigenen Releasepfad
bereitstellen, der weder den `studio`-Stack noch den `studio`-Releaseworkflow
mitverwendet.

#### Scenario: Git-Tag triggert nur den öffentlichen Waste-Release

- **WHEN** ein Git-Tag `waste-web-v1.2.3` gepusht wird
- **THEN** baut und deployt das System nur die öffentliche Waste-Web-Runtime
- **AND** der normale Studio-Releasepfad bleibt unberührt

#### Scenario: Öffentliche Waste-Runtime nutzt eigenen Variablenraum

- **WHEN** die öffentliche Waste-Web-Runtime produktiv gestartet wird
- **THEN** liest sie ihre führende Konfiguration aus `PUBLIC_WASTE_*`-Variablen
- **AND** greift nicht implizit auf `SVA_*`-Runtime-Variablen des normalen Studios zurück
- **AND** ein JSON-basierter Konfigurationsblob bleibt höchstens ein lokaler oder kompatibler Fallback

### Requirement: Öffentliche Abfallkalender-App liefert produktiven Health- und API-Vertrag

Das System SHALL die öffentliche Waste-Web-App produktiv als eigene
serverseitige Runtime mit statischen Assets, Health-Endpoint und bestehenden
öffentlichen Read-Endpunkten ausliefern.

#### Scenario: Produktionsruntime antwortet auf Health-Check

- **WHEN** ein Operator oder Releaseworkflow `GET /health/live` gegen die öffentliche Waste-Web-Runtime ausführt
- **THEN** liefert die Runtime einen expliziten erfolgreichen Health-Befund
- **AND** dieser Befund ist unabhängig vom normalen Studio-Health-Pfad

#### Scenario: Produktiver Release prüft einen öffentlichen Read-Pfad

- **WHEN** ein Release der öffentlichen Waste-Web-Runtime abgeschlossen wird
- **THEN** prüft der Smoke-Test neben der Startseite mindestens einen öffentlichen `/api/public-waste/*`-Pfad
- **AND** bewertet damit nicht nur das Vorhandensein eines laufenden Containers, sondern den fachlichen Read-Vertrag
