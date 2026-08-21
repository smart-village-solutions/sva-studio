## 1. Vertrag und Characterization

- [x] 1.1 Bestehende Read-/Authorization-, Sync-/Persistenz- und Mutation-/GenericItem-Tests in fokussierte Suiten teilen
- [x] 1.2 Fake-DB-Abfrage in typisierte Schema-, Sync-State- und Projektionshandler zerlegen
- [x] 1.3 Scope-, Snapshot-, Binding-, Retry-, Konkurrenz- und Fehlerzustände vollständig charakterisieren

## 2. Modell, Persistenz und Mainserver-Quelle

- [x] 2.1 Internes Projektionsmodell und reine Entscheidungen extrahieren
- [x] 2.2 Schema-Kompatibilität, SQL-Reads/-Writes und Sync-State-Transitionen in ein Repository verschieben
- [x] 2.3 Page-/Detail-Loader und Binding-Enrichment in ein Source-Modul verschieben
- [x] 2.4 Echte Count-, Delete-, Upsert- und GenericItem-Loader-Duplikation entfernen

## 3. Synchronisation, Mutation und Fassade

- [x] 3.1 Full-Refresh, Scheduler und gemeinsame Laufregistrierung in ein Sync-Modul verschieben
- [x] 3.2 Targeted Mutation und GenericItem-Geschwisterbehandlung in ein Mutation-Modul verschieben
- [x] 3.3 Listen-, Batch-, Snapshot-, Binding- und Mutationsentscheidungen unter die Quality-Grenzen bringen
- [x] 3.4 Bestehende Datei auf eine kompatible öffentliche Serverfassade unter dem 400-Zeilen-Limit reduzieren

## 4. Dokumentation und Verifikation

- [x] 4.1 Betroffene arc42-Baustein-, Runtime- und Querschnittssicht aktualisieren
- [x] 4.2 Fokussierte Unit-, Type-, Lint-, Server-Runtime- und Coverage-Gates ausführen
- [x] 4.3 Fallow New-only und Inspect ohne neue Complexity-, Dead-Code- oder Duplikationsbefunde bestätigen
- [ ] 4.4 Sonar-Befunde für den exakten finalen Stand verifizieren
- [x] 4.5 `openspec validate refactor-iam-content-list-projection --strict` und `pnpm test:pr` ausführen
