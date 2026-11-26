## 1. Fachvertrag und Persistenz

- [x] 1.1 Vorschau und Bestätigung in den bestehenden Waste-Tourenpfad einbinden. `waste-management.tours.manage`, Tenant-Grenze, CSRF-Prüfung und bestehende Auditierung wiederverwenden.
- [x] 1.2 Die gemeinsame Kompatibilitätsprüfung für Fraktionen, Turnus, Gültigkeit, Einzeltermine, Hinweise und tourbezogene beziehungsweise global zugewiesene Verschiebungen umsetzen. Ziel, Quellen und den geprüften Stand für die Bestätigung binden.
- [x] 1.3 Prüfung und Schreiben in einer tenantlokalen Transaktion absichern. Bestehende Zielzuordnungen erhalten, fehlende Zuordnungen eindeutig ergänzen und alle Quelltouren archivieren. Konflikte mit parallelen Änderungen ohne Teilerfolg behandeln.

## 2. Tourenliste und Nachweis

- [x] 2.1 Die vorhandene Mehrfachauswahl und den Studio-Dialog für Zielauswahl, Auswirkungsübersicht, Konflikte und Bestätigung erweitern. Touren außerhalb des sichtbaren Filters ausweisen. Ergebnis und aktualisierten Status zurücklesen.
- [x] 2.2 Gezielt den Frankfurter Fall 13 + 9 + 6 → 26, unveränderte wirksame Termine und Hinweise, abweichende Planung, veraltete Vorschau, konkurrierende Änderungen, Rollback und fehlende Berechtigung prüfen.
- [x] 2.3 Die [Bedienungsreferenz](../../../docs/reference/waste-management-tour-gueltigkeit.md) und die [Bausteinsicht](../../../docs/architecture/05-building-block-view.md) aktualisieren. Die betroffenen Waste-Unit- und Persistenzprüfungen sowie die anwendbaren Pflicht-Gates nach Entwicklungsregeln ausführen.
