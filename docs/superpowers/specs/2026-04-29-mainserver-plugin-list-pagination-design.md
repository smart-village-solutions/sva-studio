# Mainserver-Plugin-Listen: Pagination- und Tabellenharmonisierung

## Ziel

Die Listenansichten von `news`, `events` und `poi` sollen nicht mehr komplette Datenmengen laden und keine eigenen Tabellenmuster mehr pflegen. Stattdessen bekommen sie einen gemeinsamen serverseitigen Pagination-Vertrag und werden auf `StudioDataTable` harmonisiert.

## Kernschnitt

- `@sva/sva-mainserver` akzeptiert List-Queries mit `page` und `pageSize`
- Host-Routen normalisieren Query-Parameter und liefern `data` plus `pagination`
- `pagination` enthält mindestens `page`, `pageSize`, `hasNextPage`
- `total` bleibt optional, weil der aktuelle Snapshot keine offensichtlichen globalen Count-Felder für News, Events oder POI zeigt

## UI-Richtung

- `NewsListPage`, `EventsListPage` und `PoiListPage` verwenden `StudioDataTable`
- die Paging-Bedienung folgt einem gemeinsamen Prev/Next-Muster
- die UI zeigt nur Informationen, die der Vertrag belastbar liefern kann

## Warum diese Richtung

- sie reduziert Ladezeit und Renderkosten
- sie entfernt drei parallele Tabellenbasen
- sie vermeidet das Vortäuschen exakter Totalseiten ohne Upstream-Beleg

## Betroffene Architektur

- `docs/architecture/04-solution-strategy.md`
- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/10-quality-requirements.md`
- `docs/architecture/11-risks-and-technical-debt.md`
