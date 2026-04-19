# @sva/routing

Typsicheres Routing-Paket für SVA Studio. `@sva/routing` ist die kanonische öffentliche Routing-Schnittstelle der Anwendung und bündelt UI-Routen, Auth-/HTTP-Routen, Guards, Search-Validierung und Plugin-Anknüpfung.

## Architektur-Rolle

`@sva/routing` definiert die Route-API der App. Die Anwendung liefert nur noch Root-Shell, Context-Wiring, Plugin-Liste und Seiten-Bindings.

```text
@sva/auth    <- kanonische Auth-/API-Pfade + Server-Handler
  ^
@sva/routing <- UI-/Auth-/Plugin-Routing API
  ^
App          <- Root, Context, Seiten-Bindings
```

## Öffentliche API

| Pfad | Beschreibung |
| --- | --- |
| `@sva/routing` | `getClientRouteFactories()`, Route-Pfade, Search-Normalisierung, zentrale Routing-Typen |
| `@sva/routing/server` | `getServerRouteFactories()` plus serverseitige Auth-Handler-Factories |
| `@sva/routing/guards` | Guard-Definitionen und Protected-Route-Helfer |
| `@sva/routing/plugins` | Plugin-Guard-Mapping und Plugin-Route-Factories |
| `@sva/routing/auth` | kanonische Auth-/HTTP-Pfade |

### Client-Verwendung

```ts
import { getClientRouteFactories, routePaths } from '@sva/routing';

const routeFactories = getClientRouteFactories({
  bindings: appRouteBindings,
  plugins: studioPlugins,
});

routePaths.ui.interfaces;
```

### Server-Verwendung

```ts
import { getServerRouteFactories } from '@sva/routing/server';

const routeFactories = getServerRouteFactories({
  bindings: appRouteBindings,
  plugins: studioPlugins,
});
```

### Guards und Plugins

```ts
import { createProtectedRoute } from '@sva/routing/guards';
import { getPluginRouteFactories } from '@sva/routing/plugins';
```

## Observability-Vertrag

`@sva/routing` bietet einen kleinen, strukturierten Diagnostics-Vertrag für routing-relevante Entscheidungen.

### Exportierte Typen

- `RoutingDiagnosticsHook`
- `RoutingDiagnosticEvent`
- `RoutingDenyReason`

### Safe-Feldsatz

| Feld | Bedeutung |
| --- | --- |
| `event` | Kanonischer Routing-Eventname |
| `route` | Template-Pfad, nie aufgelöste URL mit IDs |
| `reason` | Fester `kebab-case`-Katalog |
| `plugin` | Plugin-Kontext bei Plugin-Ereignissen |
| `redirect_target` / `required_roles` / `unsupported_guard` | Zusatzfelder für Guard- und Plugin-Diagnostik |
| `method` | HTTP-Methode bei Server-Ereignissen |
| `allow` | Erlaubte Methoden bei `405` |
| `status_code` / `duration_ms` | Laufzeit- und Ergebnisdaten bei Handler-Completion |
| `workspace_id` | best effort Server-Kontext |
| `request_id` / `trace_id` | best effort Korrelation im Server-Kontext |
| `error_type` / `error_message` | minimaler Fehlerkontext ohne Stack-Trace |

### Injektionsmuster

```ts
import { getClientRouteFactories, type RoutingDiagnosticsHook } from '@sva/routing';

const diagnostics: RoutingDiagnosticsHook = (event) => {
  if (event.event === 'routing.guard.access_denied') {
    devLogger.info('routing denied', event);
  }
};

const routeFactories = getClientRouteFactories({
  bindings: appRouteBindings,
  plugins: studioPlugins,
  diagnostics,
});
```

### Browser-/Server-Split

- Client- und shared Routing-Dateien bleiben ohne expliziten `diagnostics`-Hook standardmäßig still.
- Browser-seitig entsteht nur dann Routing-Diagnostik, wenn der Consumer bewusst einen Hook injiziert.
- Serverseitig nutzen Auth-Routen und Server-Route-Factories denselben Adapter auf den SDK-/OTEL-Logger.

### Was bewusst nicht geloggt wird

- Search-Param-Normalisierung ohne Diagnosewert
- aufgelöste Pfade mit IDs
- rohe Query-Strings, Token-URLs, Stack-Traces oder andere PII-/Secret-Felder

## Routing-Modell

- Produktive Seitenrouten sind vollständig code-based.
- File-based Routing bleibt nur für `__root.tsx` und die TanStack-Start-Integration erhalten.
- Demo-Routen sind kein Bestandteil des kanonischen Produkt-Routings.
- Plugin-Routen werden zentral im Routing-Paket materialisiert.

## Projektstruktur

```text
src/
├── index.ts
├── index.server.ts
├── app.routes.ts
├── app.routes.server.ts
├── app.routes.shared.ts
├── route-paths.ts
├── route-search.ts
├── account-ui.routes.ts
├── protected.routes.ts
├── auth.routes.ts
└── auth.routes.server.ts
```

## Nx-Konfiguration

- **Name:** `routing`
- **Tags:** `type:lib`, `scope:routing`
- **Build:** `pnpm nx run routing:build`
- **Runtime-Check:** `pnpm nx run routing:check:runtime`
- **Lint:** `pnpm nx run routing:lint`
- **Unit-Tests:** `pnpm nx run routing:test:unit`
- **Coverage:** `pnpm nx run routing:test:coverage`

## Verwandte Dokumentation

- [Routing-Architektur](../../docs/architecture/routing-architecture.md)
- [Bausteinsicht (arc42 §5)](../../docs/architecture/05-building-block-view.md)
- [Laufzeitsicht (arc42 §6)](../../docs/architecture/06-runtime-view.md)
