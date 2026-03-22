## ADDED Requirements

### Requirement: Architektur- und Betriebsdoku für Diagnosepfade

Das System SHALL Runtime-Diagnosepfade, Acceptance-Betriebsregeln und OTEL-Diagnosekonventionen explizit in der Architektur- und Betriebsdokumentation verankern.

#### Scenario: Runtime-Doctor ist dokumentiert

- **WHEN** ein Teammitglied das Betriebsmodell für `local-keycloak`, `local-builder` oder `acceptance-hb` nachschlägt
- **THEN** dokumentieren die Runbooks `doctor`, `smoke`, `migrate` und die kritischen Diagnose-Overrides konsistent
- **AND** die Doku beschreibt, welche Diagnosefelder öffentlich stabil sind und welche nur OTEL-intern bleiben

#### Scenario: OTEL-Diagnosekonzept ist in arc42 verankert

- **WHEN** ein OpenSpec-Change Runtime-Diagnostik oder Observability erweitert
- **THEN** beschreibt `docs/architecture/08-cross-cutting-concepts.md` die OTEL-Diagnoseattribute, stabilen `reason_code`s und den verbindlichen `env:doctor:<profil>`-Pfad
