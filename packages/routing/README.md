# @sva/routing

`@sva/routing` ist die kanonische Routing-Bibliothek für SVA Studio. Das Package bündelt UI-Routen, Auth-Pfade, serverseitige Route-Factories, Guard-Helfer, Plugin-Routen und typsichere Search-Normalisierung an einer öffentlichen API.

## Architektur-Rolle

Das Package trennt Routing-Definition und Seiten-Bindings von der eigentlichen Anwendung. Die App liefert nur Root-Integration, konkrete Komponenten und Registry-Daten; `@sva/routing` materialisiert daraus die nutzbaren Client- und Server-Routen. Für Auth- und HTTP-Pfade stützt sich das Package auf `@sva/auth-runtime`, während Plugin- und Admin-Routen zentral im Routing-Layer zusammengeführt werden.

## Öffentliche API

| Pfad | Verantwortung |
| --- | --- |
| `@sva/routing` | Client-Route-Factories, `routePaths`, `uiRoutePaths`, Search-Normalisierung, Routing-Diagnostik-Typen |
| `@sva/routing/server` | Server-Route-Factories sowie serverseitige Auth-Handler und Pfadauflösung |
| `@sva/routing/guards` | Guard-Helfer für geschützte und administrative UI-Routen |
| `@sva/routing/plugins` | Plugin-Route-Factories, Guard-Mapping und Search-State für Admin-Ressourcen |
| `@sva/routing/auth` | kanonische Auth-Routen für den Client |

Wichtige Exporte sind unter anderem `getClientRouteFactories()`, `getServerRouteFactories()`, `createProtectedRoute()`, `getPluginRouteFactories()`, `routePaths`, `normalizeIamTab()`, `normalizeRoleDetailTab()` sowie die Diagnostik-Typen `RoutingDiagnosticsHook`, `RoutingDiagnosticEvent` und `RoutingDenyReason`.

## Nutzung und Integration

Die Anwendung übergibt `AppRouteBindings` mit konkreten Seiten-Komponenten sowie optional `adminResources`, `plugins` und einen `diagnostics`-Hook. Daraus erzeugt `@sva/routing` die vollständigen Route-Factories für TanStack Router.

```ts
import { getClientRouteFactories, routePaths } from '@sva/routing';
import { getServerRouteFactories } from '@sva/routing/server';

const clientRoutes = getClientRouteFactories({
  bindings: appRouteBindings,
  adminResources: studioBuildTimeRegistry.adminResources,
  plugins: studioBuildTimeRegistry.plugins,
});

const serverRoutes = getServerRouteFactories({
  bindings: appRouteBindings,
  adminResources: studioBuildTimeRegistry.adminResources,
  plugins: studioBuildTimeRegistry.plugins,
});

routePaths.ui.adminUsers;
```

Für geschützte UI-Bereiche stehen die Subpaths `@sva/routing/guards` und `@sva/routing/plugins` bereit. Routing-Diagnostik bleibt standardmäßig still und wird nur aktiv, wenn bewusst ein `RoutingDiagnosticsHook` injiziert wird.

## Projektstruktur

```text
packages/routing/
├── src/
│   ├── index.ts
│   ├── index.server.ts
│   ├── app.routes.ts
│   ├── app.routes.server.ts
│   ├── app.routes.shared.ts
│   ├── auth.routes.ts
│   ├── auth.routes.server.ts
│   ├── guards.ts
│   ├── plugins.ts
│   ├── route-paths.ts
│   ├── route-search.ts
│   └── diagnostics.ts
├── project.json
├── package.json
└── vitest.config.ts
```

Die Kernlogik liegt in `app.routes.shared.ts` und den zugehörigen Guard-, Plugin- und Admin-Route-Modulen. `index.ts` und `index.server.ts` definieren die öffentlichen Entry-Points für Client und Server.

## Nx-Konfiguration

- Projektname: `routing`
- Projekttyp: `library`
- Tags: `type:lib`, `scope:routing`
- Build: `pnpm nx run routing:build`
- Runtime-Check: `pnpm nx run routing:check:runtime`
- Lint: `pnpm nx run routing:lint`
- Unit-Tests: `pnpm nx run routing:test:unit`
- Coverage: `pnpm nx run routing:test:coverage`

## Verwandte Dokumentation

- [Routing-Architektur](../../docs/architecture/routing-architecture.md)
- [Bausteinsicht (arc42 §5)](../../docs/architecture/05-building-block-view.md)
- [Laufzeitsicht (arc42 §6)](../../docs/architecture/06-runtime-view.md)
- [Übersicht Routing](../../docs/routing.md)
- [ADR-035: Routing Observability Diagnostics Hook](../../docs/adr/ADR-035-routing-observability-diagnostics-hook.md)
