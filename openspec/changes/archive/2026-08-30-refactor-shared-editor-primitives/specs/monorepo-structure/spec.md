## MODIFIED Requirements

### Requirement: Studio UI React Target Package

Das System SHALL `@sva/studio-ui-react` als eigenständiges Workspace-Package
für wiederverwendbare Studio-React-UI bereitstellen. Das Package MAY für
gemeinsame React-Controller schmale öffentliche Vertragstypen aus
`@sva/plugin-sdk` konsumieren, ohne Host-I/O oder Persistenzverantwortung zu
übernehmen.

#### Scenario: Studio-UI-React-Package existiert

- **WHEN** die Workspace-Projekte aufgelistet werden
- **THEN** existiert `packages/studio-ui-react` als Nx-Library
- **AND** exponiert es den Importpfad `@sva/studio-ui-react`
- **AND** besitzt es Build-, Unit-Test-, Type-Test- und Lint-Targets gemäß den
  Workspace-Konventionen

#### Scenario: Studio UI bleibt auf UI-Verantwortung begrenzt

- **WHEN** die Source-Imports von `@sva/studio-ui-react` geprüft werden
- **THEN** besitzt das Package keine Runtime-Imports aus Server-Runtime,
  Data-Repositories, IAM-Implementierungspackages oder App-internen Modulen
- **AND** enthält es keine Domänenpersistenz, Routenmaterialisierung,
  Guard-Auswertung oder Plugin-Registry-Logik

#### Scenario: React-Controller verwendet einen schmalen SDK-Vertrag

- **GIVEN** ein gemeinsamer React-Controller verarbeitet den technischen
  Content-Media-Save- oder Reference-Sync-Zustand mehrerer Plugins
- **WHEN** `@sva/studio-ui-react` dafür einen Vertrag aus `@sva/plugin-sdk`
  benötigt
- **THEN** importiert es diesen ausschließlich über den öffentlichen Subpath
  `@sva/plugin-sdk/content-media`
- **AND** bleibt die Abhängigkeit einseitig von `studio-ui-react` zu
  `plugin-sdk`
- **AND** werden Persistenzoperationen als Callbacks injiziert, statt Host-I/O
  im UI-Package auszuführen
- **AND** erhält `plugin-sdk` keine React- oder `studio-ui-react`-Abhängigkeit
