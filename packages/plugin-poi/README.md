# @sva/plugin-poi

`@sva/plugin-poi` ist ein Studio-Plugin für die Pflege von Points of Interest (POI) im Mainserver. Das Paket bündelt Plugin-Definition, CRUD-Anbindung, Formularvalidierung und React-Seiten für Listen-, Erstell- und Bearbeitungsansichten.

## Architektur-Rolle

Das Paket ist eine fachliche Plugin-Bibliothek im Scope `scope:plugin`. Es hängt auf `@sva/plugin-sdk` für den standardisierten Plugin-Vertrag, Berechtigungen, Admin-Ressourcen und Host-Media-Integration sowie auf `@sva/studio-ui-react` für die Studio-Oberflächen auf.

Innerhalb der Architektur übernimmt `@sva/plugin-poi` die POI-spezifische Ausprägung eines Standard-Content-Plugins:

- Plugin-ID und Content-Type sind auf `poi` beziehungsweise `poi.point-of-interest` festgelegt.
- Navigation, Actions, Permissions und Admin-Resource-Bindings werden über den gemeinsamen Standard-Content-Mechanismus erzeugt.
- Die Datenanbindung erfolgt gegen den Mainserver-Endpunkt `/api/v1/mainserver/poi`.
- Medienreferenzen für Teaserbilder werden zusätzlich über die Host-Media-Schnittstellen verwaltet.

## Öffentliche API

Das Paket exportiert über [`src/index.ts`](./src/index.ts) genau diese öffentlichen Bausteine:

- `POI_CONTENT_TYPE`: Kanonischer Content-Type `poi.point-of-interest`.
- `PoiListPage`: React-Seite für die paginierte Listenansicht im Admin-Bereich.
- `PoiCreatePage`: React-Seite zum Anlegen neuer POI.
- `PoiEditPage`: React-Seite zum Bearbeiten bestehender POI.
- `pluginPoi`: Vollständige `PluginDefinition` zur Registrierung im Host.

Nicht über den Paketeinstieg exportiert sind die API-Helfer, Formulartypen und Validierungsfunktionen; sie sind interne Implementierungsdetails des Plugins.

## Nutzung und Integration

Die Integration erfolgt über die Registrierung von `pluginPoi` im Plugin-Host. Das Plugin bringt dabei bereits die standardisierten Beiträge für Navigation, Actions, Permissions, IAM-Metadaten, Admin-Ressourcen und Übersetzungen mit.

Für den Betrieb sind insbesondere diese Rahmenbedingungen relevant:

- React und `@tanstack/react-router` werden als Peer Dependencies vom Host bereitgestellt.
- Die Listen- und Detailflüsse erwarten den Mainserver-CRUD-Endpunkt unter `/api/v1/mainserver/poi`.
- Für die Medienauswahl nutzt das Plugin Host-Media-Assets und schreibt Referenzen mit dem Role-Key `teaser_image`.
- Die Bearbeitungsseiten sind auf Admin-Routen im Muster `/admin/poi`, `/admin/poi/new` und `/admin/poi/$id` ausgelegt.
- Die Formularvalidierung erzwingt mindestens einen Namen, akzeptiert nur `https://`-Web-URLs und begrenzt `categoryName` auf 128 Zeichen.

## Projektstruktur

```text
packages/plugin-poi/
├── src/
│   ├── index.ts              # Öffentliche Exporte
│   ├── plugin.tsx            # Plugin-Definition, Actions, Permissions, Übersetzungen
│   ├── poi.pages.tsx         # Listen- und Editor-Seiten
│   ├── poi.api.ts            # CRUD-Client für den Mainserver
│   ├── poi.validation.ts     # Formularvalidierung
│   ├── poi.types.ts          # Fachliche Datentypen für POI
│   └── poi.constants.ts      # Content-Type-Konstante
├── tests/
│   ├── plugin.test.ts        # Vertrag des Plugin-Beitrags
│   ├── poi.api.test.ts       # CRUD-Client-Verhalten
│   ├── poi.pages.test.tsx    # UI- und Media-Integrationsflüsse
│   └── poi.validation.test.ts
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
└── vitest.config.ts
```

## Nx-Konfiguration

Die Nx-Definition steht in [`project.json`](./project.json) und beschreibt `plugin-poi` als Library mit den Tags `scope:plugin` und `type:lib`.

Konfigurierte Targets:

- `build`: kompiliert das Paket mit `tsc -p packages/plugin-poi/tsconfig.lib.json`.
- `lint`: prüft Quellcode und Tests via `@nx/eslint:lint`.
- `test:unit`: führt die Vitest-Unit-Tests im Paketkontext aus.
- `test:coverage`: startet die Tests mit V8-Coverage.
- `test:integration`: ist derzeit ein Platzhalter und meldet explizit, dass keine Integrationstests konfiguriert sind.

Die lokale Testkonfiguration in [`vitest.config.ts`](./vitest.config.ts) verwendet `jsdom` und Alias-Auflösungen auf Workspace-Quellpakete, damit die Paket-Tests ohne gebaute Artefakte laufen.

## Verwandte Dokumentation

- [`package.json`](./package.json): Paketname, Exportfläche sowie Runtime- und Peer-Abhängigkeiten.
- [`project.json`](./project.json): Nx-Targets und Projekt-Metadaten.
- [`src/plugin.tsx`](./src/plugin.tsx): maßgebliche Quelle für Plugin-Vertrag, Übersetzungen und Media-Picker.
- [`src/poi.pages.tsx`](./src/poi.pages.tsx): Referenz für Admin-Routen, Formularfluss und Host-Integration.
- [`tests/`](./tests): lebende Dokumentation für Vertrags-, API- und UI-Verhalten.
