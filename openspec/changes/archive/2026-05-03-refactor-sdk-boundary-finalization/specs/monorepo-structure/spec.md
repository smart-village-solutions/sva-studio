## MODIFIED Requirements
### Requirement: Plugin-SDK-Boundary

Plugins (Packages mit Tag `scope:plugin` oder Namensschema `@sva/plugin-*`) SHALL Host-Metadaten, Registries, Admin-Ressourcen, Actions, Guard-Metadaten und Plugin-i18n ausschliesslich ueber `@sva/plugin-sdk` konsumieren. Gemeinsame React-UI fuer Custom-Views SHALL ueber `@sva/studio-ui-react` konsumiert werden. Direkte Imports aus `@sva/core`, alten Sammelpackages, fachlichen Zielpackages oder App-internen Modulen sind fuer Plugins nicht zulaessig.

#### Scenario: Plugin importiert Host-Metadaten aus Plugin SDK

- **WHEN** ein Plugin eine Funktion oder einen Typ fuer Host-Registrierung, Actions, i18n, Admin-Ressourcen oder Routing-Metadaten benoetigt
- **THEN** importiert es ausschliesslich aus `@sva/plugin-sdk` oder dessen Sub-Exports
- **AND** interne Implementierungsdetails von `@sva/core` werden nicht exponiert

#### Scenario: Plugin importiert gemeinsame UI aus Studio UI

- **WHEN** ein Plugin eine Custom-View mit Studio-Layout, Formularen, Tabellen, Aktionen oder Zustaenden rendert
- **THEN** importiert es diese Bausteine aus `@sva/studio-ui-react`
- **AND** es importiert keine Komponenten aus `apps/sva-studio-react/src/**`

#### Scenario: Direktimport aus Core wird durch Lint verhindert

- **WHEN** ein Plugin-Entwickler versucht, direkt aus `@sva/core` zu importieren
- **THEN** schlaegt die ESLint-Boundary-Pruefung fehl
- **AND** eine aussagekraeftige Fehlermeldung verweist auf `@sva/plugin-sdk` als korrekte Metadaten-Schnittstelle

#### Scenario: Direktimport aus App-UI wird durch Lint verhindert

- **WHEN** ein Plugin-Entwickler versucht, direkt aus App-internen UI-Pfaden zu importieren
- **THEN** schlaegt die ESLint-Boundary-Pruefung fehl
- **AND** eine aussagekraeftige Fehlermeldung verweist auf `@sva/studio-ui-react` als korrekte UI-Schnittstelle

#### Scenario: Plugin verwendet keinen neuen SDK-Altpfad

- **WHEN** ein Plugin nach dem Hard-Cut neu erstellt oder erweitert wird
- **THEN** fuehrt es keine neuen Importe aus `@sva/sdk` oder `@sva/sdk/*` ein
- **AND** bestehende Altpfade gelten hoechstens als befristete Migrationsabweichung

## ADDED Requirements
### Requirement: SDK-Compatibility-Layer bleibt begrenzt und deprectated

Das System SHALL `@sva/sdk` nur noch als deprecated Compatibility-Layer fuer dokumentierte Altpfade fuehren. `@sva/sdk` SHALL kein Zielpackage fuer neue Plugin-, Routing-, IAM-, Daten- oder Server-Runtime-Vertraege sein.

#### Scenario: Neuer Plugin- oder Runtime-Vertrag entsteht

- **WHEN** ein neuer oeffentlicher Vertrag fuer Plugins, Host-Erweiterungen oder Server-Runtime-Helfer benoetigt wird
- **THEN** wird er im fachlich passenden Zielpackage modelliert
- **AND** nicht in `@sva/sdk`

#### Scenario: Bestehender SDK-Re-Export bleibt temporaer bestehen

- **WHEN** ein Altpfad in `@sva/sdk` aus Kompatibilitaetsgruenden voruebergehend erhalten bleibt
- **THEN** ist dieser Pfad als Compatibility-Layer dokumentiert
- **AND** die Dokumentation benennt das kanonische Zielpackage fuer neue Consumer

#### Scenario: Zielpackage verwendet keinen neuen SDK-Import

- **WHEN** ein Zielpackage wie `@sva/routing`, `@sva/iam-*`, `@sva/instance-registry` oder `@sva/server-runtime` neue Importe hinzufuegt
- **THEN** nutzt es nicht `@sva/sdk` als regulare Abhaengigkeit
- **AND** waehlt stattdessen den direkten Zielvertrag
