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
- Framework-agnostische Kernlogik in `@sva/core`, Integration in App-Ebene
- Trennung von client-sicheren und serverseitigen Routen/Handlern
- Observability ueber OTEL-Standards statt vendor-spezifischer App-Anbindung
- Doku-getriebene Architekturpflege (arc42 + OpenSpec + ADR)

### Architekturtreiber

- Hohe Typsicherheit und Wartbarkeit bei wachsender Modulanzahl
- Erweiterbarkeit durch Plugins und zentrale Route-Registry
- Betriebsfaehigkeit mit strukturierter Telemetrie
- Security/Privacy-Anforderungen an Auth und Logging

### Zielkonflikte (aktuell sichtbar)

- Hohe Flexibilitaet (code-based + file-based Routing) vs. Komplexitaet
- Schneller Dev-Flow vs. strenge Security-/PII-Kontrollen
- Multi-Tooling (Nx, TanStack, OTEL) vs. Einarbeitungsaufwand

### Strategische Entscheidungen (Auswahl)

- Frontend-Framework: `ADR-001`
- Plugin-Architektur: `ADR-002`
- Monitoring-Stack: `ADR-004`
- Logging-Pipeline und Label-Policy: `ADR-006`, `ADR-007`

Referenzen:

- `./decisions/ADR-001-frontend-framework-selection.md`
- `./decisions/ADR-002-plugin-architecture-pattern.md`
- `./decisions/ADR-004-monitoring-stack-loki-grafana-prometheus.md`
