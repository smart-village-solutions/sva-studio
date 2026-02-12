# Routing Architecture

Dieses Dokument beschreibt die aktuelle Routing-Architektur im SVA Studio Monorepo: Aufbau, Verantwortlichkeiten, Server/Client-Trennung, Auth-Integration und Plugin-Erweiterbarkeit.

## Zielbild

Die Routing-Architektur ist auf folgende Ziele ausgelegt:

1. **Type-safe Routing** mit TanStack Router.
2. **Code-basierte Route-Komposition** (Core + Auth + Plugins).
3. **Saubere Server/Client-Grenze**, damit server-only Module nicht in den Client-Bundle gelangen.
4. **Erweiterbarkeit** durch Plugin-Route-Factories.

## Scope

Abgedeckt:

- `packages/core` (generische Route-Registry Utilities)
- `packages/routing` (zentraler Route-Katalog)
- `apps/sva-studio-react` (konkrete Route-Komposition + Router-Instanz)
- `packages/auth` (serverseitige Auth-Handler)
- `packages/plugin-example` (Plugin-Route-Beispiel)

Nicht abgedeckt:

- UI-Design der einzelnen Seiten
- Auth-Session-Interna (siehe auth-Doku)

## High-Level Architektur

```text
packages/core/routing/registry.ts
  -> mergeRouteFactories(), buildRouteTree()

packages/routing
  -> coreRouteFactories
  -> authRouteFactories        (client-safe)
  -> authServerRouteFactories  (server handlers, lazy import)

apps/sva-studio-react
  routes/-core-routes.tsx           (app core demos/pages)
  routes/-core-routes.server.tsx    (+ auth server route factories)
  router.tsx                        (merge core + plugin routes, createRouter)

packages/plugin-example
  -> pluginExampleRoutes

Result:
  rootRoute + merged route factories -> runtime route tree
```

## Komponenten im Detail

### 1) Registry Utilities (`packages/core/src/routing/registry.ts`)

Kernfunktionen:

- `mergeRouteFactories(core, plugins)`:
  - kombiniert mehrere Factory-Listen in definierter Reihenfolge.
- `buildRouteTree(rootRoute, factories)`:
  - materialisiert Factories zu echten TanStack Routes
  - ruft `rootRoute.addChildren(routes)` auf.

Diese Utilities sind framework-agnostisch gehalten und kennen keine App-Details.

### 2) Zentrale Routing-Library (`packages/routing/src/*`)

Exports:

- `@sva/routing` (client-safe):
  - `authRouteFactories`
  - `authRoutePaths`
  - `coreRouteFactories`
- `@sva/routing/server` (server-only):
  - `authServerRouteFactories`
  - `authRoutePaths`
  - `coreRouteFactories`

Warum diese Trennung:

- Client-Bundles sollen keine Node-/Server-Abhängigkeiten laden.
- Auth-Handler leben serverseitig in `@sva/auth/server`.

### 3) Auth-Routen: Shared Paths + getrennte Factories

Path-Single-Source:

- `packages/auth/src/routes.shared.ts`
- `packages/routing/src/auth.routes.ts`

Definierte Pfade:

- `/auth/login`
- `/auth/callback`
- `/auth/me`
- `/auth/logout`

#### Client-safe Variante (`auth.routes.ts`)

- erstellt Routen mit `component: () => null`
- **keine** Server-Handler
- geeignet fuer clientseitige Route-Struktur/Linkbarkeit

#### Server-Variante (`auth.routes.server.ts`)

- setzt `server.handlers` an den Routen
- resolved Handler via lazy imports:
  - `await import('@sva/auth/server')`
- Vorteil:
  - kein Top-Level-Import von server-only Code in clientnahen Modulen
  - bessere Bundling-Sicherheit

### 4) App-Core-Routen (`apps/sva-studio-react/src/routes/-core-routes.tsx`)

Inhalt:

- Home-Route (`/`)
- Demo-Route-Hierarchie (`/demo/...`)
- SSR-/API-Demo-Routen
- Einbindung von `authRouteFactories` (client-safe)

Die Datei exportiert:

- `coreRouteFactoriesBase`
- `coreRouteFactories = [...coreRouteFactoriesBase, ...authRouteFactories]`

### 5) App-Server-Routen (`apps/sva-studio-react/src/routes/-core-routes.server.tsx`)

Server-Kombination:

- importiert `coreRouteFactoriesBase`
- ergänzt `authServerRouteFactories` aus `@sva/routing/server`

Export:

- `coreRouteFactories` (serverfähige Endfassung fuer die App)

### 6) Router-Instanz (`apps/sva-studio-react/src/router.tsx`)

Ablauf in `getRouter()`:

1. `mergeRouteFactories(coreRouteFactories, pluginExampleRoutes)`
2. `buildRouteTree(rootRoute, mergedFactories)`
3. `createRouter({ routeTree, ... })`

Damit ist die Route-Komposition vollständig code-getrieben.

### 7) Root Route (`apps/sva-studio-react/src/routes/__root.tsx`)

