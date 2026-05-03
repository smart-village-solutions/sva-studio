# Change: Events- und POI-Plugins an den SVA-Mainserver anbinden

## Why

Nach der News-Mainserver-Anbindung soll Studio weitere fachliche Mainserver-Inhalte redaktionell bearbeiten können. Events und Points of Interest sind eigenständige Fachdomänen mit unterschiedlichen Datenmodellen, Formularen, Aktionen und Navigationseinträgen; sie sollen deshalb als zwei separate Plugins entstehen.

## Current State

- `@sva/plugin-news` ist das Referenzmuster für ein fachliches Plugin mit spezialisierter React-UI, Plugin-Actions, Content-Type-Deklaration und host-owned Mainserver-Datenpfad.
- Die Host-App registriert aktuell `pluginNews` statisch in der Build-Time-Registry.
- Der Mainserver-Snapshot enthält Event-Verträge: Query `eventRecords`, Query `eventRecord`, Mutation `createEventRecord`, generische Mutation `changeVisibility` und generische Mutation `destroyRecord`.
- Der Mainserver-Snapshot enthält POI-Verträge: Query `pointsOfInterest`, Query `pointOfInterest`, Mutation `createPointOfInterest`, Batch-Mutation `createPointsOfInterest`, generische Mutation `changeVisibility` und generische Mutation `destroyRecord`.
- Es gibt im Snapshot keine dedizierten `updateEventRecord`, `deleteEventRecord`, `updatePointOfInterest` oder `deletePointOfInterest` Mutationen; Update/Delete/Archiv müssen je Fachdomäne explizit über vorhandene Mainserver-Operationen verifiziert werden.

## What Changes

- Einführung von zwei neuen Workspace-Plugins:
  - `@sva/plugin-events` mit Namespace `events`, Route `/plugins/events`, Event-Listen- und Editor-UI.
  - `@sva/plugin-poi` mit Namespace `poi`, Route `/plugins/poi`, POI-Listen- und Editor-UI.
- Beide Plugins nutzen `@sva/plugin-sdk` und `@sva/studio-ui-react`; sie importieren keine App-internen Module und keine Server-Subpfade.
- Einführung typisierter serverseitiger Mainserver-Adapter in `@sva/sva-mainserver/server` für Event- und POI-Listen, Details, Create, Update und Archive/Delete.
- Einführung host-owned HTTP- oder injizierter Data-Source-Fassaden für Events und POI, analog zum News-Muster.
- Events und POI folgen dem vollständigen Modellmuster aus `expand-news-mainserver-data-model`, werden aber nicht durch News-UI-Details blockiert.
- Explizites Mapping zwischen Plugin-Formularmodellen und Mainserver-GraphQL-Verträgen:
  - Events: Titel, Beschreibung, Termine, Wiederholung, Kategorie, Adresse/Ort, Kontakte, URLs, Medien, Veranstalter, Preis, Barrierefreiheit, Tags und optionaler POI-Bezug.
  - POI: Name, Beschreibung, mobile Beschreibung, Aktivstatus, Kategorie, Adresse/Ort, Kontakt, Öffnungszeiten, Betreiber, URLs, Medien, Preise, Zertifikate, Barrierefreiheit, Tags und Payload.
- Event- und POI-Delete nutzen in Phase 1 den harten Mainserver-Pfad `destroyRecord` mit `recordType: "EventRecord"` bzw. `recordType: "PointOfInterest"`.
- Der Event-Editor bietet eine POI-Auswahl ausschließlich über die host-owned POI-Fassade an; es gibt keine Plugin-zu-Plugin-Abhängigkeit.
- Die bestehenden Migration-Runtime-Anpassungen werden in diesen Change aufgenommen: Portainer-Log-Tail über Docker API bei fehlgeschlagenen Swarm-Migrationsjobs, `SVA_MIGRATION_JOB_KEEP_FAILED_STACK` als Diagnose-Fallback und finaler Goose-Status nach `up` ohne vorangestellten Pflicht-Statuscheck.
- Registrierung beider Plugins in der Host-Build-Time-Registry inklusive Navigation, Plugin-Actions, Content-Types und i18n.
- Erweiterung von Tests, E2E-Smoke-Coverage und Dokumentation für die neuen fachlichen Mainserver-Flows.

## Impact

- Affected specs:
  - `content-management`
  - `monorepo-structure`
  - `plugin-actions`
  - `sva-mainserver-integration`
- Affected code:
  - `packages/plugin-events`
  - `packages/plugin-poi`
  - `packages/sva-mainserver/src/generated/*`
  - `packages/sva-mainserver/src/server/*`
  - `packages/sva-mainserver/src/types.ts`
  - `apps/sva-studio-react/src/lib/plugins.ts`
  - `apps/sva-studio-react/src/server.ts` und/oder Routing-/Server-Dispatch-Dateien, falls HTTP-Endpunkte verwendet werden
  - `deploy/portainer/migrate-entrypoint.sh`
  - `scripts/ops/runtime/migration-job.ts`
  - `scripts/ops/runtime/remote-portainer.ts`
  - `apps/sva-studio-react/e2e/*`
  - Workspace-Konfigurationen für neue Nx-Projekte und TypeScript-Pfade
- Affected docs:
  - `docs/development/runbook-sva-mainserver.md`
  - Plugin-Entwicklungsdoku zu fachlichen Mainserver-Plugins
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

- Keine Zusammenlegung von Events und POI in ein gemeinsames Plugin.
- Kein generischer GraphQL-Proxy für Browser- oder Plugin-Code.
- Keine direkte Abhängigkeit der Plugins auf `@sva/sva-mainserver/server`, `@sva/auth-runtime/server` oder App-interne Module.
- Keine automatische Migration lokaler Legacy-Content-Daten ohne expliziten Operator-Schritt.
- Kein Dual-Write in lokale IAM-Contents und Mainserver.
- Keine vollständige Event-/POI-Fachmodellabdeckung, wenn der Mainserver-Snapshot Felder nur unklar oder nicht stabil anbietet; nicht unterstützte Felder werden in Phase 1 dokumentiert eingeschränkt.
