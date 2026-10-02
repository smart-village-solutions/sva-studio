# @sva/plugin-sdk

Typsicheres SDK für SVA-Plugins. Das Package bündelt die öffentlichen Verträge, Validierungsregeln und Hilfsfunktionen, mit denen Plugins Routen, Navigation, Berechtigungen, Content-Typen, Admin-Ressourcen, Übersetzungen und Host-Integrationen konsistent an den Haupt-Workspace anbinden.

## Architektur-Rolle

`@sva/plugin-sdk` bildet die Vertragsgrenze zwischen Host-Anwendung und Plugin-Code. Das Package hält die Kernlogik framework-agnostisch und stellt ausschließlich typisierte Definitionen, Registries und Factory-Funktionen bereit.

Im Zentrum stehen drei Aufgaben:

- Plugin-Beiträge normieren und validieren, etwa für Action-IDs, Namespaces, Content-Typen und Admin-Ressourcen.
- Mehrere Plugin-Beiträge zu Build-Zeit in registrierbare Strukturen zusammenführen.
- Wiederverwendbare Integrationsbausteine für Standard-Content-Plugins, Übersetzungen, Media-Picker und Mainserver-CRUD bereitstellen.

## Öffentliche API

Die öffentliche API wird über [`src/index.ts`](./src/index.ts) und [`src/public-api.ts`](./src/public-api.ts) exportiert. Wichtige Bereiche sind:

- Plugin-Verträge und Registries: `PluginDefinition`, `definePluginActions`, `definePluginPermissions`, `definePluginModuleIamContract`, `createPluginRegistry`, `createPluginActionRegistry`, `createPluginPermissionRegistry`
- Build-Zeit-Aggregation: `createBuildTimeRegistry` zur Zusammenführung von Plugins, Admin-Ressourcen, Navigation, Content-Typen, Audit-Events und IAM-Metadaten
- Admin-Ressourcen: `AdminResourceDefinition`, `definePluginAdminResources`, `createAdminResourceRegistry`, `mergeAdminResourceDefinitions`
- Content-Typen: `ContentTypeDefinition`, `definePluginContentTypes`, `createContentTypeRegistry`, `genericContentTypeDefinition`
- Standard-Content-Konventionen: `createStandardContentPluginContribution` sowie Factory-Funktionen für Actions, Permissions, Rollen, IAM-Contract, Content-Type und Admin-Resource
- Host-Integration: `createMainserverCrudClient`, `requestMainserverJson`, `defineMediaPickerDefinition`, `listHostMediaAssets`, `replaceHostMediaReferences`
- I18n und Guardrails: `registerPluginTranslationResolver`, `translatePluginKey`, `usePluginTranslation`, `assertPluginContributionAllowedKeys`, `assertPluginRoutePathAllowed`

Zusätzlich exportiert das Package den Subpath `@sva/plugin-sdk/admin-resources` für Admin-Resource-Typen und -Hilfsfunktionen.

## Nutzung und Integration

Typische Nutzung ist die Definition eines Plugin-Moduls über klar abgegrenzte Beiträge wie Routen, Navigation, Actions, Permissions, Content-Typen und Admin-Ressourcen. Für Standardfälle im Content-Umfeld kann `createStandardContentPluginContribution(...)` mehrere dieser Beiträge in einem Schritt erzeugen.

Für die Host-Integration werden Plugin-Beiträge anschließend über `createBuildTimeRegistry(...)` in registrierbare Maps und Listen überführt. Das ist die zentrale Stelle, an der das Package Konsistenzprüfungen zwischen Plugins und ergänzenden Admin-Ressourcen ausführt, zum Beispiel auf bekannte Content-Typen.

Das Package ist als ESM-Library gebaut und deklariert Laufzeitabhängigkeiten auf `@sva/core` und `@sva/media`. Für serverseitige Nutzung bleiben die Runtime-Imports im Package explizit auf `.js` ausgerichtet.

## Projektstruktur

