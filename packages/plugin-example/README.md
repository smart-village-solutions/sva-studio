# @sva/plugin-example

Beispiel-Plugin für SVA Studio. Demonstriert das Plugin-Pattern: Wie ein externes Paket eigene Routen in die Anwendung einbringt, ohne den Core-Code zu verändern.

## Architektur-Rolle

Dieses Paket dient als **Referenzimplementierung** für das Plugin-System (siehe ADR-002). Es zeigt:

- Wie Route-Factories als Plugin-Erweiterung exportiert werden
- Wie ein Plugin `@sva/core` als einzige Workspace-Abhängigkeit nutzt
- Wie `@tanstack/react-router`, `react` und `react-dom` als Peer-Dependencies deklariert werden

```
@sva/core  ← Core-Version, Route-Registry
  ↑
@sva/plugin-example
  ↑
App (sva-studio-react) ← mergt Plugin-Routen in den Router
```

**Abhängigkeiten:**
- `@sva/core` (workspace) – Core-Version
- **Peer:** `@tanstack/react-router`, `react`, `react-dom`

## Export

| Pfad | Beschreibung |
| --- | --- |
| `@sva/plugin-example` | Plugin-Version + Route-Factory-Array |

## Verwendung

### Plugin-Routen registrieren

```ts
import { pluginExampleRoutes } from '@sva/plugin-example';
import { coreRouteFactories } from '@sva/routing';
import { mergeRouteFactories, buildRouteTree } from '@sva/core';

const allFactories = mergeRouteFactories(coreRouteFactories, pluginExampleRoutes);
const routeTree = buildRouteTree(rootRoute, allFactories);
```

### Plugin-Route

Das Plugin stellt eine Demo-Route unter `/plugins/example` bereit:

```tsx
import { pluginExampleRoutes, pluginExampleVersion } from '@sva/plugin-example';

// pluginExampleRoutes ist ein Array von Route-Factory-Funktionen
// Jede Factory erhält die Root-Route und gibt eine konkrete Route zurück
```

## Eigenes Plugin erstellen

Nimm dieses Paket als Vorlage:

1. **Neues Package anlegen:** `packages/plugin-mein-feature/`
2. **Abhängigkeiten:** `@sva/core` als Workspace-Dep, Router + React als Peer-Deps
3. **Routen exportieren:** Array von `RouteFactory`-Funktionen
4. **In der App registrieren:** Via `mergeRouteFactories()` einbinden

**`package.json`-Vorlage:**

```json
{
  "name": "@sva/plugin-mein-feature",
  "dependencies": { "@sva/core": "workspace:*" },
  "peerDependencies": {
    "@tanstack/react-router": "^1.166.3",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

**Route-Factory-Vorlage:**

```tsx
import { createRoute, type RootRoute } from '@tanstack/react-router';

const MeinFeaturePage = () => <div>Mein Feature</div>;

export const meinFeatureRoutes = [
  (rootRoute: RootRoute) => createRoute({
    getParentRoute: () => rootRoute,
    path: '/plugins/mein-feature',
    component: MeinFeaturePage,
  }),
];
```

## Projektstruktur

```
src/
├── index.ts      # Plugin-Version + Route-Re-Export
└── routes.tsx    # React-Komponente + Route-Factory
```

## Nx-Konfiguration

- **Name:** `plugin-example`
- **Tags:** `scope:plugin`, `type:lib`
- **Build:** `pnpm nx run plugin-example:build`
- **Lint:** `pnpm nx run plugin-example:lint`

## Verwandte Dokumentation

- [ADR-002: Plugin Architecture Pattern](../../docs/architecture/decisions/ADR-002-plugin-architecture-pattern.md)
- [Routing-Architektur](../../docs/architecture/routing-architecture.md)
- [Bausteinsicht (arc42 §5)](../../docs/architecture/05-building-block-view.md)
