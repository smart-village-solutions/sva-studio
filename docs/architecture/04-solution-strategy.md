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
- IAM folgt einer klaren Verantwortungsgrenze: Keycloak für Identity, Postgres für IAM-Fachdaten, Redis nur als Laufzeit-Cache
- `instanceId` ist der kanonische Mandanten-Scope für IAM-Datenzugriff und Autorisierung
- IAM-Server-Module folgen einer Fassade-plus-Kernmodul-Strategie: dünne öffentliche Entry-Points, fachliche Unterordner und explizit dokumentierte Restschuld in `core.ts`
- HTTP-spezifische Fehlerantworten werden nicht im Core modelliert, sondern serverseitig über gemeinsame Utilities in `@sva/sdk/server`
- Doku-getriebene Architekturpflege (arc42 + OpenSpec + ADR)
- UI-Shell folgt semantischen Design-Tokens statt direkter Farbcodes und bleibt kompatibel zu Tailwind-/shadcn-Primitives
- Theming wird instanzfähig gedacht: `instanceId` kann Theme-Varianten bestimmen, Light/Dark-Mode bleibt dabei ein orthogonaler Modus

### Architekturtreiber

- Hohe Typsicherheit und Wartbarkeit bei wachsender Modulanzahl
- Erweiterbarkeit durch Plugins und zentrale Route-Registry
- Reproduzierbarkeit über standardisierte Nx-/pnpm-Workflows
- Frontend-App-Workflows werden als explizite Nx-Targets mit dedizierten Executor-Semantiken modelliert
- Betriebsfaehigkeit mit strukturierter Telemetrie
- Security/Privacy-Anforderungen an Auth und Logging
- Konsistenter Fehlervertrag und korrelierbare Logs über Infrastruktur- und Fachschicht hinweg
- Konsistente, zentrale Autorisierungsentscheidungen statt verteilter Fachmodul-Logik
- Konsistente UI-Branding-Schicht mit zentraler Theme-Auflösung statt komponentenlokaler Farbdefinitionen

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
- IAM-Identity-Basis und Scoping: `ADR-009`, `ADR-011`
- Swarm-/Traefik-Referenzprofil und Multi-Host-Auth-Grenze: `ADR-019`, `ADR-020`
- IAM-Permission-Modell und Laufzeitpfad: `ADR-012`, `ADR-013`, `ADR-014`
- IAM-IdP-Abstraktion für Keycloak-Admin-Pfade: `ADR-016`
- IAM-Server-Modularisierung und Restschuld-Führung: `ADR-017`

Referenzen:

- `./decisions/ADR-001-frontend-framework-selection.md`
- `./decisions/ADR-002-plugin-architecture-pattern.md`
- `./decisions/ADR-003-design-token-architecture.md`
- `./decisions/ADR-004-monitoring-stack-loki-grafana-prometheus.md`
- `./decisions/ADR-006-logging-pipeline-strategy.md`
- `./decisions/ADR-007-label-schema-and-pii-policy.md`
- `./decisions/ADR-008-codecov-coverage-reporting-and-gates.md`
- `./iam-service-architektur.md`
- `../adr/ADR-019-swarm-traefik-referenz-betriebsprofil.md`
- `../adr/ADR-020-kanonischer-auth-host-multi-host-grenze.md`
- `../adr/ADR-017-modulare-iam-server-bausteine.md`
