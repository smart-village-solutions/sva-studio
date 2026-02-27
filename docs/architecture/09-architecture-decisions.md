# 09 Architekturentscheidungen

## Zweck

Dieser Abschnitt verlinkt und kontextualisiert Architekturentscheidungen (ADRs)
mit Bezug auf die arc42-Abschnitte.

## Mindestinhalte

- Liste relevanter ADRs mit Status
- Kurzbegründung und Auswirkungen pro Entscheidung
- Verknüpfung zu betroffenen arc42-Abschnitten

## Aktueller Stand

### Relevante ADRs (vorhanden)

- `ADR-001-frontend-framework-selection.md`
- `ADR-002-plugin-architecture-pattern.md`
- `ADR-003-design-token-architecture.md`
- `ADR-004-monitoring-stack-loki-grafana-prometheus.md`
- `ADR-005-observability-module-ownership.md`
- `ADR-006-logging-pipeline-strategy.md`
- `ADR-007-label-schema-and-pii-policy.md`
- `ADR-008-layout-shell-skeleton-architecture.md`
- `ADR-009-keycloak-als-zentraler-identity-provider.md`
- `ADR-010-verschluesselung-iam-core-data-layer.md`
- `ADR-011-instanceid-kanonischer-mandanten-scope.md`

### Zuordnung zu arc42-Abschnitten

- Abschnitt 04 (Lösungsstrategie): ADR-001, ADR-002, ADR-003, ADR-004
- Abschnitt 05 (Bausteinsicht): ADR-001, ADR-002, ADR-005
- Abschnitt 06/07 (Laufzeit/Deployment): ADR-004, ADR-006
- Abschnitt 08 (Querschnitt): ADR-005, ADR-006, ADR-007
- Abschnitt 10/11 (Qualität/Risiken): ADR-004, ADR-007, ADR-008
- Abschnitt 05/06 (Bausteine/Laufzeit): ADR-008
- Abschnitt 03/05/08 (Kontext/Bausteine/Querschnitt): ADR-009, ADR-011
- Abschnitt 08/10/11 (Querschnitt/Qualität/Risiken): ADR-010

### Pflege-Regel

Bei Architekturentscheidungen in OpenSpec-Changes:

1. betroffene arc42-Abschnitte referenzieren
2. ADR erstellen/aktualisieren
3. Entscheidung in diesem Abschnitt nachziehen

Referenzen:

- `./decisions/README.md`
- `openspec/AGENTS.md`
