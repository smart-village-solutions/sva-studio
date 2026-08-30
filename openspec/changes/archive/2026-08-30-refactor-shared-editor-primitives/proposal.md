# Change: Gemeinsame Content-Editor-Lifecycles konsolidieren

## Why

Der ursprüngliche Change wurde im Juni 2026 aus dem damaligen POI-/News-Stand
abgeleitet. Seitdem sind zentrale Bausteine wie `StudioDetailCard`,
`StudioPagination`, `StudioDetailTabs`, die Formular-Bridge, Save-Feedback und
der Media-Picker bereits in `@sva/studio-ui-react` angekommen. Die alte
Aufgabenliste bildet diesen Stand nicht mehr ab und würde teilweise bereits
gelieferte Primitives erneut planen.

Die verbleibende technische Schuld liegt heute in den Abläufen um diese
Primitives: Pagination-Normalisierung, Map-/Geocoding-Lifecycle,
Media-Picker-Konfiguration sowie Media-Save-, Referenz-Sync- und Retry-Zustände
sind in mehreren Content-Plugins weitgehend parallel implementiert. Dadurch
müssen technische Änderungen an bis zu sechs Stellen nachvollzogen und
getestet werden, während große Editor-Komponenten weiterhin UI, I/O und
Fehlerzustände gleichzeitig orchestrieren.

Der Change wird deshalb auf nachgewiesene Mehrfachimplementierungen
reconciliert. Sein Erfolg bemisst sich ausdrücklich an entferntem Altcode und
kleinerer Ownership-Fläche, nicht an der Anzahl neuer Abstraktionen.

## What Changes

- reconciliiert bereits gelieferte gemeinsame Editor-Primitives, statt sie neu
  zu implementieren
- konsolidiert die identische Pagination-Normalisierung aus Events, Generic
  Items, POI und Projects in einem frameworkfreien Clientvertrag und entfernt
  die ungenutzte identische News-Kopie
- konsolidiert den gemeinsamen Map-/Geocoding-Client und React-Lifecycle aus
  Events, Generic Items und POI, ohne Provider-, Secret- oder Hostlogik in die
  Plugins zu verschieben
- zentralisiert die gemeinsame Media-Picker-Label- und Feedback-Abbildung für
  Events, Generic Items, News und POI
- extrahiert die gemeinsame UI-Orchestrierung für Media-Save,
  Referenz-Synchronisation und Reference-Retry und migriert Events, Generic
  Items, News, POI, Projects und Cockpit Cards auf diesen Vertrag
- erlaubt dafür die schmale, einseitige Vertragsabhängigkeit
  `@sva/studio-ui-react` → `@sva/plugin-sdk/content-media`, ohne Host-I/O oder
  fachliche Persistenz in das UI-Package zu verschieben
- entfernt die jeweils ersetzten pluginlokalen Helper, Hooks, Zustände und
  Inline-Abläufe im selben Migrationsblock
- trennt große Editor-Seiten in gemeinsame technische Controller und
  pluginlokale fachliche Darstellung, ohne Payloads oder Fachmodelle zu
  vereinheitlichen
- ergänzt Characterization-, Contract- und Regressionstests für die
  gemeinsamen Zustandsübergänge und die migrierten Consumer

## Debt-Reduction Contract

- Jede neue gemeinsame Implementierung benötigt mindestens zwei produktive
  Consumer im selben Change.
- Eine Migration gilt erst als abgeschlossen, wenn der ersetzte lokale Code
  gelöscht ist. Dauerhafte Weiterleitungswrapper und parallele Altpfade sind
  unzulässig.
- Über den produktiven Zielscope aus `@sva/plugin-sdk`,
  `@sva/studio-ui-react` und den sechs betroffenen Plugins darf der Change
  netto keine TypeScript-/TSX-Zeilen hinzufügen. Test- und Dokumentationscode
  wird separat ausgewiesen.
- Die benannten Fallow-Clone-Familien müssen im Zielscope verschwinden; eine
  bloße Verschiebung in neue Dateien erfüllt den Change nicht.
- Gemeinsame APIs bleiben so klein, dass alle Varianten durch reale Consumer
  belegt sind. Konfiguration für hypothetische spätere Plugins ist außerhalb
  des Scopes.

## Out of Scope

- keine neue fachliche Funktion für News, Events, Generic Items, POI, Projects
  oder Cockpit Cards
- keine Vereinheitlichung von Plugin-Payloads, Zod-Schemas,
  Mainserver-Mappings, Permissions, Navigation oder fachlichen Fehlertexten
- kein generisches Editor-Framework, Schema-Renderer oder konfigurierbarer
  Form-Builder
- keine Änderung an Asset-, `MediaReference`-, Upload-, Storage-, Queue-,
  Worker- oder Retry-Infrastruktur des Medienmanagements
- keine Vorwegnahme von `add-media-async-processing` oder
  `extend-media-management-governance`
- keine repo-weite Formularmigration aus
  `add-studio-data-form-and-test-foundations`
- kein Redesign der Editoren und keine Änderung ihrer Accessibility-, i18n-
  oder Save-Semantik

## Impact

- Affected specs: `ui-layout-shell`, `content-management`, `monorepo-structure`
- Affected code:
  - `packages/plugin-sdk/src/**`
  - `packages/plugin-sdk/package.json`
  - `packages/studio-ui-react/src/**`
  - `packages/studio-ui-react/package.json`
  - `packages/plugin-events/src/**`
  - `packages/plugin-generic-items/src/**`
  - `packages/plugin-news/src/**`
  - `packages/plugin-poi/src/**`
  - `packages/plugin-projects/src/**`
  - `packages/plugin-cockpit-cards/src/**`
  - `eslint.config.mjs`
- Affected arc42 sections: `05-building-block-view`,
  `08-cross-cutting-concepts`, `09-architecture-decisions`,
  `10-quality-requirements`, `11-risks-and-technical-debt`
- Required documentation updates:
  - `docs/development/studio-form-migrationsinventur.md`
  - relevante Editor-/Plugin-Dokumentation unter `docs/`
- Required tests:
  - Unit-Tests für frameworkfreie Verträge in `plugin-sdk`
  - React-Unit-Tests für gemeinsame Controller und Primitives in
    `studio-ui-react`
  - angepasste Consumer-Tests in allen sechs migrierten Plugins
  - betroffene Type-, Lint- und Architektur-Boundary-Gates

## Success Criteria

- vier reale Pagination-Consumer verwenden genau einen gemeinsamen Vertrag;
  alle fünf pluginlokalen `list-pagination.ts`-Implementierungen einschließlich
  der ungenutzten News-Kopie sind gelöscht
- Events, Generic Items und POI besitzen keinen parallelen
  Map-/Geocoding-Client-Cache und keinen duplizierten Map-Lifecycle mehr
- Events, Generic Items, News und POI erzeugen gemeinsame Media-Picker-Labels
  und technisches Feedback nicht mehr lokal
- Events, Generic Items, News, POI, Projects und Cockpit Cards verwenden den
  gemeinsamen Media-Save-/Reference-Retry-Controller; die ersetzten lokalen
  Zustands- und Retry-Blöcke sind entfernt
- Inhaltsspeicherung, partielle Referenzfehler, Reference-Retry,
  Create-Navigation und pluginlokale Fehlermeldungen verhalten sich unverändert
- der produktive Zielscope wächst netto nicht und die dokumentierte
  Löschbilanz weist entfernte Dateien, Exporte, Funktionen und Zeilen aus
- Fallow meldet die erfassten Clone-Familien im Zielscope nicht mehr und führt
  keine neue gleichwertige Duplikation ein
