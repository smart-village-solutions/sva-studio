# Routing Architecture

Dieses Dokument beschreibt die aktuelle Routing-Architektur im SVA Studio Monorepo: Aufbau, Verantwortlichkeiten, Server/Client-Trennung, Auth-Integration und Plugin-Erweiterbarkeit.

## Zielbild

Die Routing-Architektur ist auf folgende Ziele ausgelegt:

1. **Type-safe Routing** mit TanStack Router.
2. **Eine öffentliche Routing-Schnittstelle** über `@sva/routing`.
3. **Code-basierte produktive Seitenrouten** ohne app-lokale Parallel-Registrierung.
4. **Saubere Server/Client-Grenze**, damit server-only Module nicht in den Client-Bundle gelangen.
5. **Erweiterbarkeit** durch statisch registrierte Plugins ueber `@sva/plugin-sdk` und einen kanonischen Build-time-Registry-Vertrag.
6. **Gezielte Routing-Observability** für Guard-Denials, Plugin-Anomalien und serverseitige Dispatch-Fehler ohne Browser-Noise.
7. **Deklarative Admin-Ressourcen** für CRUD-artige Host-Flächen statt verteilter Einzelverdrahtung.

## Scope

Abgedeckt:

- `packages/routing` als kanonische Routing-Library
- `packages/auth-runtime` für Auth-Runtime-Pfade und Server-Handler sowie IAM-Zielpackages für Fachhandler
- `apps/sva-studio-react` für Root-Shell, Router-Erzeugung und Seiten-Bindings
- statisch registrierte Plugin-Routen über `PluginDefinition`
- statisch registrierte Admin-Ressourcen über `AdminResourceDefinition`
- konsolidierte Build-time-Materialisierung über `createBuildTimeRegistry(...)`

Nicht abgedeckt:

- UI-Design der einzelnen Seiten
- Auth-Session-Interna (siehe Auth-Doku)
- produktive Browser-Telemetrie für normale Navigationen

## High-Level Architektur

```text
packages/auth-runtime
  -> authRoutePaths
  -> runtime handlers

packages/routing
  -> getClientRouteFactories()
  -> getServerRouteFactories()
  -> getPluginRouteFactories()
  -> Admin-Ressourcen-Materialisierung
  -> routePaths / Guards / Search-Normalisierung

apps/sva-studio-react
  routing/app-route-bindings.tsx
  routes/__root.tsx
  router.tsx

packages/plugin-news
  -> PluginDefinition

@sva/plugin-sdk
  -> createBuildTimeRegistry()

Result:
  build-time registry + route factories from @sva/routing -> runtime route tree
```

## Komponenten im Detail

### 1) Zentrale Routing-Library (`packages/routing/src/*`)

Exports:

- `@sva/routing`:
  - `getClientRouteFactories()`
  - `getPluginRouteFactories()`
  - `routePaths`
  - Search-Normalisierung für routing-relevante Search-Params
- `@sva/routing/server`:
  - `getServerRouteFactories()`
  - serverseitige Auth-Handler-Factories

Warum diese Trennung:

- Client-Bundles sollen keine Node-/Server-Abhängigkeiten laden.
- Auth-Handler leben serverseitig in `@sva/auth-runtime`.
- Die App soll Routing konsumieren, nicht selbst zusammensetzen.

### 2) Auth-Routen: Shared Paths + getrennte Factories

Path-Single-Source:

- `packages/auth-runtime/src/routes.ts`
- Re-Export über `@sva/routing`

Client-safe Variante:

- erzeugt TanStack-Routen ohne Handler
- dient der vollständigen Route-Registrierung im Client

Server-Variante:

- setzt `server.handlers`
- resolved Handler lazy aus `@sva/auth-runtime/runtime-routes` bzw. `@sva/auth-runtime/runtime-health`

### 3) App Route Bindings (`apps/sva-studio-react/src/routing/app-route-bindings.tsx`)

Die App hält nur noch die Bindung zwischen kanonischen Routen und React-Seiten-Komponenten:

- statische Seiten-Komponenten
- Wrapper für parametrisierte Detailseiten
- Lazy-Loading für größere Admin-Seiten

Die Datei enthält **keine** Pfad- oder Guard-Definitionen.

### 3a) Admin-Ressourcen (`apps/sva-studio-react/src/routing/admin-resources.ts`)

Die App registriert CRUD-artige Admin-Flächen deklarativ über `AdminResourceDefinition`.

- Die Ressource beschreibt `resourceId`, `basePath`, `titleKey`, Guard-Referenz und Seiten-Bindings.
- Hosteigene Admin-Ressourcen wie `content` behalten ihre unqualifizierte `resourceId`; plugin-beigestellte Admin-Ressourcen verwenden dagegen `<pluginId>.<name>`.
- `@sva/routing` leitet daraus die kanonischen Pfade `/admin/<resource>`, `/admin/<resource>/new` und `/admin/<resource>/$id` ab.
- Legacy-Einstiege bleiben nur als explizite Alias-Routen im Host-Routing bestehen; aktuell redirectet `/content*` auf `/admin/content*`.

### 4) Router-Instanz (`apps/sva-studio-react/src/router.tsx`)

Ablauf in `getRouter()`:

1. Die App importiert `appRouteBindings`.
2. Die App erzeugt in `src/lib/plugins.ts` einen Build-time-Registry-Snapshot über `createBuildTimeRegistry(...)`.
3. Der Snapshot enthält normalisierte Plugin-Beiträge, die registrierten Admin-Ressourcen und plugin-spezifische Audit-Event-Definitionen.
4. Server und Client laden isomorph die passende Factory-Menge aus `@sva/routing`.
5. Die App materialisiert diese Factories gegen `rootRoute`.
6. `createRouter({ routeTree, ... })`

