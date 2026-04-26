# Design: Mainserver-backed Events and POI Plugins

## Context

News liefert das Referenzmuster: Das Plugin rendert die fachliche UI, während Auth, Mainserver-Credentials, GraphQL-Transport, Fehlerklassifikation, Logging und Autorisierung host-owned bleiben. Events und POI folgen diesem Muster, werden aber als getrennte Plugins umgesetzt, weil ihre Fachmodelle und Workflows unterschiedlich sind.

## Current Schema Snapshot

Der eingecheckte Snapshot `packages/sva-mainserver/src/generated/schema.snapshot.json` enthält für Events:

- Query `eventRecords(search, categoryId, categoryIds, skip, limit, take, ids, order, dataProvider, dataProviderId, location, locations, excludeFilter, dateRange, onlyUniqEvents): [EventRecord!]`
- Query `eventRecord(id: ID!): EventRecord`
- Mutation `createEventRecord(...) : EventRecord`
- Mutation `changeVisibility(id: ID!, recordType: String!, visible: Boolean!): Status`
- Mutation `destroyRecord(id: ID, recordType: String!, externalId: String): Destroy`
- Object `EventRecord` mit u. a. `id`, `title`, `description`, `dates`, `listDate`, `sortDate`, `addresses`, `location`, `contacts`, `urls`, `mediaContents`, `organizer`, `priceInformations`, `accessibilityInformation`, `tagList`, `createdAt`, `updatedAt`, `visible`

Der Snapshot enthält für POI:

- Query `pointsOfInterest(ids, order, dataProvider, dataProviderId, dateRange, category, categoryId, categoryIds, location, search, onlyWithImage, limit, skip): [PointOfInterest!]`
- Query `pointOfInterest(id: ID!): PointOfInterest`
- Mutation `createPointOfInterest(...) : PointOfInterest`
- Mutation `createPointsOfInterest(pointsOfInterest: [PointOfInterestInput!]!): CreatePointsOfInterestPayload`
- Mutation `changeVisibility(id: ID!, recordType: String!, visible: Boolean!): Status`
- Mutation `destroyRecord(id: ID, recordType: String!, externalId: String): Destroy`
- Object `PointOfInterest` mit u. a. `id`, `name`, `description`, `mobileDescription`, `active`, `payload`, `addresses`, `location`, `contact`, `openingHours`, `operatingCompany`, `webUrls`, `mediaContents`, `priceInformations`, `certificates`, `accessibilityInformation`, `tagList`, `createdAt`, `updatedAt`, `visible`

Es gibt keine dedizierten Update- oder Delete-Mutationen. Update wird nur nach Staging-Verifikation als Upsert über `createEventRecord` bzw. `createPointOfInterest` mit bestehender `id` und dokumentierter `forceCreate`-Semantik umgesetzt. Archive/Delete wird je Fachdomäne explizit über `changeVisibility` oder `destroyRecord` entschieden.

## Decisions

### Plugin Split

Events und POI werden getrennte Packages:

- `packages/plugin-events` mit Package-Namen `@sva/plugin-events`, Namespace `events`, Content-Type `events.event-record`.
- `packages/plugin-poi` mit Package-Namen `@sva/plugin-poi`, Namespace `poi`, Content-Type `poi.point-of-interest`.

Beide Packages erhalten eigene Actions, Übersetzungen, Routen, Tests und Nx-Projekte. Gemeinsame technische Hilfen dürfen nur entstehen, wenn sie framework-agnostisch und außerhalb der Plugins sinnvoll wiederverwendbar sind; fachliche UI bleibt pluginlokal.

### Mainserver-Service

`@sva/sva-mainserver/server` erhält fachlich begrenzte Adapter:

- Events: `listSvaMainserverEvents`, `getSvaMainserverEvent`, `createSvaMainserverEvent`, `updateSvaMainserverEvent`, `deleteSvaMainserverEvent` oder `archiveSvaMainserverEvent`.
- POI: `listSvaMainserverPoi`, `getSvaMainserverPoi`, `createSvaMainserverPoi`, `updateSvaMainserverPoi`, `deleteSvaMainserverPoi` oder `archiveSvaMainserverPoi`.

Die Adapter nutzen denselben internen GraphQL-Transport, dieselbe per-user Delegation und dieselbe Fehlerklassifikation wie News. Ein generischer Executor bleibt intern.

### Host-Owned Plugin Data Sources

Die bevorzugte Umsetzung sind HTTP-Fassaden:

- `/api/v1/mainserver/events`
- `/api/v1/mainserver/events/$eventId`
- `/api/v1/mainserver/poi`
- `/api/v1/mainserver/poi/$poiId`

Eine injizierte Data-Source ist zulässig, wenn sie dieselbe Boundary erfüllt. Die Plugins sehen nur pluginnahe DTOs und stabile Fehlercodes.

