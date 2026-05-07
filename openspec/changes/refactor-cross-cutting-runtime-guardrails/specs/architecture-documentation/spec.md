## ADDED Requirements

### Requirement: Cross-Cutting Guardrails sind als Zielarchitektur dokumentiert

Die Architekturdokumentation SHALL cross-cutting Guardrails fuer Auth-Session-Serialisierung, Plugin-Preflight, Architektur-Gates und produktionsnahen Boot-Vertrag explizit in den betroffenen arc42-Abschnitten verankern.

#### Scenario: Reviewer prueft den Guardrail-Change

- **WHEN** ein Reviewer `04`, `05`, `06`, `08`, `09`, `10` und `11` der arc42-Dokumentation liest
- **THEN** sind Session-Refresh-Serialisierung, Plugin-Preflight, Aktivierungsflags, Architektur-Gates und Boot-Checks dort nachvollziehbar beschrieben
- **AND** die Doku macht sichtbar, welche Risiken damit reduziert und welche Restschulden bewusst vertagt werden

#### Scenario: Neue ADR dokumentiert oeffentliche Vertraege

- **WHEN** der Change den oeffentlichen Plugin- oder Runtime-Vertrag aendert
- **THEN** beschreibt eine ADR die Entscheidungen zu SDK-Kompatibilitaet, typisierten Plugin-Routen, OTEL-Boot und Runtime-Aktivierung
- **AND** `09-architecture-decisions.md` verlinkt diese Entscheidung
