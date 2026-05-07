# Change: Plugin-SDK-Helfer für standardisierte Content-Plugins zentralisieren

## Why

Die drei produktiven Content-Plugins `@sva/plugin-news`, `@sva/plugin-events` und `@sva/plugin-poi` verwendeten bislang nahezu identische technische Muster für Standard-CRUD-Metadaten, Mainserver-HTTP-Zugriffe und kleine UI-nahe Hilfsfunktionen. Diese Wiederholung erhöht den Pflegeaufwand und begünstigt Drift, obwohl die Boundary klar vorgibt, dass Shared-Code nur über `@sva/plugin-sdk` laufen soll.

## What Changes

- ergänzt `@sva/plugin-sdk` um Helper für standardisierte Content-Plugin-Beiträge
- ergänzt `@sva/plugin-sdk` um gemeinsame Mainserver-CRUD- und Utility-Bausteine
- migriert News, Events und POI auf diese SDK-Helfer, ohne Abhängigkeiten zwischen Plugins einzuführen
- ergänzt fehlende Contract- und Page-Tests für Events und POI
- aktualisiert Plugin-Guide und relevante arc42-Abschnitte

## Impact

- Affected specs: `content-management`
- Affected code:
  - `packages/plugin-sdk/src/*`
  - `packages/plugin-news/src/*`
  - `packages/plugin-events/src/*`
  - `packages/plugin-poi/src/*`
  - `packages/sdk/src/index.ts`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