### Authorization

Der Host prüft vor Mainserver-Aufrufen:

- authentifizierte Session
- vorhandenen `instanceId`
- passende lokale Content-Primitive je Operation
- aktive Scope-/Organisationsinformation, soweit für Content-Autorisierung nötig
- per-User Mainserver-Credentials

Die Plugin-Actions bleiben fully-qualified (`events.create`, `events.update`, `events.delete`, `poi.create`, `poi.update`, `poi.delete`) und mappen auf bestehende Content-Primitive. Mainserver-Denials werden nicht mit gemeinsamen oder erhöhten Credentials wiederholt.

### Mapping

Events starten mit einem bewusst fokussierten Formularmodell:

- `title` <- `EventRecord.title`
- `description` <- `EventRecord.description`
- `dates` <- `EventRecord.dates`
- `category`/`categoryName` <- `EventRecord.category` bzw. Mutation `categoryName`
- `address`/`location` <- `EventRecord.addresses` und `EventRecord.location`
- `contact`/`urls` <- `EventRecord.contacts` und `EventRecord.urls`
- `media` <- `EventRecord.mediaContents`
- `organizer` <- `EventRecord.organizer`
- `priceInformations` und `accessibilityInformation` bei stabiler Mapping-Abdeckung
- `tags` <- `EventRecord.tagList` bzw. Mutation `tags`
- optionaler POI-Bezug <- Mutation `pointOfInterestId`
- `status` <- Ableitung aus `visible`, Datum und optionalem Pluginzustand

POI starten mit einem fokussierten Formularmodell:

- `name` <- `PointOfInterest.name`
- `description` <- `PointOfInterest.description`
- `mobileDescription` <- `PointOfInterest.mobileDescription`
- `active` und `status` <- `PointOfInterest.active` und `visible`
- `category`/`categoryName` <- `PointOfInterest.category` bzw. Mutation `categoryName`
- `address`/`location` <- `PointOfInterest.addresses` und `PointOfInterest.location`
- `contact`/`webUrls` <- `PointOfInterest.contact` und `PointOfInterest.webUrls`
- `openingHours` <- `PointOfInterest.openingHours`
- `operatingCompany` <- `PointOfInterest.operatingCompany`
- `media` <- `PointOfInterest.mediaContents`
- `payload` <- `PointOfInterest.payload`
- `tags` <- `PointOfInterest.tagList` bzw. Mutation `tags`

Komplexe verschachtelte Eingaben werden vor GraphQL-Ausführung validiert. Nicht unterstützte Teilmodelle werden sichtbar eingeschränkt und dokumentiert.

## Risks / Trade-offs

- Events und POI haben deutlich tiefere verschachtelte Mainserver-Typen als News. Der erste Implementierungsschritt muss den Formularumfang begrenzen, statt ungetestet alle Snapshot-Felder beschreibbar zu machen.
- Update-Semantik über `createEventRecord` und `createPointOfInterest` muss gegen Staging validiert werden.
- POI und Events können fachlich gekoppelt sein. Der optionale `pointOfInterestId` bei Events darf keine harte Implementierungsabhängigkeit des Events-Plugins auf das POI-Plugin erzwingen.
- Separate Plugins erzeugen etwas Duplikation, halten aber Navigation, Rechte, Tests und spätere Rollouts klar getrennt.

## Migration Plan

1. Snapshot- und Staging-Schema für Event- und POI-Operationen vergleichen.
2. Neue Plugin-Packages mit Nx-Projekten, Package-Metadaten, SDK-Boundaries und i18n anlegen.
3. Typisierte Mainserver-Dokumente, DTOs und Mapper für Events und POI ergänzen.
4. Host-owned Data-Source-Fassaden inklusive Auth, Permission-Gates, Error-Mapping und Logging bereitstellen.
5. Plugin-Listen, Detail-/Editor-Seiten, Validierung und Actions implementieren.
6. Host-Registry, Navigation, Routen und E2E-Smoke-Coverage erweitern.
7. Runbook und arc42-Dokumentation aktualisieren.

## Open Questions

- Soll Event-Delete in Phase 1 als hartes `destroyRecord(recordType: "EventRecord")` oder als Sichtbarkeitswechsel umgesetzt werden?
- Soll POI-Delete in Phase 1 als hartes `destroyRecord(recordType: "PointOfInterest")` oder als Sichtbarkeitswechsel umgesetzt werden?
- Welche Event-Wiederholungsfelder sind im ersten bearbeitbaren Formular Pflichtumfang?
- Soll der Event-Editor vorhandene POI aus dem POI-Plugin auswählen können, oder startet `pointOfInterestId` als manuelles/optionales Feld?
