# Change: Routing-Observability-Vertrag ausbauen

## Why
`@sva/routing` ist die kanonische Routing-Schnittstelle der Anwendung, besitzt aber aktuell nur für unbehandelte Fehler in serverseitigen Auth-Handlern einen expliziten Logging-Vertrag. Guard-Entscheidungen, Plugin-Routen, Dispatch-Anomalien und andere routing-relevante Pfade bleiben damit im operativen Betrieb weitgehend unsichtbar oder inkonsistent beobachtbar.

Für den Betrieb und die Fehlersuche brauchen wir einen klaren, privacy-sicheren Observability-Vertrag für Routing-Ereignisse. Dieser Vertrag soll festlegen, welche Entscheidungen und Anomalien geloggt werden, mit welchen Feldern sie korreliert werden und an welchen Stellen bewusst kein Logging erfolgt, um Noise und PII-Risiken zu vermeiden.

## What Changes
- erweitert die bestehende `routing`-Capability um einen vollständigen Routing-Observability-Vertrag
- definiert strukturierte Logging-Anforderungen für:
  - serverseitige Auth-/IAM-Dispatch-Pfade
  - Guard-Denials und Redirect-Entscheidungen
  - Plugin-Route-Auflösung und unbekannte/nicht unterstützte Guard-Mappings
  - Search-Param-Normalisierung mit sicherheits- oder diagnose-relevanten Korrekturen
  - bestehende Drift-/Startup-Guards
- führt einen expliziten Logger-/Diagnostics-Hook-Vertrag für Routing ein, damit Browser- und Server-Kontexte sauber getrennt bleiben
- definiert Noise-Grenzen, Datenschutzregeln und Safe-Felder für Routing-Logs
- aktualisiert Routing- und Logging-Dokumentation im Sinne der arc42-Querschnittskonzepte

## Impact
- Affected specs: `routing`
- Affected code:
  - `packages/routing/src/auth.routes.server.ts`
  - `packages/routing/src/protected.routes.ts`
  - `packages/routing/src/account-ui.routes.ts`
  - `packages/routing/src/app.routes.shared.ts`
  - `packages/routing/src/route-search.ts`
  - `packages/routing/README.md`
  - `docs/architecture/routing-architecture.md`
  - `docs/architecture/logging-architecture.md`
  - `docs/development/observability-best-practices.md`
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
