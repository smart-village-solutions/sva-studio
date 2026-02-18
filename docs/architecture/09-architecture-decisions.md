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
- `ADR-008-codecov-coverage-reporting-and-gates.md`

### Zuordnung zu arc42-Abschnitten

- Abschnitt 04 (Lösungsstrategie): ADR-001, ADR-002, ADR-003
- Abschnitt 05 (Bausteinsicht): ADR-001, ADR-002
- Abschnitt 06/07 (Laufzeit/Deployment): aktuell keine dedizierte ADR im Verzeichnis
- Abschnitt 08 (Querschnitt): ADR-003
- Abschnitt 10/11 (Qualität/Risiken): ADR-008

### Pflege-Regel

Bei Architekturentscheidungen in OpenSpec-Changes:

1. betroffene arc42-Abschnitte referenzieren
2. ADR erstellen/aktualisieren
3. Entscheidung in diesem Abschnitt nachziehen

Referenzen:

- `./decisions/ADR-001-frontend-framework-selection.md`
- `./decisions/ADR-002-plugin-architecture-pattern.md`
- `./decisions/ADR-003-design-token-architecture.md`
- `openspec/AGENTS.md`
