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
   - generische Route-Registry Utilities (`mergeRouteFactories`, `buildRouteTree`)
3. Routing (`packages/routing`)
   - zentrale Route-Factories (client + server)
4. Auth (`packages/auth`)
   - OIDC-Flows, Session-Store, auth HTTP-Handler
5. SDK (`packages/sdk`)
   - Logger, Context-Propagation, OTEL-Bootstrap
6. Monitoring Client (`packages/monitoring-client`)
   - OTEL SDK Setup, Exporter, Log-Redaction-Processor
7. Data (`packages/data`)
   - einfacher HTTP DataClient mit In-Memory Cache
8. Plugin Example (`packages/plugin-example`)
   - Beispielroute fuer Plugin-Erweiterbarkeit

### Abhaengigkeiten (vereinfacht)

- App -> `@sva/core`, `@sva/routing`, `@sva/auth`, `@sva/plugin-example`
- `@sva/routing` -> `@sva/auth`, `@sva/core`
- `@sva/auth` -> `@sva/sdk`
- `@sva/sdk` -> `@sva/core`, `@sva/monitoring-client`
- `@sva/monitoring-client` -> OTEL Libraries, `@sva/sdk` Context API

### Boundary Core vs. Framework Binding

- Framework-agnostisch:
  - `packages/core`, Teile von `packages/data`, SDK Context APIs
- Framework-/Runtime-gebunden:
  - `apps/sva-studio-react`, TanStack-Route-Definitionen, Auth-Handler fuer Start

Referenzen:

- `packages/core/src/routing/registry.ts`
- `packages/routing/src/index.ts`
- `packages/auth/src/index.server.ts`
- `packages/sdk/src/server.ts`
