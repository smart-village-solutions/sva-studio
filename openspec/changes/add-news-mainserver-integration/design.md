# Design: Mainserver-backed News Plugin

## Context

`@sva/sva-mainserver` stellt bereits die serverseitige Delegationskette bereit: Instanzkonfiguration aus `iam.instance_integrations`, Keycloak-Credentials pro User, OAuth2-Token, GraphQL-Transport, Caches, Timeouts, Retry, Logging und OTEL. Der aktuelle Public-Server-Vertrag beschränkt sich auf Diagnoseoperationen (`getSvaMainserverConnectionStatus`, `getSvaMainserverQueryRootTypename`, `getSvaMainserverMutationRootTypename`).

`@sva/plugin-news` ist bereits eine fachliche Studio-Oberfläche mit Liste, Formular, Validierung, CRUD-Aktionen und `@sva/studio-ui-react`. Die API-Fassade ruft aktuell `/api/v1/iam/contents` im Browser auf und speichert `news.article` als lokalen Studio-Content. `plugin-news` darf aus Boundary-Gründen keine App-, Auth-Runtime- oder Mainserver-Servermodule importieren.

## Current Schema Snapshot

Der eingecheckte Snapshot `packages/sva-mainserver/src/generated/schema.snapshot.json` enthält für News:

- Query `newsItems(ids, externalIds, dataProvider, dataProviderId, dataProviderIds, excludeDataProviderIds, excludeMowasRegionalKeys, categoryId, categoryIds, dateRange, excludeFilter, search, limit, skip, order): [NewsItem!]`
- Query `newsItem(id: ID!): NewsItem`
- Mutation `createNewsItem(...) : NewsItem`
- Mutation `createNewsItems(newsItems: [NewsItemInput!]!): CreateNewsItemsPayload`
- Mutation `changeVisibility(id: ID!, recordType: String!, visible: Boolean!): Status`
- Mutation `destroyRecord(id: ID, recordType: String!, externalId: String): Destroy`
- Object `NewsItem` mit u. a. `id`, `title`, `author`, `payload`, `publicationDate`, `publishedAt`, `visible`, `categories`, `sourceUrl`, `contentBlocks`, `createdAt`, `updatedAt`
- Input `NewsItemInput` mit u. a. `id`, `forceCreate`, `pushNotification`, `author`, `title`, `externalId`, `publicationDate`, `publishedAt`, `categoryName`, `payload`, `categories`, `sourceUrl`, `contentBlocks`
- Enum `NewsItemsOrder` mit `createdAt_*`, `updatedAt_*`, `publishedAt_*`, `id_*`

Es gibt keine dedizierten `updateNewsItem`- oder `deleteNewsItem`-Mutationen. Update wird deshalb als validierter Upsert über `createNewsItem` mit `id` und dokumentierter `forceCreate`-Semantik geprüft. Delete/Archive wird als bewusst gewählter Pfad über `changeVisibility(..., visible: false)`, `destroyRecord(recordType: ...)` oder einen dokumentierten harten Schnitt behandelt.

## Goals

- News ist der erste fachliche Mainserver-Content-Flow im Studio.
- Browser und Plugin-Code sehen keine Mainserver-URLs, Tokens oder Secrets.
- GraphQL-Dokumente, Variablen und DTO-Mapping sind typisiert und fachlich begrenzt.
- Mainserver-Fehler werden in stabile Studio-/Plugin-Fehler übersetzt.
- Die bestehende News-UI bleibt nutzbar und wird nicht durch eine generische GraphQL-Konsole ersetzt.
- Lokale Legacy-Inhalte werden bewusst behandelt, nicht nebenbei mit Mainserver-Daten vermischt.

## Non-Goals

- Kein generischer GraphQL-Executor als Public API.
- Kein Dual-Write in lokale IAM-Contents und Mainserver.
- Keine vollständige Content-Core-Migration aller Fachdomänen.
- Keine Runtime-Generierung von Plugin-Formularen aus dem GraphQL-Schema.

## Decisions

### Mainserver-Service

`createSvaMainserverService` erhält intern eine generische, aber nicht öffentlich exportierte GraphQL-Ausführungsfunktion mit Variablenunterstützung. Der öffentliche Server-Export bleibt fachlich: Diagnosefunktionen plus News-spezifische Adapter.

Die News-Adapter führen `instanceId`, `keycloakSubject`, `operationName`, typisierte Inputs und typisierte Outputs. Sie verwenden dieselben Hops und dieselbe Fehlerklassifikation wie die vorhandene Diagnose:

- `listSvaMainserverNews`
- `getSvaMainserverNews`
- `createSvaMainserverNews`
- `updateSvaMainserverNews` als verifizierter `createNewsItem`-Upsert mit `id`
- `archiveSvaMainserverNews` oder `deleteSvaMainserverNews` abhängig von der Staging-verifizierten Mainserver-Semantik

### Host-Owned Plugin Data Source

Wegen der aktuellen Plugin-Boundary ruft `@sva/plugin-news` keine Server-Funktionen aus `apps/sva-studio-react` und keine Server-Subpfade aus Workspace-Packages direkt auf.

Der bevorzugte Umsetzungspfad ist ein host-owned HTTP-Vertrag für News, der im App-/Routing-Server registriert wird und nur pluginnahe DTOs zurückgibt, z. B. `/api/v1/mainserver/news` und `/api/v1/mainserver/news/$newsId`. Eine host-injizierte Data-Source ist zulässig, wenn sie dieselbe Boundary erfüllt und keine App-Imports in `plugin-news` erzeugt.

