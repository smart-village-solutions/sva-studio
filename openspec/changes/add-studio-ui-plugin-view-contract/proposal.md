# Change: Gemeinsames Studio-UI-React-Package für Host und Plugin-Custom-Views einführen

## Why

Das Studio wird kurzfristig mehrere Plugins mit eigenen Views erhalten. Ohne gemeinsame öffentliche UI-Basis entstehen schnell parallele Button-, Formular-, Tabellen- und Detailseitenmuster in Plugins, obwohl Shell, Admin-Ressourcen und Design-System konsistent bleiben müssen.

## What Changes

- Einführung von `@sva/studio-ui-react` als React-basiertes Zielpackage für gemeinsame Studio-UI-Komponenten.
- Der Package-Name macht die bewusste React/shadcn-Bindung sichtbar und hält den neutraleren Namen `@sva/studio-ui` für einen möglichen späteren framework-unabhängigen UI-Vertrag frei.
- Definition von `@sva/studio-ui-react` als erlaubte UI-Boundary für Host-Seiten und Plugin-Custom-Views.
- Klarstellung: `@sva/plugin-sdk` bleibt Vertrag für Plugin-Metadaten, Registries, Admin-Ressourcen, Actions und i18n; `@sva/studio-ui-react` enthält keine Plugin-Registry- oder Host-Metadatenlogik.
- Standardfall bleibt host-rendered Admin-UI aus `AdminResourceDefinition`; Plugin-Custom-Views sind erlaubt, müssen aber `@sva/studio-ui-react` nutzen.
- Migration app-interner shadcn/ui- und Studio-Komponenten in ein wiederverwendbares Package mit stabilen Exports.
- Einführung von Boundary-Regeln, die Plugin-Imports aus `apps/sva-studio-react/src/components/**` und lokale Basis-Control-Duplikate verhindern.
- Dokumentation einheitlicher Übersichts-, Detail-, Formular- und State-Muster für Core- und Plugin-UI.

## Impact

- Affected specs:
  - `account-ui`
  - `monorepo-structure`
  - `architecture-documentation`
  - `routing`
- Affected code:
  - `packages/studio-ui-react`
  - `packages/plugin-sdk`
  - `packages/plugin-news`
  - `apps/sva-studio-react/src/components`
  - `apps/sva-studio-react/src/routes`
  - `nx.json`, ESLint-/Boundary-Konfiguration, TypeScript-Path-Mappings
- Affected docs:
  - `docs/development/studio-uebersichts-und-detailseiten-standard.md`
  - `docs/development/studio-list-page-standard.md`
  - `docs/architecture/package-zielarchitektur.md`
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
- Affected arc42 sections:
  - `04-solution-strategy`
  - `05-building-block-view`
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`
  - `11-risks-and-technical-debt`

## Compatibility

Dieser Change erweitert die bestehende Plugin-Boundary, ersetzt sie aber nicht. Plugins konsumieren Host-Metadaten weiterhin über `@sva/plugin-sdk`. `@sva/studio-ui-react` ist ausschließlich für React/UI-Bausteine zuständig und darf keine fachlichen Core-Verträge oder Registry-Verantwortung übernehmen.