- erstellt `createRootRoute(...)`
- definiert Shell, Head, NotFound
- serverseitiger Loader initialisiert SDK nur im SSR-Kontext:
  - `if (import.meta.env.SSR) { await import('../lib/init-sdk.server') ... }`

## Plugin-Routing

Beispiel in `packages/plugin-example/src/routes.tsx`:

- exportiert `pluginExampleRoutes` als Route-Factory-Liste
- wird in `apps/sva-studio-react/src/router.tsx` zusammen mit Core-Factories gemerged

Damit kann jedes Plugin isoliert eigene Routen beitragen, ohne den App-Router direkt zu editieren.

## Request/Response Routing fuer Auth

Auth-Endpunkte werden als TanStack Server Route Handler registriert und delegieren in `@sva/auth/server`:

- `/auth/login` -> `loginHandler()`
- `/auth/callback` -> `callbackHandler(request)`
- `/auth/me` -> `meHandler(request)`
- `/auth/logout` -> `logoutHandler(request)`

Die eigentliche Business-Logik verbleibt im Auth-Package; das Routing-Package bleibt ein Integrations-Layer.

## Typisierung und Sicherheit

### Type Safety

- Routen werden als Factories mit `RootRoute`-Typen gebaut.
- Path-Listen sind als `const` definiert und wiederverwendbar.
- `@tanstack/react-router` stellt typed navigation/loader APIs bereit.

### Server/Client Separation

Regeln:

1. Server-Handler nur in `@sva/routing/server` und `.server.tsx` Pfaden verwenden.
2. Keine server-only Imports in client-exponierten Route-Dateien.
3. Lazy imports fuer Auth-Handler verhindern versehentliche Client-Bundle-Leaks.

## Beziehung zu `routeTree.gen.ts`

`apps/sva-studio-react/src/routeTree.gen.ts` wird von TanStack Router generiert (File-based Typ-Artefakt).

Wichtig:

- Runtime-Komposition erfolgt hier primär code-basiert via `buildRouteTree(...)`.
- Das generierte File bleibt relevant fuer TanStack Start Typ-Registrierung/Integration.
- Bei refactors muss darauf geachtet werden, dass file-based und code-based Sicht konsistent bleiben.

## Aktuelle Route-Sources (uebersichtlich)

1. File Routes:
  - `routes/__root.tsx`
  - `routes/index.tsx`
  - `routes/admin/api/phase1-test.tsx` (Debug/Admin-Testroute)
2. Code Route Factories:
  - `routes/-core-routes.tsx`
  - `routes/-core-routes.server.tsx`
  - `@sva/routing`
  - `@sva/plugin-example`

## Konventionen fuer neue Routen

### Do

1. Neue app-spezifische Routen in `-core-routes.tsx` als Factory ergänzen.
2. Server-Handler nur in server-spezifischen Factories oder `createServerFn` kapseln.
3. Shared Pfade als `const` + Typ in zentralen Modulen definieren.
4. Plugin-Routen als eigene Factory-Liste exportieren und im Router mergen.

### Don't

1. Keine server-only Imports in client-safe Routing-Modulen.
2. Keine duplizierten Auth-Path-Strings in App-Code.
3. Keine direkte Kopplung von App-Router an interne Auth-Implementierungsdetails.

## Bekannte Trade-offs

1. **Dualer Ansatz (file-based + code-based)** erhöht Flexibilität, aber auch Komplexität.
2. Debug/Admin-Test-Routen koennen Route-Tree-Sicht erweitern, obwohl sie nicht Teil des Core-Flows sind.
3. Strikte Import-Disziplin ist entscheidend; sonst drohen Bundling-/Hydration-Probleme.

## Empfohlene Weiterentwicklung

1. Debug-/Test-Routen klar hinter Feature-Flags oder Dev-Only Guards halten.
2. Routing-Tests fuer Factory-Merge-Reihenfolge und Auth-Handler-Mapping ausbauen.
3. Mittelfristig dokumentieren, welche Teile file-based vs. code-based als source of truth gelten.
4. Optional: Routing-Architektur als ADR (Accepted) ergänzen.

## Referenzen

- `docs/routing.md`
- `packages/core/src/routing/registry.ts`
- `packages/routing/src/index.ts`
- `packages/routing/src/index.server.ts`
- `packages/routing/src/core.routes.ts`
- `packages/routing/src/auth.routes.ts`
- `packages/routing/src/auth.routes.server.ts`
- `apps/sva-studio-react/src/router.tsx`
- `apps/sva-studio-react/src/routes/-core-routes.tsx`
- `apps/sva-studio-react/src/routes/-core-routes.server.tsx`
- `apps/sva-studio-react/src/routes/__root.tsx`
- `apps/sva-studio-react/src/routeTree.gen.ts`
- `packages/plugin-example/src/routes.tsx`
- `docs/architecture/decisions/ADR-001-frontend-framework-selection.md`
- `docs/architecture/decisions/ADR-002-plugin-architecture-pattern.md`