```text
packages/plugin-sdk/
|-- src/
|   |-- index.ts
|   |-- public-api.ts
|   |-- plugins.ts
|   |-- plugin-definition-types.ts
|   |-- plugin-definition-validation.ts
|   |-- plugin-registry-*.ts
|   |-- plugin-operations.ts
|   |-- plugin-job-types.ts
|   |-- plugin-profile-definitions.ts
|   |-- plugin-platform/
|   |   |-- access-requirements.ts
|   |   |-- plugin-actions.ts
|   |   |-- catalog-issues.ts
|   |   `-- version-range.ts
|   |-- build-time-registry.ts
|   |-- admin-resources.ts
|   |-- admin-resource-*.ts
|   |-- content-types.ts
|   |-- standard-content-plugin.ts
|   |-- mainserver-client.ts
|   |-- media-picker.ts
|   |-- media-picker-client.ts
|   |-- plugin-translations.ts
|   |-- guardrails.ts
|   `-- *.test.ts
|-- tests/
|   `-- *.test.ts
|-- package.json
|-- project.json
|-- tsconfig.json
|-- tsconfig.lib.json
`-- vitest.config.ts
```

Orientierung innerhalb von `src/`:

- [`plugins.ts`](./src/plugins.ts): Plugin-Registry-Komposition und bisherige öffentliche SDK-Exporte; Definitionen, Validierung und Registry-Aggregation liegen in den benachbarten `plugin-*`-Modulen
- [`plugin-platform/`](./src/plugin-platform/): interne, frameworkfreie Vergleichs- und Validierungsphasen für Access-Anforderungen und Action-Registries; diese Module sind keine öffentlichen Package-Subpaths
- [`build-time-registry.ts`](./src/build-time-registry.ts): Aggregation aller Plugin-Beiträge für die Build-Zeit
- [`admin-resources.ts`](./src/admin-resources.ts): Admin-Resource-Registry und bisherige öffentliche Exporte; Verträge und Validierung liegen in `admin-resource-*`-Modulen
- [`plugin-operations.ts`](./src/plugin-operations.ts): Operations-Registries und bisherige öffentliche Exporte; Job- und Profildefinitionen liegen in eigenen Modulen
- [`plugin-platform-resolution.ts`](./src/plugin-platform-resolution.ts): Katalogauflösung; Versionsvergleich und Issue-Verträge liegen unter `plugin-platform/`
- [`content-types.ts`](./src/content-types.ts): Content-Type-Verträge und Validierung
- [`standard-content-plugin.ts`](./src/standard-content-plugin.ts): Opinionated Factory-Funktionen für Standard-Content-Plugins
- [`mainserver-client.ts`](./src/mainserver-client.ts), [`media-picker*.ts`](./src/media-picker.ts), [`plugin-translations.ts`](./src/plugin-translations.ts): Integrationshilfen zum Host-System

Tests können sowohl colocated unter `src/**/*.test.ts` als auch als paketweite Szenarien unter `tests/**/*.test.ts` liegen.

## Nx-Konfiguration

Die Nx-Projektdefinition liegt in [`project.json`](./project.json). Das Package ist als `library` mit `sourceRoot` `packages/plugin-sdk/src` registriert und trägt die Tags `scope:plugin-sdk` und `type:lib`.

Verfügbare Targets:

- `build`: TypeScript-Build über `tsc -p packages/plugin-sdk/tsconfig.lib.json`
- `check:runtime`: Server-Runtime-Prüfung über `scripts/ci/check-server-package-runtime.ts --package plugin-sdk`
- `lint`: ESLint auf den Quellcode unter `src/`
- `test:unit`: Vitest-Unit-Tests im Paketverzeichnis
- `test:types`: Type-Check ohne Emit
- `test:coverage`: Vitest mit Coverage

## Verwandte Dokumentation

- [`package.json`](./package.json): Export-Pfade, ESM-Metadaten und Workspace-Abhängigkeiten
- [`project.json`](./project.json): Nx-Targets und Projekttags
- [`tsconfig.lib.json`](./tsconfig.lib.json): Build- und Typkonfiguration der Bibliothek
- [`src/public-api.ts`](./src/public-api.ts): kanonische Übersicht der öffentlichen Exports
