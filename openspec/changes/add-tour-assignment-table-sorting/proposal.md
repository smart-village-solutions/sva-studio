# Change: Sortierbare Tabelle für Tour-Zuordnungen

## Why

Der Dialog zur Tour-Zuordnung stellt Abholorte derzeit als zusammengesetzte Listenzeilen dar. Dadurch sind Region, Ort, Straße und Hausnummer nicht als eigenständige Fachwerte erkennbar und können nicht gezielt sortiert werden. Die vorhandene Abholorte-Ansicht verwendet diese Werte bereits als getrennte Tabellenspalten.

## What Changes

- Der Dialog zur Tour-Zuordnung zeigt Abholorte als responsive Tabelle statt als zusammengesetzte Liste.
- Region, Ort, Straße und Hausnummer werden in getrennten Spalten dargestellt. Die Abholorte werden als Mehrfachsortierung nach Ort, Straße und Hausnummer auf- beziehungsweise absteigend sortiert; Region kann optional als erstes Kriterium vorgeschaltet werden.
- Ausgewählte Abholorte bleiben vor nicht ausgewählten Abholorten gruppiert; dieselbe Sortierhierarchie gilt innerhalb beider Gruppen.
- Filterung wird vor der Sortierung auf die vollständige im Dialog geladene Abholortmenge angewendet.
- Auswahl- und Filterfunktionen des bestehenden Dialogs bleiben erhalten und werden mit fokussierten Tests abgesichert.

## Impact

- Affected specs: `waste-management`
- Affected code: Tour-Zuordnungsdialog, Abholort-Optionsmodell, Waste-Plugin-Übersetzungen und UI-Tests
- Affected arc42 sections: keine; Bausteine, Datenflüsse und Schnittstellen bleiben unverändert
