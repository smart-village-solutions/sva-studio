# Change: Serverseitige Pagination und StudioDataTable-Harmonisierung für Mainserver-Plugin-Listen

## Why
Die Listen der Plugins `news`, `events` und `poi` laden derzeit jeweils den kompletten Datenbestand und rendern pluginlokale Tabellen ohne Pagination. Das skaliert schlecht, verlängert die Ladezeit und führt zu drei voneinander abweichenden Tabellenmustern im Admin.

## What Changes
- Einführung eines kanonischen, serverseitigen Pagination-Vertrags für Mainserver-Listen von News, Events und POI
- Erweiterung der Host-Routen und Plugin-API-Wrapper um typisierte List-Query-Parameter und Pagination-Metadaten
- Festlegung von typsicheren Search-Params als kanonischem UI-State für `page` und `pageSize`
- Umstellung der drei Plugin-Listen von handgebauten `<table>`-Implementierungen auf `StudioDataTable`
- Vereinheitlichung der Pagination-Bedienung und Ladezustände für diese Plugin-Listen
- Explizite Berücksichtigung der Upstream-Constraint, dass der aktuelle Schema-Snapshot keine offensichtlichen globalen Count-Felder für News, Events oder POI zeigt
- Festlegung eines einheitlichen Defaults für Seitengrößen sowie messbarer Erfolgsziele für Netzlast und Ladeverhalten

## Scope Clarification
- Muss:
  - Serverseitige Pagination mit korrekter `hasNextPage`-Semantik auf dem tatsächlich sichtbaren Ergebnis
  - Typsichere Search-Params für Listen-Navigation
  - Einheitliche Pagination-Metadaten und feste Seitengrößen
- Bewusster Scope-Aufschlag:
  - Harmonisierung auf `StudioDataTable` für Konsistenz, A11y und geringere UI-Drift

## Success Metrics
- Die erste Listenanfrage lädt standardmäßig nur eine Seite statt des kompletten Bestands.
- Die Netzlast pro Listenansicht sinkt auf höchstens `pageSize + Overfetch für Sichtbarkeitskorrektur` statt Vollabfrage.
- Paging-Navigation bleibt über URL/Search-Params deep-linkbar und mit Browser-Zurück/Vorwärts konsistent.

## Impact
- Affected specs:
  - `content-management`
  - `sva-mainserver-integration`
- Affected code:
  - `packages/sva-mainserver/src/server/service.ts`
  - `apps/sva-studio-react/src/lib/mainserver-news-api.server.ts`
  - `apps/sva-studio-react/src/lib/mainserver-events-poi-api.server.ts`
  - `packages/plugin-news/src/news.api.ts`
  - `packages/plugin-events/src/events.api.ts`
  - `packages/plugin-poi/src/poi.api.ts`
  - `packages/plugin-news/src/news.pages.tsx`
  - `packages/plugin-events/src/events.pages.tsx`
  - `packages/plugin-poi/src/poi.pages.tsx`
  - `packages/studio-ui-react/src/studio-data-table.tsx`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
