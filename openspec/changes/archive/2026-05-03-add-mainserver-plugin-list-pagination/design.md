## Context

Die drei produktiven Mainserver-Plugins verwenden heute einen Sonderpfad für Listen:
- Browser ruft pluginlokale API-Wrapper auf
- Host-Routen liefern rohe Arrays ohne Pagination-Metadaten
- `@sva/sva-mainserver` listet mit fest verdrahtetem `limit: 100, skip: 0`
- jede Plugin-Page rendert eine eigene Tabelle ohne `StudioDataTable`

Das erzeugt zwei Probleme gleichzeitig:
- Performance: es wird mehr geladen als für die aktuelle Sicht nötig ist
- UI-Drift: drei Tabellen weichen vom etablierten Admin-Tabellenmuster ab

## Goals / Non-Goals

- Goals:
  - Serverseitige Pagination für News-, Event- und POI-Listen
  - Gemeinsamer Host-Vertrag für List-Queries und Pagination-Metadaten
  - Harmonisierung der drei Plugin-Listen auf `StudioDataTable`
  - Keine Vollabfrage mehr als Default-Verhalten für Listen
  - Saubere Behandlung der Upstream-Constraint ohne vorgetäuschte Totalseiten
- Non-Goals:
  - Keine vollständige Vereinheitlichung aller Content-Detailseiten in diesem Change
  - Keine neue Tabellenbibliothek
  - Keine Einführung pluginindividueller Spezialfilter, wenn sie für die drei Listen nicht gemeinsam benötigt werden

## Decisions

### Decision: Kanonischer List-Contract mit Query und Pagination-Metadaten

Die Host-seitigen List-Adapter akzeptieren einen typisierten Query-Vertrag mit mindestens:
- `page`
- `pageSize`

Die Rückgabe liefert:
- `data`
- `pagination.page`
- `pagination.pageSize`
- `pagination.hasNextPage`
- optional `pagination.total`

`total` bleibt optional, weil der aktuelle Snapshot keine offensichtlichen globalen Count-Felder für die drei Collections zeigt. Die UI darf für Mainserver-Plugin-Listen daher nicht von exakten Totalseiten abhängen.

Die Plugin-Listen führen `page` und `pageSize` als typsichere Search-Params im Routing. Die URL ist damit die kanonische Quelle für Listen-Navigation, Deep-Links und Browser-Historie.

### Decision: Ehrliche Prev/Next-Pagination statt erfundener Totalseiten

Wenn Upstream keinen exakten Gesamtzähler liefert, bestimmt der Host `hasNextPage` deterministisch über ein `pageSize + 1`-Fetch-Muster oder einen gleichwertigen Snapshot-konformen Mechanismus. Diese Semantik muss auf dem tatsächlich sichtbaren Ergebnis gelten, nicht nur auf der rohen Upstream-Antwort. Wenn nachgelagerte Sichtbarkeitsfilter Einträge entfernen, muss der Host so lange nachladen oder Überfetching betreiben, bis er für die sichtbare Seite korrekt entscheiden kann, ob eine weitere sichtbare Seite existiert.

Die UI zeigt dann Vor/Zurück und die aktuelle Seite, aber keine fiktive Gesamtseitenzahl.

Falls später ein belastbarer Count-Endpunkt verfügbar ist, kann der Vertrag `pagination.total` ohne UI-Neubau erweitern.

### Decision: `StudioDataTable` wird die gemeinsame Tabellenbasis

Die drei Plugin-Listen werden auf `StudioDataTable` migriert, statt ihre Tabellen nur optisch anzugleichen. Dadurch werden Semantik, Sortierverhalten, Empty-/Loading-State und Aktionsspalten auf denselben Tabellenanker gelegt wie andere Admin-Bereiche.

Die Pagination-Steuerung bleibt ein hostseitiges Pattern um die Tabelle herum und nicht pluginlokale Tabellenlogik.

### Decision: Query-Normalisierung in den Host-Routen

Die HTTP-Routen unter `apps/sva-studio-react/src/lib/mainserver-*.server.ts` normalisieren Query-Parameter zentral:
- `page < 1` wird auf `1` gesetzt
- ungültige `pageSize`-Werte werden auf einen kanonischen Default gesetzt
- Maximalwerte werden begrenzt

Der Change legt für alle drei Listen gemeinsame Werte fest:
- Default `pageSize = 25`
- erlaubte Größen `25`, `50`, `100`
- Maximalwert `100`

Damit bleiben Browser-Code und Plugin-API-Wrapper dünn und typstabil.

## Risks / Trade-offs

- Risiko: Upstream liefert keinen exakten Count.
  - Mitigation: UI und Vertrag basieren auf `hasNextPage` als harte Garantie; `total` bleibt optional.
- Risiko: Sichtbarkeitsfilter verfälschen ein naives `pageSize + 1`-Signal.
- Mitigation: `hasNextPage` wird auf Basis des sichtbaren Ergebnisses bestimmt; serverseitige Iteration oder gezieltes Overfetching ist zulässig.
- Risiko: `StudioDataTable` benötigt kleine Erweiterungen für die Plugin-Listen.
  - Mitigation: Erweiterungen generisch in `studio-ui-react` vornehmen, nicht in den Plugins duplizieren.
- Risiko: Playwright- und Unit-Tests müssen auf paginierte Responses umgestellt werden.
  - Mitigation: Response-Shape früh zentral definieren und in allen drei Plugins wiederverwenden.

## Migration Plan

1. Query- und Response-Typen für paginierte Mainserver-Listen definieren.
2. `@sva/sva-mainserver` auf paginierte List-Adapter umstellen.
3. Host-Routen auf Query-Parsing und Pagination-Metadaten erweitern.
4. Plugin-API-Wrapper auf den neuen Vertrag umstellen.
5. Plugin-List-Pages mit Search-Params, `StudioDataTable` und Prev/Next-Steuerung migrieren.
6. Tests und E2E-Mocks auf den neuen Vertrag anpassen.

## Open Questions

- Soll `StudioDataTable` mittelfristig eine eingebaute generische Pagination-Slot-API bekommen oder bleibt Pagination bewusst außerhalb der Tabelle? Für diesen Change reicht eine externe, gemeinsam genutzte Steuerung.
