# Change: News-Plugin an SVA-Mainserver anbinden

## Why

Das News-Plugin ist bereits ein produktives Fachplugin mit spezialisierter React-UI, Studio-UI-Bausteinen, Plugin-Actions und dem kanonischen Content-Type `news.article`. Die Datenfassade `packages/plugin-news/src/news.api.ts` spricht aktuell jedoch browserseitig die lokale Studio-IAM-Content-API `/api/v1/iam/contents` an.

Damit Studio als GUI für die GraphQL-API des SVA-Mainservers dienen kann, muss News als erster fachlicher Mainserver-Content-Flow über die vorhandene serverseitige Mainserver-Delegation laufen. Ohne diese Umstellung entstehen zwei konkurrierende Quellen: lokale Studio-Contents für das Plugin und Mainserver-News für die App-Auslieferung.

## Current State

- `@sva/plugin-news` hängt nur von `@sva/plugin-sdk` und `@sva/studio-ui-react` ab; es darf keine App-, Auth-Runtime- oder Mainserver-Servermodule importieren.
- `news.api.ts` nutzt `fetch` gegen `/api/v1/iam/contents`, filtert `news.article` und zeigt während der Umstellung zusätzlich Legacy-`news`-Records.
- `@sva/sva-mainserver/server` kapselt Instanzkonfiguration, Keycloak-Credentials, OAuth2, GraphQL-Transport, Retry, Cache, Logging und OTEL, exportiert aktuell aber nur Diagnoseoperationen (`__typename`).
- Der eingecheckte Mainserver-Snapshot enthält konkrete News-Verträge: Query `newsItems`, Query `newsItem`, Mutation `createNewsItem`, Batch-Mutation `createNewsItems`, Mutation `changeVisibility` und generische Mutation `destroyRecord`.
- Es gibt im Snapshot keine dedizierten Mutationen `updateNewsItem` oder `deleteNewsItem`; Update/Delete/Archive müssen deshalb bewusst auf den vorhandenen Mainserver-Vertrag gemappt und gegen Staging validiert werden.
- Die Vorarbeiten `refactor-p2-content-management-core-contract`, `refactor-p2-iam-capability-mapping-for-content-actions` und `add-studio-ui-plugin-view-contract` sind archiviert und in die aktiven Specs übernommen.

## What Changes

- Einführung typisierter News-Query- und Mutation-Adapter in `@sva/sva-mainserver/server` für `newsItems`, `newsItem`, `createNewsItem`/`createNewsItems` und den gewählten Archive/Delete-Pfad.
- Erweiterung des internen Mainserver-GraphQL-Transports um typisierte Variablen, ohne einen generischen Executor als Public API zu exportieren.
- Einführung eines host-owned News-Datenvertrags für das Plugin. Aufgrund der aktuellen Plugin-Grenze erfolgt die Anbindung bevorzugt über Studio-eigene HTTP-Endpunkte oder eine explizit host-injizierte Data-Source, nicht durch direkte Plugin-Imports aus App- oder Serverpackages.
- Umstellung von `packages/plugin-news/src/news.api.ts` weg von `/api/v1/iam/contents` auf diese host-owned Mainserver-News-Fassade.
- Explizites Mapping zwischen `NewsFormInput`/`NewsPayload` und dem Mainserver-GraphQL-Vertrag:
  - `title` -> `NewsItem.title`
  - `payload.teaser`, `payload.body`, `payload.imageUrl`, `payload.externalUrl`, `payload.category` -> `NewsItem.payload` bzw. vorhandene Mainserver-Felder, soweit verifiziert
  - `publishedAt` -> `NewsItem.publishedAt` und/oder `publicationDate`
  - Plugin-Status -> Mainserver-Sichtbarkeit/Publikationszustand, ohne ein stilles zweites Mainserver-Statusmodell einzuführen
- Beibehaltung der spezialisierten News-Routen und UI, inklusive `@sva/studio-ui-react`.
- Explizite Entscheidung für lokale `news.article`-/`news`-Altbestände: kein Dual-Write; lokale Records werden entweder operatorgeführt migriert oder als nicht-produktive Legacy-Quelle dokumentiert.
- Dokumentation des News-Mainserver-Flows, der Fehlerdiagnose, des Rollbacks und der Schema-Drift-Abhängigkeit.

## Impact

- Affected specs:
  - `sva-mainserver-integration`
  - `content-management`
- Affected code:
  - `packages/sva-mainserver/src/generated/*`
  - `packages/sva-mainserver/src/server/*`
  - `packages/sva-mainserver/src/types.ts`
  - `packages/plugin-news/src/news.api.ts`
  - `packages/plugin-news/src/news.pages.tsx`
  - `packages/plugin-news/src/news.types.ts`
  - `apps/sva-studio-react/src/lib/*`
  - `apps/sva-studio-react/src/server.ts` und/oder `packages/routing/src/*`, falls ein host-owned HTTP-Endpunkt eingeführt wird
  - `packages/auth-runtime`, sofern bestehende Content-Primitive nicht ausreichen oder ein wiederverwendbarer serverseitiger Permission-Helper ausgelagert wird
- Affected docs:
  - `docs/development/runbook-sva-mainserver.md`
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
- Affected arc42 sections:
  - `04-solution-strategy`
  - `05-building-block-view`
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
  - `11-risks-and-technical-debt`

## Non-Goals

- Kein generischer GraphQL-Proxy aus dem Browser oder aus Plugin-Code.
- Keine direkte Abhängigkeit von `@sva/plugin-news` auf `@sva/sva-mainserver/server`, `@sva/auth-runtime/server` oder App-interne Module.
- Keine Einführung eines zweiten News-Statusmodells neben dem Mainserver-Vertrag; nicht direkt unterstützte Plugin-Statuswerte werden explizit gemappt, eingeschränkt oder dokumentiert.
- Keine automatische, implizite Migration lokaler `news.article`-Inhalte ohne Operator-Schritt und Report.
- Kein Dual-Write in lokale IAM-Contents und Mainserver.
- Keine Änderung an der mobilen App; sie konsumiert weiterhin den bestehenden Mainserver.
