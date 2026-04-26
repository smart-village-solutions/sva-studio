# Change: News-Plugin an SVA-Mainserver anbinden

## Why

Das News-Plugin besitzt bereits spezialisierte Listen-, Erstellungs- und Bearbeitungsoberflächen, nutzt aktuell aber die lokale Studio-IAM-Content-API. Damit Studio als GUI für die GraphQL-API des SVA-Mainservers dienen kann, muss News als erster fachlicher Content-Flow über die vorhandene serverseitige Mainserver-Delegation laufen.

Ohne diese Anbindung entstehen zwei konkurrierende Content-Quellen: lokale Studio-Inhalte für das Plugin und Mainserver-Inhalte für die eigentliche App-Auslieferung.

## What Changes

- Einführung typisierter News-Query- und Mutation-Adapter in `@sva/sva-mainserver/server` für Listen, Detail, Erstellen, Aktualisieren und Löschen bzw. Archivieren von News-Einträgen.
- Nutzung des vorhandenen per-User Delegationsmodells: Instanzkonfiguration aus `iam.instance_integrations`, Credentials aus Keycloak, OAuth2-Token serverseitig, GraphQL-Aufruf ausschließlich serverseitig.
- Umstellung der News-Plugin-Datenzugriffe von `/api/v1/iam/contents` auf hostseitige Server-Funktionen, die intern die Mainserver-News-Adapter nutzen.
- Mapping zwischen Plugin-Formmodell (`NewsFormInput`, `NewsPayload`, Status, Publikationsdatum) und Mainserver-GraphQL-Schema mit deterministischer Validierung und Fehlerabbildung.
- Beibehaltung der Plugin-Routen und spezialisierten News-UI, aber ohne Browser-Zugriff auf Mainserver-Endpunkte, Tokens oder Secrets.
- Migration/Kompatibilitätsentscheidung für bestehende lokale `news.article`-Inhalte: kein stiller Dual-Write; vorhandene lokale Inhalte werden entweder explizit migriert oder als Legacy-Quelle nur lesend abgegrenzt.
- Dokumentation des News-Mainserver-Flows, der Betriebsgrenzen und der Schema-Drift-Abhängigkeit.

## Impact

- Affected specs:
  - `sva-mainserver-integration`
  - `content-management`
- Affected code:
  - `packages/sva-mainserver/src/generated/*`
  - `packages/sva-mainserver/src/server/*`
  - `packages/plugin-news/src/news.api.ts`
  - `packages/plugin-news/src/news.pages.tsx`
  - `packages/plugin-news/src/news.types.ts`
  - `apps/sva-studio-react/src/lib/*`
  - `apps/sva-studio-react/src/routing/*`
  - `packages/auth-runtime` und IAM-Content-Permissions, sofern neue Host-Server-Funktionen zusätzliche Claims oder Scope-Checks benötigen
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
- Keine direkte Abhängigkeit von `@sva/plugin-news` auf `@sva/sva-mainserver/server`.
- Keine Einführung eines zweiten News-Statusmodells neben dem Mainserver-Vertrag.
- Keine automatische, implizite Migration lokaler `news.article`-Inhalte ohne expliziten Operator-Schritt und Report.
- Keine Änderung an der mobilen App; sie konsumiert weiterhin den bestehenden Mainserver.
