# @sva/plugin-events

Plugin-Bibliothek für die Verwaltung von Veranstaltungsinhalten im Admin-Bereich von SVA Studio. Das Paket bündelt die Plugin-Definition, die CRUD-Anbindung an den Mainserver, die React-Seiten für Liste und Bearbeitung sowie die zugehörige Formularvalidierung für den Content-Typ `events.event-record`.

## Architektur-Rolle

`@sva/plugin-events` ist ein fachliches Admin-Plugin im Scope `plugin`. Es registriert über `src/plugin.tsx` einen Standard-Content-Beitrag für `events`, liefert Navigations-, Action- und Berechtigungsdefinitionen aus dem Plugin-SDK und kapselt die UI-Integration für Event-Datensätze.

Die Bibliothek sitzt an der Grenze zwischen Host-Framework und Fachobjekt:

- `src/plugin.tsx` beschreibt die Plugin-Metadaten, Übersetzungen, Audit-Events und Media-Picker-Rollen.
- `src/events.api.ts` kapselt den Zugriff auf die Mainserver-Endpunkte `/api/v1/mainserver/events` und `/api/v1/mainserver/poi`.
- `src/events.pages.tsx` implementiert die Admin-Oberflächen für Listen-, Anlegen- und Bearbeiten-Flows mit Komponenten aus `@sva/studio-ui-react`.
- `src/events.detail-form-*-serializers.ts` hält die reine, paketinterne Serialisierung von Redaktion, Datum, Adresse, Medien und weiteren strukturierten Formularbereichen in den bestehenden Mainserver-Input.
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
- `events.validation.ts`: `validateEventForm` mit Prüfungen für Titel, Datumswerte, HTTPS-URLs, Kategorienlänge und den Veranstaltervertrag.

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

Datum und Uhrzeit sind je Termin die primären Eingaben. Wochentag, Hinweis zur Zeit und die bestehende Mainserver-Ausgabeoption „Nur den Hinweis zur Zeit anzeigen“ (`weekday`, `timeDescription`, `useOnlyTimeDescription`) stehen beim Anlegen und Bearbeiten je Termin im einklappbaren Abschnitt „Weitere Terminangaben (optional)“. Der Abschnitt ist beim ersten Anzeigen eingeklappt, solange diese Angaben leer sind und die Option nicht aktiv ist; vorhandene Werte öffnen ihn. Danach öffnen und schließen Nutzer ihn selbst. Die Abschnittsüberschrift nennt für Screenreader zusätzlich die Terminnummer. Die Angaben sind weder Pflichtfelder noch werden sie berechnet; Öffnen, Schließen, unverändertes Speichern und Änderungen an Datum oder Uhrzeit lassen vorhandene oder importierte Werte unverändert.

Der Veranstalter ist insgesamt optional. Name, E-Mail und Telefon stehen direkt im Abschnitt; die selten benötigte Adresse des Veranstalters (Ortsbezeichnung, Straße, PLZ, Ort, Karte und Koordinaten) liegt in einem als optional gekennzeichneten, einklappbaren Bereich. Er ist bei leerer Adresse geschlossen und öffnet sich automatisch, wenn eine gespeicherte Veranstaltung bereits Adress- oder Koordinatenangaben enthält. Wechselt die Bearbeitungsseite ohne Neuaufbau zu einer anderen Veranstaltung, wird dieser Zustand für die neu geladenen Daten neu bestimmt; manuelles Auf- und Zuklappen bleibt beim Bearbeiten derselben Veranstaltung erhalten. Einklappen verwirft keine Werte. Vollständig leere Veranstalterfelder werden nicht in den Mainserver-Payload aufgenommen. Sobald Name, Adresse oder Kontaktdaten eines Veranstalters vorhanden sind, muss das Feld `Institution/Firma` einen Namen enthalten; andernfalls verhindert die UI den Request, markiert das Namensfeld und fokussiert es im Content-Tab.

Der Abschnitt „Anmeldung und Teilnahme“ (`events.detail-content-participation-section.tsx`) bearbeitet die Mainserver-Felder `registrationRequired` und `maximumAttendees` beim Anlegen und Bearbeiten. Der Editor sendet beide Werte immer mit; ein leeres Teilnehmerlimit wird als `null` gesendet und entfernt einen gespeicherten Wert. Gültig ist ein leeres Feld oder eine ganze Zahl von 0 bis 2.147.483.647 (GraphQL-`Int`); andernfalls markiert die UI das Feld, verknüpft die Fehlermeldung und fokussiert es im Content-Tab.

Importierte Veranstaltungen werden verlustfrei gespeichert. Preisattribute ohne Formularfeld (`groupPrice`, `ageFrom`, `ageTo`, `min*Count`, `max*Count`) bleiben im Formularzustand und werden unverändert zurückgesendet. Wiederholungswerte liefert der Mainserver als Boolean beziehungsweise Zahlen (`recurring`, `recurringType`, `recurringInterval`, `recurringWeekdays`); das Formular normalisiert sie auf den String-Schreibvertrag, sodass das Speichern solcher Veranstaltungen nicht mehr fehlschlägt. Veranstaltungsort (`location`), Wiederholungszeitraum (`repeatDuration`) und Medien-`payload` haben kein Formularfeld; sie erhält der Host serverseitig aus dem unmittelbar vorherigen Lesen (siehe [Runbook SVA-Mainserver](../../docs/development/runbook-sva-mainserver.md#vollständigkeit-importierter-veranstaltungen)). Weist der Host ein Update ab, weil diese Quelldaten nicht sicher lesbar sind, zeigt der Editor die übersetzte Meldung `messages.sourceDataUnavailable`.

## Projektstruktur

```text
packages/plugin-events/
|- src/
|  |- index.ts
|  |- plugin.tsx
|  |- events.api.ts
|  |- events.constants.ts
|  |- events.detail-form.ts
|  |- events.detail-form-input-serializers.ts
|  |- events.detail-form-serialization-common.ts
|  |- events.detail-form-structured-serializers.ts
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
- `src/events.detail-form.ts`: öffentlich innerhalb des Pakets konsumiertes Formularmodell und Assemblierung des Mutation-Inputs
- `src/events.detail-form-*-serializers.ts`: frameworkfreie, paketinterne Serializer mit unveränderten Omit-, Reihenfolge- und Kompatibilitätsregeln
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
