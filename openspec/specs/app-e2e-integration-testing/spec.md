# app-e2e-integration-testing Specification

## Purpose
TBD - created by archiving change add-app-e2e-integration-testing. Update Purpose after archive.
## Requirements
### Requirement: Reproduzierbarer App-E2E-Integrationslauf
Das System SHALL einen reproduzierbaren End-to-End-Integrationslauf bereitstellen, der die laufende App mit dem lokalen Service-Stack validiert.

#### Scenario: Vollständiger Smoke-Lauf lokal
- **WHEN** ein Entwickler den definierten E2E-Target ausführt
- **THEN** wird die App gestartet und gegen den Docker-Stack getestet
- **AND** der Lauf endet mit einem eindeutigen Pass/Fail-Ergebnis

### Requirement: Mindestabdeckung kritischer Navigationspfade
Das System SHALL mindestens die Root-Shell, eine echte Kernroute, eine Plugin-Route und den Auth-Entry-Point im E2E-Smoketest abdecken.

#### Scenario: Kernrouten verfügbar
- **WHEN** der E2E-Smoketest läuft
- **THEN** liefern `/` und `/interfaces` erfolgreiche Antworten
- **AND** die produktive Plugin-Route `/plugins/news` wird über authentifizierte clientseitige Navigation erfolgreich gerendert
- **AND** `/auth/login` liefert den erwarteten Redirect-Flow

#### Scenario: Clientseitige Navigation hält die Shell aktiv
- **WHEN** der Browser von `/` clientseitig über `/plugins/news` nach `/interfaces` navigiert
- **THEN** bleibt die App-Shell erhalten
- **AND** es erfolgt kein Full Reload der gesamten Anwendung

### Requirement: Service-Readiness als Testvoraussetzung
Das System SHALL vor dem eigentlichen E2E-Lauf die Verfügbarkeit der benötigten Services prüfen.

#### Scenario: Service nicht verfügbar
- **WHEN** Redis, Loki, OTEL oder Promtail nicht erreichbar/healthy ist
- **THEN** bricht der E2E-Lauf frühzeitig mit klarer Fehlermeldung ab
- **AND** der Fehler nennt den betroffenen Service explizit
