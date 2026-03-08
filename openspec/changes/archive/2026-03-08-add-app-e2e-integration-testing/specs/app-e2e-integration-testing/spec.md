## ADDED Requirements
### Requirement: Reproduzierbarer App-E2E-Integrationslauf
Das System SHALL einen reproduzierbaren End-to-End-Integrationslauf bereitstellen, der die laufende App mit dem lokalen Service-Stack validiert.

#### Scenario: Vollständiger Smoke-Lauf lokal
- **WHEN** ein Entwickler den definierten E2E-Target ausführt
- **THEN** wird die App gestartet und gegen den Docker-Stack getestet
- **AND** der Lauf endet mit einem eindeutigen Pass/Fail-Ergebnis

### Requirement: Mindestabdeckung kritischer Navigationspfade
Das System SHALL mindestens die Kernrouten und den Auth-Entry-Point im E2E-Smoketest abdecken.

#### Scenario: Kernrouten verfügbar
- **WHEN** der E2E-Smoketest läuft
- **THEN** liefern `/`, `/demo` und `/plugins/example` erfolgreiche Antworten
- **AND** `/auth/login` liefert den erwarteten Redirect-Flow

### Requirement: Service-Readiness als Testvoraussetzung
Das System SHALL vor dem eigentlichen E2E-Lauf die Verfügbarkeit der benötigten Services prüfen.

#### Scenario: Service nicht verfügbar
- **WHEN** Redis, Loki, OTEL oder Promtail nicht erreichbar/healthy ist
- **THEN** bricht der E2E-Lauf frühzeitig mit klarer Fehlermeldung ab
- **AND** der Fehler nennt den betroffenen Service explizit
