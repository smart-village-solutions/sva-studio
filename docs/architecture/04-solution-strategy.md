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
- Framework-agnostische Kernlogik in `@sva/core`, Integration in App-Ebene
- Plugin-SDK-Boundary: Plugins greifen ausschließlich über `@sva/sdk` auf Host-APIs zu
- Trennung von client-sicheren und serverseitigen Routen/Handlern
- Observability über OTEL-Standards statt vendor-spezifischer App-Anbindung
- Doku-getriebene Architekturpflege (arc42 + OpenSpec + ADR)

### Architekturtreiber

- Hohe Typsicherheit und Wartbarkeit bei wachsender Modulanzahl
- Erweiterbarkeit durch Plugins und zentrale Route-Registry
- Reproduzierbarkeit über standardisierte Nx-/pnpm-Workflows
- Betriebsfaehigkeit mit strukturierter Telemetrie
- Security/Privacy-Anforderungen an Auth und Logging

### Zielkonflikte (aktuell sichtbar)

- Hohe Flexibilität (code-based + file-based Routing) vs. Komplexität
- Schneller Dev-Flow vs. strenge Security-/PII-Kontrollen
- Multi-Tooling (Nx, TanStack, OTEL) vs. Einarbeitungsaufwand

### Strategische Entscheidungen (Auswahl)

- Frontend-Framework: `ADR-001`
- Plugin-Architektur: `ADR-002`
- Design-Token-Architektur: `ADR-003`
- Monitoring-Stack: `ADR-004`
- Logging-Pipeline und Label-Policy: `ADR-006`, `ADR-007`
- Coverage-Reporting mit externem Transparenz-Layer: `ADR-008`

Referenzen:

- `./decisions/ADR-001-frontend-framework-selection.md`
- `./decisions/ADR-002-plugin-architecture-pattern.md`
- `./decisions/ADR-003-design-token-architecture.md`
- `./decisions/ADR-004-monitoring-stack-loki-grafana-prometheus.md`
- `./decisions/ADR-006-logging-pipeline-strategy.md`
- `./decisions/ADR-007-label-schema-and-pii-policy.md`
- `./decisions/ADR-008-codecov-coverage-reporting-and-gates.md`
