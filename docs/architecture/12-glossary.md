# 12 Glossar

## Zweck

Dieser Abschnitt führt einheitliche Begriffe und Abkürzungen für
Architektur und Betrieb.

## Mindestinhalte

- Begriff
- Definition
- Bezug zu Baustein/Prozess/ADR

## Aktueller Stand

| Begriff | Definition | Bezug |
| --- | --- | --- |
| arc42 | Strukturrahmen für Architekturdokumentation mit 12 Abschnitten | `docs/architecture/README.md` |
| ADR | Architecture Decision Record für nachvollziehbare Entscheidungen | `docs/architecture/decisions/` |
| Kommune | Organisations-/Mandanteneinheit im Smart-Village-Kontext (fachlicher Begriff) | `concepts/konzeption-cms-v2/01_Einleitung/Einleitung.md` |
| Core Route Factory | Funktion, die aus `rootRoute` eine Route erzeugt | `packages/core/src/routing/registry.ts` |
| Plugin Route Factory | Route-Factory aus Plugins, die mit Core-Factories gemerged wird | `packages/plugin-example/src/routes.tsx` |
| Route Registry | Zusammenführung und Aufbau des finalen Route-Trees | `packages/core/src/routing/registry.ts` |
| DataClient | Einfacher HTTP-Client mit In-Memory-Cache und TTL | `packages/data/src/index.ts` |
| Server Function | Serverseitige Funktion in TanStack Start (`createServerFn`) | `apps/sva-studio-react/src/routes/-core-routes.tsx` |
| workspace:* | pnpm-Mechanismus für interne Paketabhängigkeiten im Monorepo | `pnpm-workspace.yaml` |
| Coverage Exempt | Projekt, das temporär nicht in Coverage-Gates eingeht | `tooling/testing/coverage-policy.json` |
