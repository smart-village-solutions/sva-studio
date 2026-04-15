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
| `@sva/routing` | `getClientRouteFactories()`, Plugin-Factories, Route-Pfade, Guards, Search-Normalisierung |
| `@sva/routing/server` | `getServerRouteFactories()` plus serverseitige Auth-Handler-Factories |

### Client-Verwendung

```ts
import { getClientRouteFactories } from '@sva/routing';

const routeFactories = getClientRouteFactories({
  bindings: appRouteBindings,
  plugins: studioPlugins,
});
```

### Server-Verwendung

```ts
import { getServerRouteFactories } from '@sva/routing/server';

const routeFactories = getServerRouteFactories({
  bindings: appRouteBindings,
  plugins: studioPlugins,
});
```

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
├── route-paths.ts
├── route-search.ts
├── account-ui.routes.ts
├── protected.routes.ts
├── auth.routes.ts
└── auth.routes.server.ts
```

## Nx-Konfiguration

- **Name:** `routing`
- **Tags:** `type:core`, `scope:routing`
- **Build:** `pnpm nx run routing:build`
- **Tests:** `pnpm nx run routing:test`

## Verwandte Dokumentation

- [Routing-Architektur](../../docs/architecture/routing-architecture.md)
- [Bausteinsicht (arc42 §5)](../../docs/architecture/05-building-block-view.md)
- [Laufzeitsicht (arc42 §6)](../../docs/architecture/06-runtime-view.md)
