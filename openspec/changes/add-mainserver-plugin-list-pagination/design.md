## Context

Die drei produktiven Mainserver-Plugins verwenden heute einen Sonderpfad fuer Listen:
- Browser ruft pluginlokale API-Wrapper auf
- Host-Routen liefern rohe Arrays ohne Pagination-Metadaten
- `@sva/sva-mainserver` listet mit fest verdrahtetem `limit: 100, skip: 0`
- jede Plugin-Page rendert eine eigene Tabelle ohne `StudioDataTable`

Das erzeugt zwei Probleme gleichzeitig:
- Performance: es wird mehr geladen als fuer die aktuelle Sicht noetig ist
- UI-Drift: drei Tabellen weichen vom etablierten Admin-Tabellenmuster ab

## Goals / Non-Goals

- Goals:
  - Serverseitige Pagination fuer News-, Event- und POI-Listen
  - Gemeinsamer Host-Vertrag fuer List-Queries und Pagination-Metadaten
  - Harmonisierung der drei Plugin-Listen auf `StudioDataTable`
  - Keine Vollabfrage mehr als Default-Verhalten fuer Listen
  - Saubere Behandlung der Upstream-Constraint ohne vorgetaeuschte Totalseiten
- Non-Goals:
  - Keine vollstaendige Vereinheitlichung aller Content-Detailseiten in diesem Change
  - Keine neue Tabellenbibliothek
  - Keine Einfuehrung pluginindividueller Spezialfilter, wenn sie fuer die drei Listen nicht gemeinsam benoetigt werden

## Decisions

### Decision: Kanonischer List-Contract mit Query und Pagination-Metadaten

Die Host-seitigen List-Adapter akzeptieren einen typisierten Query-Vertrag mit mindestens:
- `page`
- `pageSize`

Die Rueckgabe liefert:
- `data`
- `pagination.page`
- `pagination.pageSize`
- `pagination.hasNextPage`
- optional `pagination.total`

`total` bleibt optional, weil der aktuelle Snapshot keine offensichtlichen globalen Count-Felder fuer die drei Collections zeigt. Die UI darf fuer Mainserver-Plugin-Listen daher nicht von exakten Totalseiten abhaengen.

Die Plugin-Listen fuehren `page` und `pageSize` als typsichere Search-Params im Routing. Die URL ist damit die kanonische Quelle fuer Listen-Navigation, Deep-Links und Browser-Historie.

### Decision: Ehrliche Prev/Next-Pagination statt erfundener Totalseiten

Wenn Upstream keinen exakten Gesamtzaehler liefert, bestimmt der Host `hasNextPage` deterministisch ueber ein `pageSize + 1`-Fetch-Muster oder einen gleichwertigen Snapshot-konformen Mechanismus. Diese Semantik muss auf dem tatsaechlich sichtbaren Ergebnis gelten, nicht nur auf der rohen Upstream-Antwort. Wenn nachgelagerte Sichtbarkeitsfilter Eintraege entfernen, muss der Host so lange nachladen oder ueberfetching betreiben, bis er fuer die sichtbare Seite korrekt entscheiden kann, ob eine weitere sichtbare Seite existiert.

Die UI zeigt dann Vor/Zurueck und die aktuelle Seite, aber keine fiktive Gesamtseitenzahl.

Falls spaeter ein belastbarer Count-Endpunkt verfuegbar ist, kann der Vertrag `pagination.total` ohne UI-Neubau erweitern.

### Decision: `StudioDataTable` wird die gemeinsame Tabellenbasis

Die drei Plugin-Listen werden auf `StudioDataTable` migriert, statt ihre Tabellen nur optisch anzugleichen. Dadurch werden Semantik, Sortierverhalten, Empty-/Loading-State und Aktionsspalten auf denselben Tabellenanker gelegt wie andere Admin-Bereiche.

Die Pagination-Steuerung bleibt ein hostseitiges Pattern um die Tabelle herum und nicht pluginlokale Tabellenlogik.

### Decision: Query-Normalisierung in den Host-Routen

Die HTTP-Routen unter `apps/sva-studio-react/src/lib/mainserver-*.server.ts` normalisieren Query-Parameter zentral:
- `page < 1` wird auf `1` gesetzt
- ungueltige `pageSize`-Werte werden auf einen kanonischen Default gesetzt
- Maximalwerte werden begrenzt

Der Change legt fuer alle drei Listen gemeinsame Werte fest:
- Default `pageSize = 25`
- erlaubte Groessen `25`, `50`, `100`
- Maximalwert `100`

Damit bleiben Browser-Code und Plugin-API-Wrapper duenn und typstabil.

## Risks / Trade-offs

- Risiko: Upstream liefert keinen exakten Count.
  - Mitigation: UI und Vertrag basieren auf `hasNextPage` als harte Garantie; `total` bleibt optional.
- Risiko: Sichtbarkeitsfilter verfälschen ein naives `pageSize + 1`-Signal.
  - Mitigation: `hasNextPage` wird auf Basis des sichtbaren Ergebnisses bestimmt; serverseitige Iteration oder gezieltes Overfetching ist zulaessig.
- Risiko: `StudioDataTable` benoetigt kleine Erweiterungen fuer die Plugin-Listen.
  - Mitigation: Erweiterungen generisch in `studio-ui-react` vornehmen, nicht in den Plugins duplizieren.
- Risiko: Playwright- und Unit-Tests muessen auf paginierte Responses umgestellt werden.
  - Mitigation: Response-Shape frueh zentral definieren und in allen drei Plugins wiederverwenden.

## Migration Plan

1. Query- und Response-Typen fuer paginierte Mainserver-Listen definieren.
2. `@sva/sva-mainserver` auf paginierte List-Adapter umstellen.
3. Host-Routen auf Query-Parsing und Pagination-Metadaten erweitern.
4. Plugin-API-Wrapper auf den neuen Vertrag umstellen.
5. Plugin-List-Pages mit Search-Params, `StudioDataTable` und Prev/Next-Steuerung migrieren.
6. Tests und E2E-Mocks auf den neuen Vertrag anpassen.

## Open Questions

- Soll `StudioDataTable` mittelfristig eine eingebaute generische Pagination-Slot-API bekommen oder bleibt Pagination bewusst ausserhalb der Tabelle? Fuer diesen Change reicht eine externe, gemeinsam genutzte Steuerung.
