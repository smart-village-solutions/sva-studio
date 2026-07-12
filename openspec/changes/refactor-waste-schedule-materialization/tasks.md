## 1. Bestehenden Materialisierungspfad absichern

- [x] 1.1 Bestehende Tour-, globale und Feiertagsverschiebungen als alleinige Regelquellen bestätigen.
- [x] 1.2 Bestehende flüchtige Materialisierung für das laufende und folgende Jahr bestätigen.
- [x] 1.3 Bestehende Semantik für `advance`/`postpone` sowie `single_pickup`/`rest_of_week` durch Unit-Tests absichern.
- [x] 1.4 Bestehenden Mainserver-Sync bestätigen, der die Materialisierung vor dem Transport ausführt.

## 2. Persistenten Snapshot ergänzen

- [ ] 2.1 Additive Tabelle für instanzbezogene materialisierte Tourtermine mit Jahrfenster, fachlichem Schlüssel und Materialisierungszeitpunkt entwerfen und migrieren.
- [ ] 2.2 Repository- und Validierungsvertrag für das idempotente Ersetzen eines Instanz-Snapshots implementieren.
- [ ] 2.3 Materialisierungsservice so erweitern, dass er den Snapshot für laufendes und Folgejahr atomar erzeugt oder ersetzt.
- [ ] 2.4 Mainserver-Sync nach erfolgreicher Materialisierung ausschließlich aus dem persistierten Snapshot speisen und bei Persistenzfehlern vor dem Transport abbrechen.

## 3. Diagnose und Tests

- [ ] 3.1 Job-Result und Fortschritt um Snapshot-Zeitpunkt, Jahrfenster und Anzahl materialisierter Termine ergänzen.
- [ ] 3.2 Unit- und Repository-Tests für idempotente Snapshot-Ersetzung, Fenstergrenzen und Persistenzfehler ergänzen.
- [ ] 3.3 Integrationstest ergänzen, der die ausschließliche Snapshot-Nutzung im Mainserver-Sync belegt.

## 4. Dokumentation und Abschluss

- [ ] 4.1 `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` mit der additiven Snapshot-Tabelle aktualisieren.
- [ ] 4.2 Relevante Architektur- und Betriebsdokumentation für den Snapshot-gestützten Sync aktualisieren.
- [ ] 4.3 OpenSpec strikt validieren sowie relevante Unit-, Type-, Server-Runtime- und Schema-Gates ausführen.
