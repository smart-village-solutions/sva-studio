## 1. Abgeschlossene Übergangspfade entfernen

- [x] 1.1 Live-Voraussetzungen für Overrides, blockierende Gates und Agent-Backup erneut prüfen
- [x] 1.2 Config-Builder auf ausschließlich autoritative Overrides reduzieren
- [x] 1.3 Main-E2E-, Candidate- und Backup-Capability-Gates fest blockierend machen
- [x] 1.4 Temporären Backup-Executor und tote Evidenz-Mappings entfernen
- [x] 1.5 Workflow-Vertragstests und Config-Builder-Tests anpassen
- [x] 1.6 `docs/guides/studio-rollout-process.md`, `docs/architecture/07-deployment-view.md` und `docs/architecture/08-cross-cutting-concepts.md` aktualisieren
- [x] 1.7 Zieltests, Script-Typecheck, Rollout-Doku-Check, OpenSpec-Validierung und `pnpm test:pr` ausführen
- [x] 1.8 Nach separater Freigabe denselben Digest über Dev, Staging und Production verifizieren

## 2. Controller- und Release-Revision über zwei Checkouts trennen

- [x] 2.1 Release-Quellstand im Workspace und Workflow-Revision unter `.promote-controller/` auschecken
- [x] 2.2 Manuelle Controller-Kopierliste entfernen und Aufrufe eindeutig zuordnen
- [x] 2.3 Source-Contract auf reine Revision- und Ancestor-Prüfung reduzieren
- [x] 2.4 Workflow-Vertragstests für Checkout-, Pfad- und Gate-Reihenfolge ergänzen
- [ ] 2.5 Dokumentation und vollständige lokale sowie GitHub-Gates abschließen
- [ ] 2.6 Nach Mergefreigabe denselben Digest geschützt über Dev, Staging und Production verifizieren

## 3. Recovery auf Production-Readiness-Ausnahme reduzieren

- [ ] 3.1 Recovery für Dev und Staging ablehnen und den dokumentierten Grund erzwingen
- [ ] 3.2 Separaten Recovery-Contract entfernen und Live-Revision-Prüfung zentralisieren
- [ ] 3.3 Staging-Evidenz auf den kanonischen Main-E2E-Vertrag reduzieren
- [ ] 3.4 Recovery-Parität und unveränderte Folgegates testen
- [ ] 3.5 Dokumentation, vollständige Gates und geschützten Rollout abschließen

## 4. Abschluss

- [ ] 4.1 Entfernte GitHub-Variablen nach erfolgreichem dritten Production-Rollout separat bereinigen
- [ ] 4.2 Change nach vollständigem Rollout archivieren und OpenSpec strikt validieren