Damit bleibt die Route-Komposition zentralisiert, während die App weiterhin die Seiten selbst rendert.

### 5) Root Route (`apps/sva-studio-react/src/routes/__root.tsx`)

- erstellt `createRootRoute(...)`
- definiert Shell, Head, Error- und NotFound-Verhalten
- initialisiert serverseitig benötigte Runtime-Bausteine nur im SSR-Kontext

## Plugin-Routing

Plugins exportieren `PluginDefinition`-Objekte.

- Die Host-App registriert Plugins statisch und verdichtet ihre Build-time-Beiträge in einen kanonischen Registry-Snapshot.
- `@sva/routing` materialisiert die Plugin-Routen zentral.
- Plugin-Guards werden auf die kanonischen Guard-Regeln des Hosts gemappt.
- Plugin-beigestellte registrierte Host-Identifier werden bereits vor der Routing-Materialisierung gegen den Namespace-Vertrag `<pluginId>.<name>` validiert.
- Nicht unterstützte Plugin-Guard-Mappings erzeugen genau ein `routing.plugin.guard_unsupported`-Ereignis bei der Factory-Erstellung. Erfolgreiche Guard-Mappings bleiben still.

## Request/Response Routing für Auth

Auth-Endpunkte werden als TanStack Server Route Handler registriert und delegieren in `@sva/auth-runtime`:

- `/auth/login` -> `loginHandler()`
- `/auth/callback` -> `callbackHandler(request)`
- `/auth/me` -> `meHandler(request)`
- `/auth/logout` -> `logoutHandler(request)`

Die eigentliche Business-Logik verbleibt im Auth-Package; das Routing-Package bleibt ein Integrations-Layer.

## Routing-Observability

`@sva/routing` besitzt einen expliziten, optional injizierten Diagnostics-Hook für routing-relevante Entscheidungen und Anomalien.

- Client-shared Routing-Dateien bleiben frei von Runtime-Imports aus `@sva/server-runtime`.
- Ohne Hook bleibt Browser-Routing standardmäßig still.
- Guard-Denials emittieren `routing.guard.access_denied`.
- Unbekannte Plugin-Guard-Mappings emittieren `routing.plugin.guard_unsupported`.
- `auth.routes.server.ts` bindet serverseitige Ereignisse an den Logger aus `@sva/server-runtime` und harmonisiert Fehler und `405`-Fälle auf:
  - `routing.handler.error_caught`
  - `routing.handler.method_not_allowed`
  - `routing.logger.fallback_activated`

Der Event-Vertrag nutzt nur Safe-Felder. Geloggt werden Template-Pfade statt aufgelöster IDs, keine Token-URLs, keine Stack-Traces und keine erfolgreichen Standardnavigationen.

## Typisierung und Sicherheit

### Type Safety

- Routen werden als Factories mit `RootRoute`-Typen gebaut.
- Pfade und Search-Normalisierung sind zentralisiert.
- `@tanstack/react-router` stellt typed navigation/loader APIs bereit.

### Server/Client Separation

Regeln:

1. Server-Handler nur in `@sva/routing/server` und serverseitigen Auth-Factories verwenden.
2. Keine server-only Imports in client-exponierten Route-Dateien.
3. Lazy imports für Auth-Handler verhindern versehentliche Client-Bundle-Leaks.

## Beziehung zu `routeTree.gen.ts`

`apps/sva-studio-react/src/routeTree.gen.ts` bleibt ein generiertes Integrationsartefakt für TanStack Start.

Wichtig:

- Produktive Seitenrouten werden nicht mehr file-based definiert.
- Das generierte File dient nur noch der TanStack-Start-Integration.
- Die fachliche Routing-Wahrheit liegt in `@sva/routing`.

## Konventionen für neue Routen

### Do

1. Neue Seitenrouten ausschließlich in `@sva/routing` definieren.
2. Server-Handler nur in server-spezifischen Factories oder `createServerFn` kapseln.
3. Shared Pfade als `const` + Typ in zentralen Modulen definieren.
4. Seiten-Komponenten nur über die App-Route-Bindings einspeisen.
5. Plugin-Routen ausschließlich über `PluginDefinition.routes` beschreiben und zentral im Routing-Paket materialisieren.
6. Neue CRUD-artige Admin-Flächen über `AdminResourceDefinition` registrieren statt einzelne Host-Routen ad hoc zu ergänzen.

### Don't

1. Keine server-only Imports in client-safe Routing-Modulen.
2. Keine duplizierten Auth-Path-Strings in App-Code.
3. Keine app-lokale Parallel-Registrierung produktiver Seitenrouten.
4. Keine Demo- oder Sandbox-Routen in das Produkt-Routing mischen.
5. Keine parallelen Legacy-Top-Level-Pfade ohne expliziten Alias-/Redirect-Vertrag im Host-Routing einführen.

## Bekannte Trade-offs

1. File-based Routing bleibt technisch vorhanden, ist aber nicht mehr die fachliche Quelle der Seitenrouten.
2. Seiten-Bindings bleiben absichtlich in der App, damit UI-Komponenten nicht in das Routing-Paket gezogen werden.
3. Strikte Import-Disziplin bleibt entscheidend; sonst drohen Bundling-/Hydration-Probleme.

## Referenzen

- `packages/routing/src/index.ts`
- `packages/routing/src/index.server.ts`
- `packages/routing/src/app.routes.ts`
- `packages/routing/src/route-paths.ts`
- `packages/routing/src/auth.routes.ts`
- `packages/routing/src/auth.routes.server.ts`
- `apps/sva-studio-react/src/router.tsx`
- `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
- `apps/sva-studio-react/src/routes/__root.tsx`
- `apps/sva-studio-react/src/routeTree.gen.ts`
