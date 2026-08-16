## 1. Tabellenvertrag und Datenmodell

- [x] 1.1 `TourAssignmentLocationOption` um getrennte Hausnummerwerte ergänzen
- [x] 1.2 Gruppierte Mehrfachsortierung nach Ort, Straße und Hausnummer mit optional vorgeschalteter Region, gemeinsamer Richtung, fehlenden Werten und stabilen Tie-Breakern implementieren
- [x] 1.3 Deutsche und englische Tabellen- sowie Sortiertexte ergänzen oder bestehende Texte wiederverwenden

## 2. Dialogoberfläche

- [x] 2.1 Zusammengesetzte Abholortliste durch eine Tabelle mit Auswahl, Region, Ort, Straße und Hausnummer ersetzen
- [x] 2.2 Tabellenkopfzeilen sowie Steuerung für optionale Region und gemeinsame Sortierrichtung zugänglich implementieren
- [x] 2.3 Filter-, Mehrfachauswahl- und Speicherverhalten unverändert erhalten

## 3. Dokumentation und Verifikation

- [x] 3.1 View-Model- und Dialogtests für Spalten, Mehrfachsortierung mit und ohne Region, Gruppierung, Filterung und Auswahl ergänzen
- [x] 3.2 Betroffenen Nx-Unit-Test und passenden Type-Check ausführen
- [x] 3.3 `pnpm check:file-placement` und `pnpm exec openspec validate add-tour-assignment-table-sorting --strict` ausführen
- [x] 3.4 Arc42-Abweichung dokumentieren: keine Aktualisierung erforderlich, da keine Baustein- oder Laufzeitgrenze geändert wird
