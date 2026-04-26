## ADDED Requirements

### Requirement: Studio UI React Target Package
The system SHALL provide `@sva/studio-ui-react` as a dedicated Workspace package for reusable Studio React UI.

#### Scenario: Studio UI React package exists
- **WHEN** the workspace projects are listed
- **THEN** `packages/studio-ui-react` exists as an Nx library
- **AND** it exposes the import path `@sva/studio-ui-react`
- **AND** it has build, unit-test, type-test, and lint targets consistent with workspace conventions

#### Scenario: Studio UI React package remains UI-only
- **WHEN** `@sva/studio-ui-react` source imports are checked
- **THEN** it has no runtime imports from server runtime, data repositories, IAM implementation packages, or app-internal modules
- **AND** it does not contain domain persistence, route materialization, guard evaluation, or plugin registry logic

### Requirement: Plugin UI Dependency Boundary
Plugins SHALL consume host metadata through `@sva/plugin-sdk` and shared Studio React UI through `@sva/studio-ui-react`.

#### Scenario: Plugin declares allowed workspace dependencies
- **WHEN** a plugin package with name `@sva/plugin-*` provides custom views
- **THEN** its `package.json` may declare `@sva/plugin-sdk` and `@sva/studio-ui-react` as Workspace dependencies
- **AND** it does not declare app-internal modules or deprecated aggregate packages as dependencies

#### Scenario: Plugin imports app internal UI
- **WHEN** a plugin imports from `apps/sva-studio-react/src/**`
- **THEN** the boundary check fails
- **AND** the violation explains that shared UI must be imported from `@sva/studio-ui-react`

#### Scenario: Plugin defines duplicate reusable basis control
- **WHEN** a plugin defines reusable controls that duplicate available Studio UI controls such as Button, Input, Select, Tabs, Dialog, Alert, Badge, Table, or DataTable
- **THEN** lint, CI, or review checks reject the duplicate basis control
- **AND** the plugin may instead define domain-specific wrappers that compose `@sva/studio-ui-react`

## MODIFIED Requirements

### Requirement: Publishable Packages and Plugins

Das System SHALL Packages als eigenstaendige npm-Module organisieren, inklusive klarer Namenskonventionen fuer Core, UI und Plugins. Plugins SHALL dabei Host-Metadaten ausschliesslich ueber `@sva/plugin-sdk` konsumieren und gemeinsame React-UI ausschliesslich ueber `@sva/studio-ui-react` nutzen. Direkte Abhaengigkeiten auf `@sva/core`, alte Sammelpackages oder App-interne Module sind fuer Plugins nicht zulaessig. Ein Beispiel-Plugin ist dafuer keine verpflichtende Workspace-Komponente.

#### Scenario: Package-Namensschema
- **WHEN** ein neues Paket erstellt wird
- **THEN** verwendet es ein Scope wie `@sva/*`
- **AND** Plugins verwenden `@sva/plugin-*`
- **AND** die gemeinsame Studio-UI verwendet den Importpfad `@sva/studio-ui-react`

#### Scenario: Plugin-Dependency-Regel
- **WHEN** ein Plugin-Package erstellt oder aktualisiert wird
- **THEN** listet seine `package.json` fuer Host-Metadaten `@sva/plugin-sdk`
- **AND** listet seine `package.json` fuer Plugin-Custom-Views optional `@sva/studio-ui-react`
- **AND** direkte Abhaengigkeiten auf `@sva/core`, alte Sammelpackages oder App-interne Module sind nicht vorhanden

#### Scenario: Kein Beispiel-Plugin als Workspace-Pflicht
- **WHEN** der Workspace produktiv konfiguriert wird
- **THEN** ist kein `plugin-example`-Package als verpflichtender Bestandteil vorausgesetzt
- **AND** das Monorepo kann produktive Plugins ohne ein mitgefuehrtes Referenz-Plugin betreiben

### Requirement: Plugin-SDK-Boundary
Plugins (Packages mit Tag `scope:plugin` oder Namensschema `@sva/plugin-*`) SHALL Host-Metadaten, Registries, Admin-Ressourcen, Actions, Guard-Metadaten und Plugin-i18n ausschliesslich ueber `@sva/plugin-sdk` konsumieren. Gemeinsame React-UI fuer Custom-Views SHALL ueber `@sva/studio-ui-react` konsumiert werden. Direkte Imports aus `@sva/core`, alten Sammelpackages, fachlichen Zielpackages oder App-internen Modulen sind fuer Plugins nicht zulaessig.

#### Scenario: Plugin importiert Host-Metadaten aus Plugin SDK
- **WHEN** ein Plugin eine Funktion oder einen Typ fuer Host-Registrierung, Actions, i18n, Admin-Ressourcen oder Routing-Metadaten benötigt
- **THEN** importiert es ausschliesslich aus `@sva/plugin-sdk` oder dessen Sub-Exports
- **AND** interne Implementierungsdetails von `@sva/core` werden nicht exponiert

#### Scenario: Plugin importiert gemeinsame UI aus Studio UI
- **WHEN** ein Plugin eine Custom-View mit Studio-Layout, Formularen, Tabellen, Aktionen oder Zuständen rendert
- **THEN** importiert es diese Bausteine aus `@sva/studio-ui-react`
- **AND** es importiert keine Komponenten aus `apps/sva-studio-react/src/**`

#### Scenario: Direktimport aus Core wird durch Lint verhindert
- **WHEN** ein Plugin-Entwickler versucht, direkt aus `@sva/core` zu importieren
- **THEN** schlägt die ESLint-Boundary-Prüfung fehl
- **AND** eine aussagekräftige Fehlermeldung verweist auf `@sva/plugin-sdk` als korrekte Metadaten-Schnittstelle

#### Scenario: Direktimport aus App-UI wird durch Lint verhindert
- **WHEN** ein Plugin-Entwickler versucht, direkt aus App-internen UI-Pfaden zu importieren
- **THEN** schlägt die ESLint-Boundary-Prüfung fehl
- **AND** eine aussagekräftige Fehlermeldung verweist auf `@sva/studio-ui-react` als korrekte UI-Schnittstelle
