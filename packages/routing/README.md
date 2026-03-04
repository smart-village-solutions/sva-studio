# @sva/routing

Typsicheres Routing-Paket für SVA Studio. Verbindet die framework-agnostische Route-Registry aus `@sva/core` mit konkreten TanStack Router-Implementierungen und Auth-Handlern.

## Architektur-Rolle

`@sva/routing` ist die Brücke zwischen Kernlogik und Framework. Es erzeugt aus den abstrakten Route-Factories konkrete TanStack Router-Routen und bindet dabei serverseitige Auth-Handler lazily ein – ohne den Client-Bundle aufzublähen.

```
@sva/core    ← Route-Registry, IAM-Typen
  ↑
@sva/auth    ← Auth-Route-Pfade, Server-Handler
  ↑
@sva/routing ← Konkrete TanStack Router-Routen
  ↑
App (sva-studio-react)
```

**Abhängigkeiten:**
- `@sva/core` (workspace) – Route-Registry
- `@sva/auth` (workspace) – Auth-Route-Pfade und Server-Handler
- `@tanstack/react-router` – TanStack Router

## Exports

| Pfad | Beschreibung |
| --- | --- |
| `@sva/routing` | Client-safe Route-Factories und Route-Pfade |
| `@sva/routing/server` | Server-side Route-Factories mit Handler-Implementierungen |
| `@sva/routing/auth` | Auth-spezifische Route-Definitionen |

## Konzept: Code-basierte Route-Komposition

Das Routing folgt einem dualen Ansatz:

1. **File-based Routes** (TanStack Start) – für App-spezifische Seiten
2. **Code-based Route-Factories** – für Core- und Plugin-Routen

Route-Factories sind Funktionen, die eine Root-Route entgegennehmen und daraus konkrete Routen erzeugen. Dies ermöglicht Plugin-Erweiterbarkeit ohne Änderung des Core-Codes.

### Client-Verwendung

```ts
import { coreRouteFactories, authRoutePaths } from '@sva/routing';
import { mergeRouteFactories, buildRouteTree } from '@sva/core';
import { pluginExampleRoutes } from '@sva/plugin-example';

// Alle Route-Factories zusammenführen
const allFactories = mergeRouteFactories(coreRouteFactories, pluginExampleRoutes);

// Route-Tree aufbauen
const routeTree = buildRouteTree(rootRoute, allFactories);
```

### Server-Verwendung

```ts
import { authServerRouteFactories } from '@sva/routing/server';
```

Server-Route-Factories laden Auth-Handler lazily via `import('@sva/auth/server')`, um Code-Splitting sicherzustellen.

## Client/Server-Trennung

Die strikte Trennung ist kritisch für korrektes Bundling:

- **Client** (`@sva/routing`): Exportiert Route-Factories ohne Handler-Implementierungen. Nur Routing-Struktur und Pfade – kein Node.js-Code.
- **Server** (`@sva/routing/server`): Exportiert Route-Factories mit lazily importierten Auth-Handlern. Exhaustive Handler-Map via `satisfies Record<AuthRoutePath, AuthHandlers>`.

> **Wichtig:** Niemals `@sva/routing/server` im Client-Code importieren. Dies würde Node.js-Abhängigkeiten ins Browser-Bundle ziehen.

## Projektstruktur

```
src/
├── index.ts                       # Client-safe Exports
├── index.server.ts                # Server-side Exports
├── auth.routes.ts                 # Client-safe Auth-Route-Factories
├── auth.routes.server.ts          # Server Auth-Routes mit Handler (167 Zeilen)
├── auth.routes.server.test.ts     # Server-Route-Tests
└── core.routes.ts                 # Route-Aggregation (Core + Auth)
```

## Nx-Konfiguration

- **Name:** `routing`
- **Tags:** `type:core`, `scope:routing`
- **Build:** `pnpm nx run routing:build`
- **Tests:** `pnpm nx run routing:test`

## Verwandte Dokumentation

- [Routing-Architektur](../../docs/architecture/routing-architecture.md)
- [Bausteinsicht (arc42 §5)](../../docs/architecture/05-building-block-view.md)
- [Laufzeitsicht (arc42 §6)](../../docs/architecture/06-runtime-view.md) – Szenario 1: App-Start + Route-Komposition
- [ADR-002: Plugin Architecture Pattern](../../docs/architecture/decisions/ADR-002-plugin-architecture-pattern.md)
