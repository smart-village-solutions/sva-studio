# 04 Loesungsstrategie

## Zweck

Dieser Abschnitt dokumentiert die strategischen Leitentscheidungen und
Architekturprinzipien auf IST-Basis.

## Mindestinhalte

- Leitprinzipien (z. B. API-first, modulare Architektur)
- Architekturtreiber und Zielkonflikte
- Strategische Entscheidungen mit Verweisen auf ADRs

## Aktueller Stand

### Leitprinzipien

- Monorepo mit klaren Paketgrenzen und Workspace-Abhaengigkeiten (`workspace:*`)
- Framework-agnostische Kernlogik in `@sva/core`, Integration in der App-Ebene
- Route-Komposition ueber Factory-Pattern (`mergeRouteFactories`, `buildRouteTree`)
- Doku-getriebene Architekturpflege (arc42 + OpenSpec + ADR)

### Architekturtreiber

- Hohe Typsicherheit und Wartbarkeit bei wachsender Modulanzahl
- Erweiterbarkeit durch Plugins und zentrale Route-Registry
- Reproduzierbarkeit ueber standardisierte Nx-/pnpm-Workflows

### Zielkonflikte (aktuell sichtbar)

- Hohe Flexibilitaet (code-based + file-based Routing) vs. Komplexitaet
- Schneller Dev-Flow vs. Governance-Anforderungen in CI
- Multi-Tooling (Nx, TanStack, pnpm) vs. Einarbeitungsaufwand

### Strategische Entscheidungen (Auswahl)

- Frontend-Framework: `ADR-001`
- Plugin-Architektur: `ADR-002`
- Design-Token-Architektur: `ADR-003`

Referenzen:

- `./decisions/ADR-001-frontend-framework-selection.md`
- `./decisions/ADR-002-plugin-architecture-pattern.md`
- `./decisions/ADR-003-design-token-architecture.md`
