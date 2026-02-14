# 05 Bausteinsicht

## Zweck

Dieser Abschnitt beschreibt statische Bausteine, Verantwortlichkeiten und
Abhaengigkeiten des aktuellen Systems.

## Mindestinhalte

- Hauptbausteine mit Verantwortung
- Schnittstellen und Abhaengigkeiten zwischen Bausteinen
- Grenzen zwischen framework-agnostischer Kernlogik und Bindings

## Aktueller Stand

### Hauptbausteine

1. App (`apps/sva-studio-react`)
   - TanStack Start App, UI, Root-Shell, Router-Erzeugung
2. Core (`packages/core`)
   - generische Route-Registry-Utilities (`mergeRouteFactories`, `buildRouteTree`)
3. Data (`packages/data`)
   - einfacher HTTP DataClient mit In-Memory-Cache
4. SDK (`packages/sdk`)
   - gemeinsamer Einstiegspunkt fuer paketuebergreifende Utilities
5. Plugin Example (`packages/plugin-example`)
   - Beispielroute fuer Plugin-Erweiterbarkeit

### Abhaengigkeiten (vereinfacht)

- `apps/sva-studio-react` -> `@sva/core`, `@sva/plugin-example`
- `@sva/data` -> `@sva/core`
- `@sva/sdk` -> `@sva/core`
- `@sva/plugin-example` -> `@sva/core`

### Boundary Core vs. Framework Binding

- Framework-agnostisch:
  - `packages/core`, `packages/data`, `packages/sdk`
- Framework-/Runtime-gebunden:
  - `apps/sva-studio-react`, `packages/plugin-example` (React Router Route-Definitionen)

Referenzen:

- `apps/sva-studio-react/src/router.tsx`
- `packages/core/src/routing/registry.ts`
- `packages/data/src/index.ts`
- `packages/plugin-example/src/routes.tsx`
