# 12 Glossar

## Zweck

Dieser Abschnitt fuehrt einheitliche Begriffe und Abkuerzungen fuer
Architektur und Betrieb.

## Mindestinhalte

- Begriff
- Definition
- Bezug zu Baustein/Prozess/ADR

## Aktueller Stand

| Begriff | Definition | Bezug |
| --- | --- | --- |
| arc42 | Strukturrahmen fuer Architekturdokumentation mit 12 Abschnitten | `docs/architecture/README.md` |
| ADR | Architecture Decision Record fuer nachvollziehbare Entscheidungen | `docs/architecture/decisions/` |
| Kommune | Organisations-/Mandanteneinheit im Smart-Village-Kontext (fachlicher Begriff) | `concepts/konzeption-cms-v2/01_Einleitung/Einleitung.md` |
| Core Route Factory | Funktion, die aus `rootRoute` eine Route erzeugt | `packages/core/src/routing/registry.ts` |
| Plugin Route Factory | Route-Factory aus Plugins, die mit Core-Factories gemerged wird | `packages/plugin-example/src/routes.tsx` |
| Route Registry | Zusammenfuehrung und Aufbau des finalen Route-Trees | `packages/core/src/routing/registry.ts` |
| DataClient | Einfacher HTTP-Client mit In-Memory-Cache und TTL | `packages/data/src/index.ts` |
| Server Function | Serverseitige Funktion in TanStack Start (`createServerFn`) | `apps/sva-studio-react/src/routes/-core-routes.tsx` |
| workspace:* | pnpm-Mechanismus fuer interne Paketabhaengigkeiten im Monorepo | `pnpm-workspace.yaml` |
| Coverage Exempt | Projekt, das temporaer nicht in Coverage-Gates eingeht | `tooling/testing/coverage-policy.json` |
