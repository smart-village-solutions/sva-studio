# Change: News-Plugin auf vollständiges Mainserver-Datenmodell erweitern

## Why

Die produktive News-Mainserver-Anbindung nutzt aktuell nur einen kleinen Phase-1-Ausschnitt des GraphQL-`NewsItem`-Modells. Bevor Events und POI nach demselben Muster umgesetzt werden, muss News als Referenzplugin das vollständige Mainserver-News-Datenmodell sauber abdecken: editierbare Felder, read-only Felder, verschachtelte Typen, serverseitige Operationen und bewusst nicht unterstützte UI-Verhalten.

## Current State

- `@sva/plugin-news` lädt und schreibt produktiv über die hostgeführte Fassade `/api/v1/mainserver/news`.
- `@sva/sva-mainserver/server` selektiert für News aktuell nur `id`, `title`, `author`, `payload`, `publicationDate`, `publishedAt`, `createdAt`, `updatedAt` und `visible`.
- Das Plugin-Formular unterstützt aktuell nur `title`, `publishedAt` und `payload` mit `teaser`, `body`, `imageUrl`, `externalUrl` und `category`.
- Der GraphQL-Snapshot enthält für `NewsItem` zusätzlich u. a. `externalId`, `fullVersion`, `charactersToBeShown`, `newsType`, `keywords`, `showPublishDate`, `sourceUrl`, `address`, `categories`, `contentBlocks`, `dataProvider`, `settings`, `announcements`, `likeCount`, `likedByMe` und `pushNotificationsSentAt`.
- Die Mutation `createNewsItem` akzeptiert zusätzlich u. a. `pushNotification`, `author`, `keywords`, `externalId`, `fullVersion`, `charactersToBeShown`, `newsType`, `showPublishDate`, `categories`, `sourceUrl`, `address`, `contentBlocks` und `pointOfInterestId`.

## What Changes

- Das News-Mainserver-Modell wird in `@sva/sva-mainserver` vollständig und typisiert auf Basis des Snapshot-Vertrags abgebildet.
- Die News-GraphQL-Dokumente selektieren alle `NewsItem`-Felder, die im Snapshot stabil vorhanden sind; verschachtelte Typen werden mit expliziten, begrenzten Fragmenten erfasst.
- Die hostgeführte News-Fassade validiert und transportiert das vollständige News-Input-Modell, inklusive verschachtelter `categories`, `sourceUrl`, `address`, `contentBlocks` und `pointOfInterestId`.
- Das News-Plugin erhält ein vollständiges Editor-Modell für alle schreibbaren `createNewsItem`-Argumente, soweit sie fachlich in Studio editierbar sind.
- Read-only oder abgeleitete Felder werden im Detailkontext sichtbar oder bewusst als nicht editierbar dokumentiert:
  - `id`, `createdAt`, `updatedAt`, `visible`, `dataProvider`, `settings`, `announcements`, `likeCount`, `likedByMe`, `pushNotificationsSentAt`.
- Operationelle Eingaben wie `pushNotification` werden explizit als Create/Update-Option modelliert, statt sie in `payload` zu verstecken.
- Bestehende News-Phase-1-Daten bleiben kompatibel; fehlende optionale Felder werden deterministisch auf `undefined`, leere Listen oder stabile Defaults gemappt.
- Der Events/POI-Change wird fachlich an diesen neuen News-Referenzstand angepasst, bevor er umgesetzt wird.

## Impact

- Affected specs:
  - `content-management`
  - `sva-mainserver-integration`
  - `monorepo-structure`
  - `plugin-actions`
- Affected code:
  - `packages/sva-mainserver/src/generated/news.ts`
  - `packages/sva-mainserver/src/types.ts`
  - `packages/sva-mainserver/src/server/service.ts`
  - `packages/sva-mainserver/src/server/service.test.ts`
  - `apps/sva-studio-react/src/lib/mainserver-news-api.server.ts`
  - `apps/sva-studio-react/src/lib/mainserver-news-api.server.test.ts`
  - `packages/plugin-news/src/news.types.ts`
  - `packages/plugin-news/src/news.api.ts`
  - `packages/plugin-news/src/news.validation.ts`
  - `packages/plugin-news/src/news.pages.tsx`
  - `packages/plugin-news/src/plugin.tsx`
  - `packages/plugin-news/tests/*`
  - `apps/sva-studio-react/e2e/news-plugin.spec.ts`
- Affected docs:
  - `docs/development/runbook-sva-mainserver.md`
  - `docs/guides/plugin-development.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
  - `11-risks-and-technical-debt`

## Non-Goals

- Kein generischer Mainserver-CMS-Editor für beliebige GraphQL-Typen.
- Kein generischer GraphQL-Proxy für Plugin- oder Browser-Code.
- Keine lokale IAM-Content-Persistenz, kein Dual-Write und keine Legacy-Migration.
- Keine Bearbeitung von `announcements` über das News-Plugin, solange dafür kein dedizierter Mainserver-Schreibvertrag verifiziert ist.
- Keine Pflege von Likes oder User-Interaktionen (`likeCount`, `likedByMe`) über Studio.
- Keine direkte Plugin-Abhängigkeit auf `@sva/sva-mainserver/server`, `@sva/auth-runtime/server` oder App-interne Module.
