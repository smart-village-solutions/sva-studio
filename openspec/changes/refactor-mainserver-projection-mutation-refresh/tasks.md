## 1. Projektionspfad
- [ ] 1.1 Bestehenden mutationsgetriebenen Vollrefresh-Pfad fuer Mainserver-Projektionen identifizieren und auf gezielte Einzeldatensatz-Operationen umstellen
- [ ] 1.2 Projektionsrepository um gezieltes Upsert einer einzelnen Mainserver-Zeile erweitern
- [ ] 1.3 Projektionsrepository um gezieltes Delete einer einzelnen Mainserver-Zeile erweitern

## 2. Mainserver-Integration
- [ ] 2.1 Mutationspfade fuer News, Events und POI nach erfolgreicher Mutation an den gezielten Projektionspfad anbinden
- [ ] 2.2 Detail-Read-Nachladen fuer Create- und Update-Pfade auf bestehende typed Mainserver-Adapter stützen
- [ ] 2.3 Delete-Pfade auf identitaetsbasiertes Entfernen der Projektionszeile umstellen

## 3. Fehler- und Fallback-Semantik
- [ ] 3.1 Deterministische Fehlerklassifikation fuer fehlgeschlagenes gezieltes Nachladen definieren
- [ ] 3.2 Sicherstellen, dass der periodische Vollabgleich als Reconciliation-Pfad unveraendert erhalten bleibt
- [ ] 3.3 Monitoring/Logging so erweitern, dass gezielte Refresh-Fehler von erfolgreichen Mutationen unterscheidbar bleiben

## 4. Tests
- [ ] 4.1 Unit-Tests fuer gezieltes Projektions-Upsert und -Delete ergaenzen
- [ ] 4.2 Regressionstests fuer News-, Event- und POI-Mutationen ergaenzen: Create, Update, Delete
- [ ] 4.3 Fehlerfall testen: Mutation erfolgreich, gezielter Detail-Refresh fehlschlaegt, periodische Reconciliation bleibt zustaendig

## 5. Doku und Validierung
- [ ] 5.1 OpenSpec-Change mit `openspec validate refactor-mainserver-projection-mutation-refresh --strict` validieren
- [ ] 5.2 Relevante Architekturstellen in `docs/architecture/` fuer den Unterschied zwischen Mutations-Nachsynchronisation und periodischem Vollabgleich aktualisieren