Die bestehende `news.api.ts`-Fassade bleibt die Plugin-Grenze, wechselt aber von `/api/v1/iam/contents` auf die host-owned Mainserver-News-Fassade.

### Local Authorization

Vor jedem Mainserver-Aufruf prüft der Host:

- authentifizierte Session
- vorhandenen `instanceId`
- lokale Content-Primitive (`content.read`, `content.create`, `content.updatePayload`, `content.updateMetadata`, `content.publish`, `content.archive`, `content.delete` je Operation)
- aktive Scope-/Organisationsinformation, soweit für Content-Autorisierung nötig
- per-User Mainserver-Credentials

Mainserver-Denials bleiben maßgeblich. Studio darf bei Upstream-`401`/`403` nicht mit gemeinsamen oder erhöhten Credentials wiederholen.

### Mapping

Das Plugin-Modell wird explizit auf den Snapshot-Vertrag gemappt:

- `NewsContentItem.id` <- `NewsItem.id`
- `title` <- `NewsItem.title`
- `payload.teaser` <- `NewsItem.payload.teaser`
- `payload.body` <- `NewsItem.payload.body`
- `payload.imageUrl` <- `NewsItem.payload.imageUrl`; Medienmanagement ist nicht Teil dieses Changes
- `payload.externalUrl` <- `payload.externalUrl`; `sourceUrl` bleibt in Phase 1 ungenutzt
- `payload.category` <- `payload.category`; zusätzlich wird `categoryName` an `createNewsItem` gesendet

Staging-Verifikation hat gezeigt, dass der Mainserver `payload` in `createNewsItem` als JSON-kodierten String stabil akzeptiert, während ein direktes JSON-Objekt mit HTTP `500` beantwortet wird. Der serverseitige Adapter kodiert deshalb ausgehend mit `JSON.stringify(...)` und dekodiert eingehende `NewsItem.payload`-Werte tolerant aus Objekt oder String.
- `publishedAt` <- `NewsItem.publishedAt` und/oder `publicationDate`
- `updatedAt` <- `NewsItem.updatedAt`
- `author` <- `NewsItem.author`
- `status` <- deterministische Ableitung aus `visible`, `publishedAt`/`publicationDate` und optionalem Payload-Feld

Da der Mainserver-Snapshot kein natives `draft | in_review | approved | archived`-Enum für News zeigt, darf Phase 1 den Plugin-Statusumfang einschränken oder nicht unterstützte Statuswerte als lokale Formularzustände ohne Mainserver-Workflow-Garantie behandeln. Das muss in UI, Tests und Runbook sichtbar sein.

### Legacy Content

Lokale `news.article`- und alte `news`-Records bleiben nicht die produktive News-Quelle. Vor Umschaltung des Schreibpfads wird entschieden:

- expliziter Migrationsjob mit Dry-Run, Report und Idempotenz,
- oder dokumentierter harter Schnitt mit optionalem Legacy-Hinweis im UI/Runbook.

Ein Read-Fallback von Mainserver auf lokale IAM-Contents ist nicht zulässig, weil er die Source-of-Truth-Grenze verwischt.

## Risks / Trade-offs

- `createNewsItem`-Upsert mit bestehender `id` und `forceCreate: false` sowie `destroyRecord(id, recordType: "NewsItem")` wurden gegen Staging mit einem kurzlebigen Testdatensatz verifiziert.
- Das Plugin-Statusmodell ist reicher als der sichtbare Mainserver-News-Vertrag. Phase 1 muss Statuswerte reduzieren oder sauber in Mainserver-Felder/Payload mappen.
- Die aktuelle Plugin-API ist browserseitig. Der neue host-owned HTTP-/Data-Source-Vertrag ist deshalb Voraussetzung, bevor `news.api.ts` fachlich auf Mainserver umgestellt wird.
- Lokale Inhalte könnten nach Umstellung nicht mehr sichtbar sein. Das ist zulässig, wenn der Legacy-Entscheid dokumentiert und für Operatoren nachvollziehbar ist.

## Migration Plan

1. Staging-Schema gegen Snapshot validieren und die konkrete Update-/Archive-Semantik entscheiden.
2. Interne GraphQL-Ausführung in `@sva/sva-mainserver/server` variablenfähig machen.
3. News-Dokumente, DTOs und Mapper in `@sva/sva-mainserver` ergänzen.
4. Host-owned News-Fassade mit Auth, lokalen Content-Rechten, Error-Mapping und Logging bereitstellen.
5. `packages/plugin-news/src/news.api.ts` auf die neue Fassade umstellen.
6. Legacy-Content-Entscheidung implementieren oder dokumentiert blockieren.
7. Tests, Schema-Diff, Server-Runtime-Check und relevante App-/Plugin-Tests ausführen.

## Open Questions

- Eine spätere Phase muss entscheiden, ob neben hartem Löschen ein fachliches Archivieren über `changeVisibility` eingeführt werden soll.
- Soll der Plugin-Statusumfang in Phase 1 auf Mainserver-sichere Zustände reduziert werden?
- Sollen bestehende lokale `news.article`-Inhalte migriert werden, und falls ja: einmalig operatorgeführt oder als wiederholbarer Job?
