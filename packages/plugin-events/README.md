# @sva/plugin-events

Plugin-Bibliothek für die Verwaltung von Veranstaltungsinhalten im Admin-Bereich von SVA Studio. Das Paket bündelt die Plugin-Definition, die CRUD-Anbindung an den Mainserver, die React-Seiten für Liste und Bearbeitung sowie die zugehörige Formularvalidierung für den Content-Typ `events.event-record`.

## Architektur-Rolle

`@sva/plugin-events` ist ein fachliches Admin-Plugin im Scope `plugin`. Es registriert über `src/plugin.tsx` einen Standard-Content-Beitrag für `events`, liefert Navigations-, Action- und Berechtigungsdefinitionen aus dem Plugin-SDK und kapselt die UI-Integration für Event-Datensätze.

Die Bibliothek sitzt an der Grenze zwischen Host-Framework und Fachobjekt:

- `src/plugin.tsx` beschreibt die Plugin-Metadaten, Übersetzungen, Audit-Events und Media-Picker-Rollen.
- `src/events.api.ts` kapselt den Zugriff auf die Mainserver-Endpunkte `/api/v1/mainserver/events` und `/api/v1/mainserver/poi`.
- `src/events.pages.tsx` implementiert die Admin-Oberflächen für Listen-, Anlegen- und Bearbeiten-Flows mit Komponenten aus `@sva/studio-ui-react`.
- `src/events.validation.ts` hält die lokale Vorvalidierung des Formulars schlank und framework-unabhängig.

## Öffentliche API

Das Paket exportiert aktuell ausschließlich die zentralen Einstiegspunkte aus `src/index.ts`:

- `EVENTS_CONTENT_TYPE`: Konstante `events.event-record` für die Content-Type-Zuordnung.
- `EventsListPage`: Übersichtsseite mit Paginierung, Tabellenansicht und Link zum Bearbeiten.
- `EventsCreatePage`: Formularseite zum Anlegen neuer Events.
- `EventsEditPage`: Formularseite zum Laden, Aktualisieren und Löschen bestehender Events.
- `pluginEvents`: Vollständige `PluginDefinition` für die Registrierung im Host.

Nicht über `index.ts` exportiert, aber intern relevant, sind:

- `events.api.ts`: `listEvents`, `getEvent`, `createEvent`, `updateEvent`, `deleteEvent` und `listPoiForEventSelection`.
- `events.types.ts`: Typen für Event-Daten, Pagination, Forminput und POI-Auswahl.
- `events.validation.ts`: `validateEventForm` mit Prüfungen für Titel, Datumswerte, HTTPS-URLs und Kategorienlänge.

## Nutzung und Integration

Die Integration erfolgt über die Plugin-Definition:

```ts
import { pluginEvents } from '@sva/plugin-events';
```

`pluginEvents` registriert:

- Navigation für `/admin/events` im Bereich `dataManagement`
- Standard-Action-IDs `events.create`, `events.edit`, `events.update`, `events.delete`
- Admin-Ressource `events.content` mit den Binding-Keys `eventsList`, `eventsDetail` und `eventsEditor`
- Übersetzungen für Deutsch und Englisch
- Media-Picker-Konfiguration für ein Headerbild mit Rolle `header_image`

Die React-Seiten erwarten eine Host-Umgebung, in der folgende Infrastruktur bereits vorhanden ist:

- TanStack Router für Navigation zu `/admin/events`, `/admin/events/new` und `/admin/events/$id`
- `@sva/plugin-sdk` für Übersetzungen, Mainserver-CRUD-Helfer und Host-Media-Referenzen
- `@sva/studio-ui-react` für Formular-, Tabellen- und Statuskomponenten
- Mainserver-Facades für Events und POIs sowie ein `fetch`-basiertes Runtime-Environment

Beim Speichern ergänzt die UI optionale Host-Media-Referenzen für das Headerbild. Beim Bearbeiten lädt sie zusätzlich bestehende Media-Referenzen und POI-Optionen nach.

## Projektstruktur

```text
packages/plugin-events/
|- src/
|  |- index.ts
|  |- plugin.tsx
|  |- events.api.ts
|  |- events.constants.ts
|  |- events.pages.tsx
|  |- events.types.ts
|  `- events.validation.ts
|- tests/
|  |- events.api.test.ts
|  |- events.pages.test.tsx
|  |- events.validation.test.ts
|  `- plugin.test.ts
|- package.json
|- project.json
|- tsconfig.json
|- tsconfig.lib.json
`- vitest.config.ts
```

Wichtige Dateiverantwortlichkeiten:

- `src/plugin.tsx`: Plugin-Vertrag, Standard-Content-Contribution, Berechtigungen, Actions und Übersetzungen
- `src/events.pages.tsx`: Formularzustand, Paginierung, Lade-/Fehlerzustände, Delete-Flow und Media-Referenz-Synchronisierung
- `tests/plugin.test.ts`: sichert den kanonischen Plugin-Vertrag
- `tests/events.pages.test.tsx`: deckt Empty-State, Fehlerfall, Create-Flow mit Media-Referenzen und Edit-Flow ab

## Nx-Konfiguration

Das Paket ist in `project.json` als Nx-Library `plugin-events` mit den Tags `scope:plugin` und `type:lib` registriert.

Verfügbare Targets:

- `build`: kompiliert mit `tsc -p packages/plugin-events/tsconfig.lib.json` nach `dist/`
- `lint`: prüft Quell- und Testdateien über `@nx/eslint:lint`
- `test:unit`: führt die Vitest-Unit-Tests im Paket aus
- `test:coverage`: führt die Tests mit Coverage aus
- `test:integration`: Platzhalter-Target ohne konfigurierte Integrationstests

`vitest.config.ts` verwendet `jsdom` und Alias-Auflösungen auf Workspace-Quellpakete, damit die Paket-Tests direkt gegen die lokalen Quellen laufen.

## Verwandte Dokumentation

- `packages/plugin-events/package.json`: Paketname, ESM-Exports sowie Runtime- und Peer-Dependencies
- `packages/plugin-events/project.json`: Nx-Projektdefinition und ausführbare Targets
- `packages/plugin-events/tests/`: ausführbare Spezifikation des erwarteten Plugin-Verhaltens
- `packages/plugin-events/dist/`: Build-Artefakte zur Kontrolle der veröffentlichten Paketoberfläche
