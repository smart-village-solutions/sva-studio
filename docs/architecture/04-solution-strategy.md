# 04 Lösungsstrategie

## Zweck

Dieser Abschnitt dokumentiert die strategischen Leitentscheidungen und
Architekturprinzipien auf IST-Basis.

## Mindestinhalte

- Leitprinzipien (z. B. API-first, modulare Architektur)
- Architekturtreiber und Zielkonflikte
- Strategische Entscheidungen mit Verweisen auf ADRs

## Aktueller Stand

### Leitprinzipien

- Monorepo mit klaren Paketgrenzen und Workspace-Abhängigkeiten (`workspace:*`)
- Framework-agnostische Kernlogik in `@sva/core`, Integration in der App-Ebene
- Route-Komposition über Factory-Pattern (`mergeRouteFactories`, `buildRouteTree`)
- Doku-getriebene Architekturpflege (arc42 + OpenSpec + ADR)

### Architekturtreiber

- Hohe Typsicherheit und Wartbarkeit bei wachsender Modulanzahl
- Erweiterbarkeit durch Plugins und zentrale Route-Registry
- Reproduzierbarkeit über standardisierte Nx-/pnpm-Workflows

### Zielkonflikte (aktuell sichtbar)

- Hohe Flexibilität (code-based + file-based Routing) vs. Komplexität
- Schneller Dev-Flow vs. Governance-Anforderungen in CI
- Multi-Tooling (Nx, TanStack, pnpm) vs. Einarbeitungsaufwand

### Strategische Entscheidungen (Auswahl)

- Frontend-Framework: `ADR-001`
- Plugin-Architektur: `ADR-002`
- Design-Token-Architektur: `ADR-003`
- Coverage-Reporting mit externem Transparenz-Layer: `ADR-008`

Referenzen:

- `./decisions/ADR-001-frontend-framework-selection.md`
- `./decisions/ADR-002-plugin-architecture-pattern.md`
- `./decisions/ADR-003-design-token-architecture.md`
- `./decisions/ADR-008-codecov-coverage-reporting-and-gates.md`
